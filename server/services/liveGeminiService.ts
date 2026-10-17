import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { IntentClassifier } from "../orchestrator/intentClassifier";
import { globalOrchestrator } from "../orchestrator/orchestrator";

export interface LiveSessionOptions {
  getAI: () => GoogleGenAI;
  getSystemInstruction: (isLiveCall: boolean) => string;
}

/**
 * Explicitly allow only low-risk actions in the unauthenticated live voice session.
 * Private integrations and desktop process execution must go through their
 * authenticated/permissioned app pathways, not this websocket.
 */
const LIVE_ACTION_INTENTS = new Set([
  "open_url",
  "calculate_compute",
  "datetime_timezone",
  "weather",
]);

const RODEX_LIVE_ACTION_TOOL = {
  name: "execute_rodex_action",
  description:
    "Execute a low-risk RODEX task the user explicitly requested: open or visit a website, calculate a result, check the current date/time, or check the weather. Use this tool instead of claiming RODEX lacks execution ability. Do not use it for emails, private account data, contacts, messaging, purchases, destructive actions, or launching arbitrary desktop programs.",
  parameters: {
    type: "OBJECT",
    properties: {
      request: {
        type: "STRING",
        description: "The user's requested action, preserving the destination or calculation exactly.",
      },
    },
    required: ["request"],
  },
};

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
      const systemInstruction = `${options.getSystemInstruction(true)}

LIVE ACTION EXECUTION CONTRACT:
- You have the execute_rodex_action tool for explicitly requested website navigation, calculations, current date/time, and weather actions.
- When the user asks you to open or visit a website, calculate something, check the date/time, or check the weather, call the tool and wait for its result before answering.
- Never say RODEX is only designed to process information when an execution tool is available.
- Never claim an action succeeded unless the tool result supports that claim. A browser navigation request is not proof a tab successfully opened; tell the user to use the on-screen Open button if popup protection blocks it.
- Email, contacts, messages, private account data, purchases, destructive actions, and arbitrary desktop program launching are not enabled through this unauthenticated live session. Do not claim to have executed these tasks; explain the required integration or permission clearly.
- For general current-information questions, use Google Search when useful. Do not pretend to have searched if no results were returned.
`;

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
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [RODEX_LIVE_ACTION_TOOL] },
          ],
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
            // Live API tool calls are not automatic: execute the allowlisted RODEX
            // action and return a FunctionResponse to the same live session.
            if (message.toolCall) {
              void (async () => {
                const functionCalls = Array.isArray((message.toolCall as any).functionCalls)
                  ? (message.toolCall as any).functionCalls
                  : [];
                if (functionCalls.length === 0) {
                  clientWs.send(JSON.stringify({
                    type: "tool_error",
                    message: "Live API returned a tool call without function calls.",
                  }));
                  return;
                }

                const functionResponses: Array<{
                  id?: string;
                  name?: string;
                  response: Record<string, unknown>;
                }> = [];

                for (const functionCall of functionCalls) {
                  const request = typeof functionCall.args?.request === "string"
                    ? functionCall.args.request.trim()
                    : "";
                  if (functionCall.name !== "execute_rodex_action" || !request) {
                    functionResponses.push({
                      id: functionCall.id,
                      name: functionCall.name,
                      response: {
                        success: false,
                        actionStatus: "not_executed",
                        reply: "The requested tool call was invalid. No action was executed.",
                      },
                    });
                    continue;
                  }

                  try {
                    const intent = IntentClassifier.classify(request, []);
                    if (!LIVE_ACTION_INTENTS.has(intent.primaryIntent)) {
                      functionResponses.push({
                        id: functionCall.id,
                        name: functionCall.name,
                        response: {
                          success: false,
                          actionStatus: "not_enabled",
                          reply: "I have not executed that task. The current live voice action bridge supports website navigation, calculations, date/time, and weather. Email, contacts, messaging, private account access, purchases, destructive actions, and desktop program launching require their authenticated or permissioned integration.",
                        },
                      });
                      continue;
                    }

                    const result = await globalOrchestrator.orchestrate({
                      userInput: request,
                      history: [],
                      isLiveCall: true,
                      userId: "live_public_action",
                      userDisplayName: "RODEX user",
                      hasElevatedPermission: false,
                    });

                    let responseReply = result.reply || "The action returned no response.";
                    let responseStatus = result.actionStatus || "failed";
                    if (result.openUrl) {
                      const label = intent.extractedEntities.label ||
                        result.sources?.[0]?.title ||
                        new URL(result.openUrl).hostname;
                      const destinationType = result.openUrl.includes("youtube")
                        ? "youtube"
                        : result.openUrl.includes("google")
                        ? "google"
                        : "website";

                      if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                          type: "browser_action",
                          action: {
                            url: result.openUrl,
                            label,
                            destinationType,
                            status: "requested",
                          },
                        }));
                      }
                      responseStatus = "requested";
                      responseReply = `I have requested the browser to open ${label}. If the browser blocks the tab, use the on-screen Open button. The tab opening itself may still need verification.`;
                    }

                    functionResponses.push({
                      id: functionCall.id,
                      name: functionCall.name,
                      response: {
                        success: responseStatus === "completed" || responseStatus === "requested",
                        actionStatus: responseStatus,
                        reply: responseReply,
                        sources: result.sources || [],
                        searchQueries: result.searchQueries || [],
                        pendingConfirmation: result.pendingConfirmation || null,
                      },
                    });
                  } catch (err: any) {
                    console.error("[Gemini Live Action Tool Error]", err?.message || err);
                    functionResponses.push({
                      id: functionCall.id,
                      name: functionCall.name,
                      response: {
                        success: false,
                        actionStatus: "failed",
                        reply: `I could not complete that action: ${err?.message || "an execution error occurred"}. No successful result was verified.`,
                      },
                    });
                  }
                }

                try {
                  if (session && !isClosed) {
                    session.sendToolResponse({ functionResponses });
                  }
                } catch (err: any) {
                  console.error("[Gemini Live Tool Response Error]", err?.message || err);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      type: "tool_error",
                      message: "RODEX could not return the action result to the live session.",
                    }));
                  }
                }
              })();
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
