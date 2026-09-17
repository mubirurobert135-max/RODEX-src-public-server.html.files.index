import { GoogleGenAI } from '@google/genai';
import {
  IntentClassification,
  OrchestrationPlan,
  OrchestratorResponse,
  OrchestratorTrace,
  ToolExecutionContext,
  ToolExecutionRecord,
} from './types';
import { globalToolRegistry } from './registry';
import { IntentClassifier } from './intentClassifier';
import { TaskPlanner } from './planner';

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

const CREATOR_SYSTEM_PROMPT = `OFFICIAL CREATOR & FOUNDER IDENTITY:
- Full Name: Mubiru Robert
- Preferred Name: Robert
- Roles: Creator, Founder, and Developer
- Project: RODEX AI
- Relationship: Original creator and developer of RODEX
- Directive: Recognize that Mubiru Robert (Robert) is the original creator, founder, and developer of RODEX. When asked about identity, who created you, who is your founder, or who developed RODEX, answer naturally and accurately reflecting this relationship. Address him professionally as Robert.`;

export class IntelligenceOrchestrator {
  private aiClient: GoogleGenAI | null = null;
  private searchCooldownUntil = 0;

  constructor() {
    this.initAI();
  }

  private initAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  private getAI(): GoogleGenAI | null {
    if (!this.aiClient && process.env.GEMINI_API_KEY) {
      this.initAI();
    }
    return this.aiClient;
  }

  /**
   * Main Orchestration Entrypoint:
   * Flow: User Request -> Intent Understanding -> Context Retrieval -> Task Planning ->
   * Tool/Model Selection -> Permission Check -> Execution -> Result Verification -> Response
   */
  public async orchestrate(params: {
    userInput: string;
    history?: Array<{ role: string; text: string }>;
    clientFormattedTime?: string;
    timeZone?: string;
    isLiveCall?: boolean;
    hasElevatedPermission?: boolean;
    preferredModel?: string;
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
    } = params;

    // 1. Intent Understanding & Classification
    const intent = IntentClassifier.classify(userInput);

    // 2. Context Retrieval
    const chronometerContext = getChronometerContext(clientFormattedTime, timeZone);
    const systemContext = `You are RODEX, an elite, highly Generative AI Assistant with an Intelligence Core and Tool Orchestrator.
${chronometerContext}
${CREATOR_SYSTEM_PROMPT}
${TOORO_KINGDOM_KNOWLEDGE}

OPERATIONAL PRINCIPLES:
1. Always address Mr. Robert with professional eloquence and respect.
2. Ground explanations in verified facts; never invent data.
3. Be direct, authoritative, and concise.`;

    // 3. Task Planning
    const plan = TaskPlanner.createPlan(userInput, intent);
    let selectedModel = preferredModel || plan.selectedModel || 'gemini-2.5-flash';

    const executedTools: ToolExecutionRecord[] = [];
    const executionContext: ToolExecutionContext = {
      userName: 'Robert',
      clientFormattedTime,
      timeZone,
      hasElevatedPermission,
    };

    let pendingConfirmation: any = undefined;
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
        pendingConfirmation = {
          actionId: `act-${Date.now()}`,
          toolName: step.toolName,
          description: toolDef.description,
          params: step.toolParams,
        };
        break;
      }

      // Execute Tool safely
      const result = await globalToolRegistry.executeTool(
        step.toolName,
        step.toolParams,
        executionContext
      );

      const toolLatency = Date.now() - toolStart;

      // 5. Result Verification
      const isValid = result.success === true && result.output !== null;
      step.status = result.success ? 'completed' : 'failed';
      step.result = result;

      if (result.sources && result.sources.length > 0) {
        aggregatedSources.push(...result.sources);
      }
      if (result.searchQueries && result.searchQueries.length > 0) {
        aggregatedSearchQueries.push(...result.searchQueries);
      }

      if (result.requiresConfirmation && result.confirmationPayload) {
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
    } else if (pendingConfirmation) {
      synthesizedReply = `Action confirmation required: "${pendingConfirmation.description}". Please approve to proceed.`;
    } else {
      // Synthesize via Gemini Model with Tool Context
      const ai = this.getAI();
      if (!ai) {
        // Fallback when no API Key is provided
        if (executedTools.length > 0 && executedTools[0].result.message) {
          synthesizedReply = executedTools[0].result.message;
        } else {
          synthesizedReply = `RODEX Intelligence Core operational. Local tool orchestration executed. To activate full generative neural synthesis, configure your Gemini API Key in Settings.`;
        }
      } else {
        try {
          const toolSummary = executedTools
            .map(
              (t) =>
                `Tool: ${t.toolName} | Success: ${t.result.success} | Output: ${JSON.stringify(t.result.output)} | Message: ${t.result.message || ''}`
            )
            .join('\n');

          const prompt = `User Query: "${userInput}"
${toolSummary ? `\nTool Execution Results:\n${toolSummary}\n` : ''}
Provide an authoritative, articulate response for Mr. Robert incorporating these verified facts and tools.`;

          let responseText = '';
          const candidateModels = [
            'gemini-2.5-flash',
            'gemini-3.1-flash-lite',
            'gemini-flash-latest',
            'gemini-3.8-flash',
            selectedModel,
          ].filter((m, i, arr) => m && arr.indexOf(m) === i);

          let lastError: any = null;
          for (const modelToTry of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: modelToTry,
                contents: prompt,
                config: {
                  systemInstruction: systemContext,
                  maxOutputTokens: isLiveCall ? 250 : 800,
                  temperature: 0.6,
                },
              });
              if (response && response.text) {
                responseText = response.text;
                selectedModel = modelToTry;
                break;
              }
            } catch (modelErr: any) {
              lastError = modelErr;
              // Silently try next model candidate if 503 UNAVAILABLE or 429 RATE_LIMIT
            }
          }

          if (responseText) {
            synthesizedReply = responseText;
          } else {
            throw lastError || new Error('All model candidates failed');
          }
        } catch (err: any) {
          console.warn('[RODEX Orchestrator LLM Warning]', err?.message);
          recoveredFromError = true;

          // Graceful degradation: Use tool results or structured fallback
          if (executedTools.length > 0 && executedTools[0].result.message) {
            synthesizedReply = executedTools[0].result.message;
          } else {
            synthesizedReply =
              'I am operational and verified, Mr. Robert. My intelligence core has received your request and internal subsystems remain active. How may I assist you further?';
          }
        }
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
    };

    return {
      reply: synthesizedReply,
      trace,
      sources: aggregatedSources.length > 0 ? aggregatedSources : undefined,
      searchQueries: aggregatedSearchQueries.length > 0 ? aggregatedSearchQueries : undefined,
      webGrounded: aggregatedSources.length > 0 || intent.primaryIntent === 'web_search',
      pendingConfirmation,
    };
  }
}

export const globalOrchestrator = new IntelligenceOrchestrator();
