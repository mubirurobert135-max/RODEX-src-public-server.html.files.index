import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";

export interface LiveSessionOptions {
  getAI: () => GoogleGenAI;
  getSystemInstruction: (isLiveCall: boolean) => string;
}

export function setupGeminiLiveWebSocket(server: HttpServer, options: LiveSessionOptions): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: "/api/live",
  });

  wss.on("connection", async (clientWs: WebSocket) => {
    console.log("[Gemini Live Server] Connection received from client for real-time Live API (/api/live)");
    let session: any = null;
    let isClosed = false;
    const pendingClientMessages: any[] = [];

    // Attach message listener immediately so early messages are never dropped
    clientWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!session) {
          console.log("[Gemini Live Server] Upstream session initializing, queuing message:", msg.text ? `text: ${msg.text}` : msg.audio ? "audio chunk" : "other");
          pendingClientMessages.push(msg);
          return;
        }
        dispatchClientMessage(msg);
      } catch (err: any) {
        console.error("[Gemini Live Client Message Error]", err?.message || err);
      }
    });

    const dispatchClientMessage = (msg: any) => {
      if (!session) return;
      try {
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: msg.mimeType || "audio/pcm;rate=16000",
            },
          });
        } else if (msg.text) {
          console.log(`[Gemini Live Server] CLIENT TEXT MESSAGE RECEIVED: "${msg.text}"`);
          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: msg.text }],
              },
            ],
            turnComplete: true,
          });
        } else if (msg.video) {
          session.sendRealtimeInput({
            video: {
              data: msg.video,
              mimeType: msg.mimeType || "image/jpeg",
            },
          });
        }
      } catch (err: any) {
        console.error("[Gemini Live Dispatch Error]", err?.message || err);
      }
    };

    clientWs.on("close", () => {
      isClosed = true;
      console.log("[Gemini Live] Client WebSocket closed. Terminating upstream Live session.");
      try {
        session?.close();
      } catch (_) {}
    });

    clientWs.on("error", (err) => {
      console.error("[Gemini Live Client Socket Error]", err);
    });

    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        console.warn("[Gemini Live Server] API key unconfigured. Responding with error.");
        clientWs.send(
          JSON.stringify({
            type: "error",
            error: "Gemini API key is unconfigured in server environment",
          })
        );
        clientWs.close(1000, "API key unconfigured");
        return;
      }

      console.log("[Gemini Live Server] Initializing upstream session with model gemini-3.8-live...");
      const ai = options.getAI();
      const systemInstruction = options.getSystemInstruction(true);

      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" },
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

            console.log("[Gemini Live Server] UPSTREAM MESSAGE RECEIVED:", Object.keys(message));

            // Setup complete notification
            if ((message as any).setupComplete) {
              console.log("[Gemini Live Server] SETUP COMPLETE");
              clientWs.send(JSON.stringify({ type: "setup_complete" }));
            }

            // Model turn notification
            if (message.serverContent?.modelTurn) {
              clientWs.send(JSON.stringify({ type: "model_turn" }));
            }

            // 1. Check for audio chunks
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const bytesCount = Buffer.from(part.inlineData.data, "base64").length;
                  console.log(`[Gemini Live Server] UPSTREAM AUDIO BYTES: ${bytesCount} (mime: ${part.inlineData.mimeType})`);
                  clientWs.send(
                    JSON.stringify({
                      type: "audio",
                      audio: part.inlineData.data,
                      mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                    })
                  );
                  console.log(`[Gemini Live Server] CLIENT AUDIO MESSAGE SENT (${bytesCount} bytes)`);
                }
                if (part.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: "text_part",
                      text: part.text,
                    })
                  );
                }
              }
            }

            // 2. Transcriptions
            const outputText =
              (message.serverContent as any)?.outputTranscription?.text ||
              (message.serverContent as any)?.outputAudioTranscription?.text;
            if (outputText) {
              clientWs.send(
                JSON.stringify({
                  type: "output_transcript",
                  text: outputText,
                })
              );
            }

            const inputText =
              (message.serverContent as any)?.inputTranscription?.text ||
              (message.serverContent as any)?.inputAudioTranscription?.text;
            if (inputText) {
              clientWs.send(
                JSON.stringify({
                  type: "input_transcript",
                  text: inputText,
                })
              );
            }

            // 3. Interrupted
            if (message.serverContent?.interrupted) {
              clientWs.send(
                JSON.stringify({
                  type: "interrupted",
                  interrupted: true,
                })
              );
            }

            // 4. Turn Complete
            if (message.serverContent?.turnComplete) {
              console.log("[Gemini Live Server] TURN COMPLETE");
              clientWs.send(
                JSON.stringify({
                  type: "turn_complete",
                })
              );
            }

            // 5. Tool Call or Grounding Metadata
            if (message.toolCall) {
              clientWs.send(
                JSON.stringify({
                  type: "tool_call",
                  toolCall: message.toolCall,
                })
              );
            }

            if (message.serverContent?.groundingMetadata) {
              clientWs.send(
                JSON.stringify({
                  type: "grounding",
                  metadata: message.serverContent.groundingMetadata,
                })
              );
            }
          },
          onclose: () => {
            console.log("[Gemini Live Server] Upstream Live API session closed");
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "session_closed" }));
            }
          },
          onerror: (err: any) => {
            console.error("[Gemini Live Server] Upstream session error:", err?.message || err);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  error: err?.message || "Live API upstream connection error",
                })
              );
            }
          },
        },
      });

      console.log("[Gemini Live Server] Upstream session connected successfully.");

      // Inform client that Live session is connected & verified ready
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: "connected",
            model: "gemini-3.8-live",
            voice: "Zephyr",
          })
        );
      }

      // Flush any queued messages that arrived while upstream session was establishing
      while (pendingClientMessages.length > 0) {
        const nextMsg = pendingClientMessages.shift();
        dispatchClientMessage(nextMsg);
      }
    } catch (err: any) {
      console.error("[Gemini Live Setup Error]", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: "error",
            error: err?.message || "Failed to initialize Gemini 3.8 Live API session",
          })
        );
        clientWs.close();
      }
    }
  });

  return wss;
}
