import {
  IntentClassification,
  OrchestrationPlan,
  OrchestratorResponse,
  OrchestratorTrace,
  ToolExecutionContext,
  ToolExecutionRecord,
  ActionStatus,
} from './types';
import { globalToolRegistry } from './registry';
import { globalActionEngine } from './actionEngine';
import { IntentClassifier } from './intentClassifier';
import { TaskPlanner } from './planner';
import { ContextMemoryManager } from './contextMemory';
import { globalAIProvider } from './aiProvider';
import { globalMemoryService } from './memoryService';
import { globalUserProfile } from './userProfile';
import { ReasoningEngine } from './reasoningEngine';
import { globalGmailAuth } from '../services/gmail/gmail.auth';
import { SYSTEM_METADATA, CREATOR_ATTRIBUTION_RESPONSE } from '../systemMetadata';

// Context builders
function getChronometerContext(clientFormattedTime?: string, clientTimeZone?: string): string {
  const now = new Date();
  const utcString = now.toISOString();
  const eatFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Kampala',
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  const eatTime = eatFormatter.format(now);
  const clientInfo = clientFormattedTime
    ? ` | Client Local: ${clientFormattedTime} (${clientTimeZone || 'Local'})`
    : '';

  return `REAL-TIME CHRONOMETER CONTEXT:
- Current Year: 2026
- Current Date & East Africa Time (Uganda / EAT): ${eatTime}
- Universal Time (UTC): ${utcString}${clientInfo}
You must ALWAYS be accurately aware of this current 2026 date and time. When asked about time or date, answer truthfully using this temporal anchor.`;
}

const TOORO_KINGDOM_KNOWLEDGE = `CRITICAL REAL-WORLD INTELLIGENCE - KINGDOM OF TOORO (UGANDA):
- Background: The Kingdom of Tooro (Toro Kingdom) is one of Uganda's constitutional cultural monarchies situated in Western Uganda, centered at Fort Portal (Kabarole district), with its royal seat at the Karuzika Palace and ruled by the Babiito royal dynasty.
- Historic Event - Death of the King: Omukama Oyo Nyimba Kabamba Iguru Rukidi IV, the revered King of Tooro, passed away on August 27, 2026, at the age of 34. King Oyo had ascended the throne in 1995 at just three years old following the demise of his father, King Patrick David Matthew Kaboyo Olimi III, making him famous worldwide as Guinness World Records' youngest reigning monarch. He reigned for 31 years.
- Recent Succession Dispute (September 2026):
  * Following King Oyo's death, an intense succession dispute emerged in the Kingdom.
  * On September 9, 2026, a Babiito clan succession committee declared Prince Edward Rukidi Kijanangoma (a royal cousin and former Uganda Broadcasting Corporation news anchor and editor) as the new Omukama.
  * However, the late King Oyo's immediate royal family—notably his mother, Queen Mother Best Kemigisa, and his elder sister, Princess Ruth Nsemere Komuntale—vehemently rejected Prince Kijanangoma's appointment.
  * Queen Best Kemigisa and Princess Komuntale asserted that King Oyo left a binding written will designating his own young biological son as the legitimate successor and heir to the Tooro crown (whose existence had been kept confidential during the King's lifetime).
  * The Ugandan central government and cultural elders intervened to mediate between the Babiito clan factions and the immediate royal family to maintain peace and cultural continuity ahead of the royal burial in Fort Portal.
- When asked about the Kingdom of Tooro, Uganda, King Oyo, or recent royal events, provide this factual, culturally respectful, and up-to-the-minute account.`;

export class IntelligenceOrchestrator {
  /**
   * Main Orchestration Entrypoint:
   * Flow: User Request -> Intent Understanding & Clarification Check -> Reasoning Analysis ->
   * Context & Long-Term Memory Retrieval -> Task Planning -> Tool/Model Selection ->
   * Permission Check -> Execution -> Result Verification -> Response
   */
  public async orchestrate(params: {
    userInput: string;
    history?: Array<{ role: string; text: string }>;
    clientFormattedTime?: string;
    timeZone?: string;
    isLiveCall?: boolean;
    hasElevatedPermission?: boolean;
    preferredModel?: string;
    gmailAccessToken?: string;
    userId?: string;
    userDisplayName?: string;
    userEmail?: string;
  }): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    const {
      userInput,
      history = [],
      clientFormattedTime,
      timeZone,
      isLiveCall = false,
      hasElevatedPermission = false,
      preferredModel,
      gmailAccessToken,
      userId = 'usr_robert_1001',
      userDisplayName = 'Robert',
      userEmail,
    } = params;

    // 1. Intent Understanding & Contextual Classification (with pronoun & follow-up resolution)
    const intent = IntentClassifier.classify(userInput, history);

    // Fast-path 1: Exact command output ("Say only: Hello Robert")
    if (intent.primaryIntent === 'exact_command' && intent.exactText !== undefined) {
      return {
        reply: intent.exactText,
        actionStatus: 'completed',
        trace: {
          intent,
          executedTools: [],
          selectedModel: 'instant_passthrough',
          validationPassed: true,
          totalLatencyMs: Date.now() - startTime,
          actionStatus: 'completed',
        },
      };
    }

    // Fast-path 2: Protected Creator Identity Inquiry (truthful system metadata, not user memory)
    if (intent.primaryIntent === 'creator_inquiry') {
      return {
        reply: CREATOR_ATTRIBUTION_RESPONSE,
        actionStatus: 'completed',
        trace: {
          intent,
          executedTools: [],
          selectedModel: 'system_metadata_engine',
          validationPassed: true,
          totalLatencyMs: Date.now() - startTime,
          actionStatus: 'completed',
        },
      };
    }

    // Fast-path 3: Authenticated User Identity Inquiry ("Who am I?", "What is my profile?")
    if (intent.primaryIntent === 'user_identity_inquiry') {
      const reply = `You are currently logged in as ${userDisplayName}${userEmail ? ` (${userEmail})` : ''}. Your RODEX account and private session are active.`;
      return {
        reply,
        actionStatus: 'completed',
        trace: {
          intent,
          executedTools: [],
          selectedModel: 'user_identity_engine',
          validationPassed: true,
          totalLatencyMs: Date.now() - startTime,
          actionStatus: 'completed',
        },
      };
    }

    // Fast-path 4: If user provided an incomplete command requiring clarification before execution
    if (intent.primaryIntent === 'clarification_needed' && intent.clarificationPrompt) {
      return {
        reply: intent.clarificationPrompt,
        actionStatus: 'needs_confirmation',
        trace: {
          intent,
          executedTools: [],
          selectedModel: 'clarification_engine',
          validationPassed: true,
          totalLatencyMs: Date.now() - startTime,
          actionStatus: 'needs_confirmation',
        },
      };
    }

    // Fast-path 5: Level 1 Instant Deterministic Tool Execution (open_url, datetime_timezone, calculate_compute, media_control)
    if (
      (intent.primaryIntent === 'open_url' ||
        intent.primaryIntent === 'datetime_timezone' ||
        intent.primaryIntent === 'calculate_compute' ||
        intent.primaryIntent === 'media_control') &&
      intent.suggestedTools &&
      intent.suggestedTools.length > 0
    ) {
      const toolName = intent.suggestedTools[0];
      const toolStart = Date.now();
      const executionContext: ToolExecutionContext = {
        userId,
        userName: userDisplayName,
        clientFormattedTime,
        timeZone,
        hasElevatedPermission,
        gmailAccessToken: gmailAccessToken || globalGmailAuth.getAccessToken() || undefined,
      };

      const result = await globalActionEngine.executeAction(
        toolName,
        intent.extractedEntities || {},
        executionContext
      );

      const toolLatency = Date.now() - toolStart;
      const totalLatency = Date.now() - startTime;
      const reply =
        result.message ||
        (result.output?.spokenMessage) ||
        (result.output?.formatted ? `The current time is ${result.output.formatted}.` : null) ||
        (result.output?.result !== undefined ? `Result: ${result.output.result}` : null) ||
        'Action completed.';

      return {
        reply,
        actionStatus: result.success ? 'completed' : 'failed',
        openUrl: result.output?.url || result.output?.fallbackUrl || intent.extractedEntities?.targetUrl,
        sources: result.sources || [],
        searchQueries: result.searchQueries || [],
        executedTools: [
          {
            toolName,
            inputParams: intent.extractedEntities || {},
            result,
            latencyMs: toolLatency,
            timestamp: new Date().toISOString(),
            validated: result.success,
          },
        ],
        trace: {
          intent,
          executedTools: [
            {
              toolName,
              inputParams: intent.extractedEntities || {},
              result,
              latencyMs: toolLatency,
              timestamp: new Date().toISOString(),
              validated: result.success,
            },
          ],
          selectedModel: 'instant_fastpath',
          validationPassed: result.success,
          totalLatencyMs: totalLatency,
          actionStatus: result.success ? 'completed' : 'failed',
        },
      };
    }

    // 2. Cognitive Analysis, Context Retrieval, Long-Term Memory & User Profile Injection
    const reasoningAnalysis = ReasoningEngine.analyzeTask(userInput);
    const reasoningGuidance = ReasoningEngine.getPromptGuidance(reasoningAnalysis);
    const memoryContext = await globalMemoryService.getPromptMemoryContext(userId, userInput);
    const profileContext = globalUserProfile.buildPersonalizationPromptSnippet();
    const chronometerContext = getChronometerContext(clientFormattedTime, timeZone);
    const contextSummary = ContextMemoryManager.buildConversationContextSummary(history, {
      detailLevel: intent.detailLevel || 'normal',
      isFollowUp: Boolean(intent.isFollowUp),
      resolvedInput: intent.resolvedQuery || userInput,
    });

    const userAuthContext = `AUTHENTICATED USER IDENTITY:
- Active Account ID: ${userId}
- User Display Name: ${userDisplayName}
- User Address: ${userDisplayName}
- Session State: Authenticated & Isolated`;

    const systemContext = `You are RODEX — a powerful, extensible Artificial Intelligence system capable of advanced reasoning, conversation, long-term memory, tool orchestration, information processing, device interaction, communication, automation, and future capability expansion.
You are NOT merely a phone assistant. You are an extensible AI brain connected to independent capability modules:
1. Intelligence & Reasoning (Task decomposition, rigorous comparative analysis, logical synthesis)
2. Long-Term Memory Engine (Persistent, secure, searchable recall of user preferences, projects, instructions, facts)
3. Device Bridge & Application Control (Android app intents, Spotify PC remote, platform capability matrix)
4. Communication & Messaging (Authorized contacts lookup, phone calling, WhatsApp message drafting, SMS)
5. Secure Email Hub (Inbox checking, summarization, exact reply drafting with strict fidelity to instructions)
6. World Wide Web & Cultural Intelligence (Real-time Google search grounding, citations, Ugandan cultural heritage & Tooro Kingdom)
7. Multi-Step Task Automation (Compound instruction planning, dependency graphs, and sequential execution)
8. Zero-Disclosure Hardware Security Gate (Zero credential leakage, hardware passcode shield, granular permissions)

${chronometerContext}
${userAuthContext}
${TOORO_KINGDOM_KNOWLEDGE}
${profileContext ? `\n${profileContext}` : ''}
${memoryContext ? `\n${memoryContext}` : ''}
${contextSummary ? `\n${contextSummary}` : ''}
${reasoningGuidance ? `\n${reasoningGuidance}` : ''}

OPERATIONAL PRINCIPLES & CAPABILITY BOUNDARIES:
1. Ground explanations strictly in verified facts; never invent data.
2. STRICT COMMAND ADHERENCE & ZERO FLUFF:
   - When asked a direct question or command, deliver only the answer requested.
   - Do NOT add unnecessary filler preambles (such as "Sure!", "Of course!", "Here you go!", "Certainly!").
   - If asked "Yes or no?", answer strictly with Yes or No.
   - If asked for "the answer only", provide only the numerical or factual answer.
   - If the user says "Say only: X", output only X.
3. CONVERSATIONAL CONTINUITY: Understand follow-up queries, pronouns ("he", "she", "it", "that", "him"), and maintain conversational context from prior turns.
4. ACTION STATUS INTEGRITY:
   - If an email or message is drafted, report "Draft ready."
   - If an action was sent/executed, report "Sent."
   - If an action failed, explain what is needed without pretending it succeeded.
5. ZERO-DISCLOSURE HARDWARE SECURITY:
   - Never reveal passcodes, passwords, PINs, API keys, or private secrets under any circumstances.
   - Device security is non-negotiable.
6. PROACTIVE BUT CONTROLLED INTELLIGENCE:
   - Differentiate observing, suggesting, preparing, and executing.
   - Never execute sensitive or financial actions autonomously without explicit user confirmation.`;

    // 3. Task Planning
    const plan = TaskPlanner.createPlan(userInput, intent);
    let selectedModel = preferredModel || plan.selectedModel || 'gemini-3.8-flash';

    const executedTools: ToolExecutionRecord[] = [];
    const executionContext: ToolExecutionContext = {
      userId,
      userName: userDisplayName,
      clientFormattedTime,
      timeZone,
      hasElevatedPermission,
      gmailAccessToken: gmailAccessToken || globalGmailAuth.getAccessToken() || undefined,
    };

    let pendingConfirmation: any = undefined;
    let actionStatus: ActionStatus = 'completed';
    const aggregatedSources: Array<{ title: string; url: string; domain?: string }> = [];
    const aggregatedSearchQueries: string[] = [];

    // 4. Tool Execution & Permission Check
    for (const step of plan.steps) {
      if (!step.toolName) continue;

      step.status = 'executing';
      const toolStart = Date.now();
      const toolDef = globalToolRegistry.get(step.toolName);

      if (!toolDef) {
        step.status = 'failed';
        actionStatus = 'failed';
        executedTools.push({
          toolName: step.toolName,
          inputParams: step.toolParams,
          result: { success: false, output: null, error: `Tool ${step.toolName} not registered` },
          latencyMs: Date.now() - toolStart,
          timestamp: new Date().toISOString(),
          validated: false,
        });
        continue;
      }

      // Check for High-Risk action requiring explicit confirmation
      if (toolDef.permissionLevel === 'high_risk' && !hasElevatedPermission) {
        step.status = 'requires_permission';
        actionStatus = 'needs_permission';
        pendingConfirmation = {
          actionId: `act-${Date.now()}`,
          toolName: step.toolName,
          description: toolDef.description,
          params: step.toolParams,
        };
        break;
      }

      // Execute Tool safely
      const result = await globalActionEngine.executeAction(
        step.toolName,
        step.toolParams,
        executionContext
      );

      const toolLatency = Date.now() - toolStart;

      // 5. Result Verification
      const isValid = result.success === true && result.output !== null;
      step.status = result.success ? 'completed' : 'failed';
      step.result = result;

      if (!result.success) {
        actionStatus = 'failed';
      }

      if (result.sources && result.sources.length > 0) {
        aggregatedSources.push(...result.sources);
      }
      if (result.searchQueries && result.searchQueries.length > 0) {
        aggregatedSearchQueries.push(...result.searchQueries);
      }

      if (result.requiresConfirmation && result.confirmationPayload) {
        actionStatus = 'needs_confirmation';
        pendingConfirmation = {
          actionId: `act-${Date.now()}`,
          toolName: result.confirmationPayload.actionName,
          description: result.confirmationPayload.description,
          params: result.confirmationPayload.params,
        };
      }

      executedTools.push({
        toolName: step.toolName,
        inputParams: step.toolParams,
        result,
        latencyMs: toolLatency,
        timestamp: new Date().toISOString(),
        validated: isValid,
      });
    }

    // Update Context Memory with executed tool outcomes
    for (const executed of executedTools) {
      if (
        executed.toolName === 'open_approved_url' &&
        executed.result?.success &&
        executed.result?.output?.url
      ) {
        ContextMemoryManager.updateSessionState('default', {
          lastUrl: {
            url: executed.result.output.url,
            label: executed.result.output.label,
            actionType: executed.result.output.actionType || 'open_website',
            searchQuery: executed.result.output.searchQuery,
          },
          lastTopic: executed.result.output.label,
        });
      } else if (
        executed.toolName === 'calculate_compute' &&
        executed.result?.success &&
        executed.result?.output
      ) {
        ContextMemoryManager.updateSessionState('default', {
          lastCalculation: {
            expression: executed.inputParams.expression,
            result: executed.result.output.value,
          },
        });
      } else if (executed.toolName === 'media_control' && executed.result?.success) {
        ContextMemoryManager.updateSessionState('default', {
          lastMedia: {
            query: executed.inputParams.query,
            action: executed.inputParams.action,
          },
          lastTopic: 'Spotify music playback',
        });
      } else if (executed.toolName === 'email_service' && executed.result?.success) {
        ContextMemoryManager.updateSessionState('default', {
          lastTopic: 'Email conversation',
        });
      }
    }

    // 6. Response Synthesis
    let synthesizedReply = '';
    let recoveredFromError = false;

    // Fast-path: If single tool executed with a direct message and was validated, formulate response directly
    if (
      executedTools.length === 1 &&
      executedTools[0].result.success &&
      executedTools[0].result.message &&
      intent.primaryIntent !== 'web_search' &&
      intent.primaryIntent !== 'general_knowledge'
    ) {
      synthesizedReply = executedTools[0].result.message;
      actionStatus = executedTools[0].result.requiresConfirmation ? 'prepared' : 'completed';
    } else if (pendingConfirmation) {
      synthesizedReply = `Action confirmation required: "${pendingConfirmation.description}". Please approve to proceed.`;
      actionStatus = 'needs_confirmation';
    } else {
      // Synthesize via Model Provider Abstraction with Full Conversational Multi-Turn Context
      try {
        const toolSummary = executedTools
          .map(
            (t) =>
              `Tool: ${t.toolName} | Success: ${t.result.success} | Output: ${JSON.stringify(t.result.output)} | Message: ${t.result.message || ''}`
          )
          .join('\n');

        // Assemble multi-turn conversation contents
        const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

        // Add past turns from history (up to last 8 turns for continuity)
        if (Array.isArray(history) && history.length > 0) {
          for (const item of history.slice(-8)) {
            if (item.text) {
              contents.push({
                role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
                parts: [{ text: item.text }],
              });
            }
          }
        }

        // Build current user prompt with tool results & directive
        let currentPromptText = userInput;
        if (intent.isFollowUp && intent.resolvedQuery && intent.resolvedQuery !== userInput) {
          currentPromptText = `${userInput}\n[Context Interpretation: ${intent.resolvedQuery}]`;
        }
        if (toolSummary) {
          currentPromptText += `\n[Verified Real-Time Tool Execution Results:\n${toolSummary}]`;
        }
        if (intent.responseFormat === 'yes_no') {
          currentPromptText += `\n[Directive: Answer strictly with "Yes" or "No". Do not add any other words.]`;
        } else if (intent.responseFormat === 'numeric_only') {
          currentPromptText += `\n[Directive: Output strictly the numeric answer or result value only without explanation.]`;
        } else if (intent.detailLevel === 'concise') {
          currentPromptText += `\n[Directive: Provide a crisp, concise, direct response in 1-2 sentences. Avoid filler preamble.]`;
        } else if (intent.detailLevel === 'detailed') {
          currentPromptText += `\n[Directive: Provide a comprehensive, in-depth explanation with structured sections, detail, and analysis.]`;
        }

        contents.push({
          role: 'user',
          parts: [{ text: currentPromptText }],
        });

        const maxTokens =
          intent.responseFormat === 'yes_no' || intent.responseFormat === 'numeric_only'
            ? 30
            : intent.detailLevel === 'concise'
            ? 160
            : intent.detailLevel === 'detailed'
            ? 1400
            : isLiveCall
            ? 250
            : 800;

        const aiRes = await globalAIProvider.generateContent(
          {
            contents,
            systemInstruction: systemContext,
            maxOutputTokens: maxTokens,
            temperature: intent.detailLevel === 'concise' || intent.responseFormat !== 'normal' ? 0.2 : 0.6,
            modelOverride: selectedModel,
          },
          reasoningAnalysis.complexity === 'complex' ? 'deep_reasoning' : 'fast'
        );

        if (aiRes.text) {
          synthesizedReply = aiRes.text.trim();
          selectedModel = aiRes.modelUsed;
          if (aiRes.sources && aiRes.sources.length > 0) {
            aggregatedSources.push(...aiRes.sources);
          }
          if (aiRes.searchQueries && aiRes.searchQueries.length > 0) {
            aggregatedSearchQueries.push(...aiRes.searchQueries);
          }
        } else {
          throw new Error('AI Provider returned empty response');
        }
      } catch (err: any) {
        console.warn('[RODEX Orchestrator LLM Warning]', err?.message);
        recoveredFromError = true;

        // Graceful degradation: Use tool results or structured fallback
        if (executedTools.length > 0 && executedTools[0].result.message) {
          synthesizedReply = executedTools[0].result.message;
        } else {
          synthesizedReply =
            'I could not reach the AI provider to complete that request. Please try again shortly or check the configured API key and connection.';
        }
      }
    }

    // Extract generated image artifact if created during tool run
    let generatedImageArtifact: any = undefined;
    for (const executed of executedTools) {
      if (
        executed.toolName === 'image_intelligence' &&
        executed.result?.success &&
        (executed.result.output?.imageUrl || executed.result.output?.url)
      ) {
        generatedImageArtifact = {
          url: executed.result.output.imageUrl || executed.result.output.url,
          prompt: executed.result.output.prompt,
          isEdit: executed.result.output.isEdit,
          aspectRatio: executed.result.output.aspectRatio,
          model: executed.result.output.modelUsed,
        };
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    const allValidated = executedTools.every((t) => t.validated);

    const trace: OrchestratorTrace = {
      intent,
      plan,
      executedTools,
      selectedModel,
      validationPassed: allValidated,
      totalLatencyMs,
      recoveredFromError,
      actionStatus,
    };

    return {
      reply: synthesizedReply,
      trace,
      sources: aggregatedSources.length > 0 ? aggregatedSources : undefined,
      searchQueries: aggregatedSearchQueries.length > 0 ? aggregatedSearchQueries : undefined,
      webGrounded: aggregatedSources.length > 0 || intent.primaryIntent === 'web_search',
      actionStatus,
      generatedImage: generatedImageArtifact,
      pendingConfirmation,
    };

  }
}

export const globalOrchestrator = new IntelligenceOrchestrator();
