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
    console.log("[Gemini Live] Client connected for real-time Live API conversation (gemini-3.8-live)");
    let session: any = null;
    let isClosed = false;

    try {
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
          tools: [{ googleMaps: {} }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

            // 1. Check for audio chunks
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(
                    JSON.stringify({
                      type: "audio",
                      audio: part.inlineData.data,
                      mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                    })
                  );
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
            console.log("[Gemini Live] Live API session closed by upstream");
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "session_closed" }));
            }
          },
          onerror: (err: any) => {
            console.error("[Gemini Live Upstream Error]", err);
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

      // Inform client that Live session is connected & ready
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: "connected",
            model: "gemini-3.8-live",
            voice: "Zephyr",
            tools: ["googleMaps"],
          })
        );
      }

      clientWs.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: msg.mimeType || "audio/pcm;rate=16000",
              },
            });
          } else if (msg.text) {
            session.sendRealtimeInput({
              text: msg.text,
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
          console.error("[Gemini Live Client Message Error]", err?.message || err);
        }
      });

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
