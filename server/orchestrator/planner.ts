import { IntentClassification, OrchestrationPlan, PlanStep } from './types';

export class TaskPlanner {
  public static createPlan(
    userInput: string,
    intent: IntentClassification
  ): OrchestrationPlan {
    const steps: PlanStep[] = [];
    const model = 'gemini-2.5-flash';

    switch (intent.primaryIntent) {
      case 'open_url': {
        const url = intent.extractedEntities.targetUrl || 'https://www.youtube.com';
        const label = intent.extractedEntities.label || 'Website';
        const actionType = intent.extractedEntities.actionType || 'open_website';
        const searchQuery = intent.extractedEntities.searchQuery;

        steps.push({
          stepNumber: 1,
          description: `Validate and open web destination: ${label} (${url})`,
          toolName: 'open_approved_url',
          toolParams: {
            url,
            label,
            actionType,
            searchQuery,
          },
          status: 'pending',
        });
        return {
          goal: `Open ${label} in browser`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'calculate_compute': {
        steps.push({
          stepNumber: 1,
          description: `Safely calculate math expression: "${intent.extractedEntities.expression}"`,
          toolName: 'calculate_compute',
          toolParams: { expression: intent.extractedEntities.expression },
          status: 'pending',
        });
        return {
          goal: `Compute and answer: ${intent.extractedEntities.expression}`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'datetime_timezone': {
        steps.push({
          stepNumber: 1,
          description: `Retrieve official 2026 chronometer and time for timezone "${intent.extractedEntities.targetTimeZone}"`,
          toolName: 'datetime_timezone',
          toolParams: { targetTimeZone: intent.extractedEntities.targetTimeZone },
          status: 'pending',
        });
        return {
          goal: `Provide precise current date and time for ${intent.extractedEntities.targetTimeZone}`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'system_info': {
        steps.push({
          stepNumber: 1,
          description: `Query runtime system metrics (category: ${intent.extractedEntities.category})`,
          toolName: 'system_info',
          toolParams: { category: intent.extractedEntities.category },
          status: 'pending',
        });
        return {
          goal: 'Retrieve and summarize system health and operational metrics',
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'file_inspection': {
        steps.push({
          stepNumber: 1,
          description: `Inspect allowed project file: ${intent.extractedEntities.filePath}`,
          toolName: 'read_permitted_file',
          toolParams: { filePath: intent.extractedEntities.filePath },
          status: 'pending',
        });
        return {
          goal: `Read and summarize file: ${intent.extractedEntities.filePath}`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'simple',
        };
      }

      case 'media_control': {
        steps.push({
          stepNumber: 1,
          description: `Dispatch Spotify PC media command: action="${intent.extractedEntities.action}"`,
          toolName: 'media_control',
          toolParams: {
            action: intent.extractedEntities.action,
            query: intent.extractedEntities.query,
            volumePercent: intent.extractedEntities.volumePercent,
          },
          status: 'pending',
        });
        return {
          goal: `Control media playback on Spotify PC (${intent.extractedEntities.action})`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'app_action': {
        steps.push({
          stepNumber: 1,
          description: `Perform in-app action: ${intent.extractedEntities.action}`,
          toolName: 'app_action',
          toolParams: { action: intent.extractedEntities.action },
          status: 'pending',
        });
        return {
          goal: `Trigger application modal/action: ${intent.extractedEntities.action}`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'web_search': {
        steps.push({
          stepNumber: 1,
          description: `Search Google Global Index for: "${intent.extractedEntities.query}"`,
          toolName: 'web_search',
          toolParams: { query: intent.extractedEntities.query },
          status: 'pending',
        });
        return {
          goal: `Retrieve live verified web facts for: ${intent.extractedEntities.query}`,
          steps,
          selectedModel: 'gemini-2.5-flash',
          estimatedComplexity: 'simple',
        };
      }

      case 'creator_inquiry':
      case 'cultural_knowledge':
      case 'general_knowledge':
      default: {
        return {
          goal: `Synthesize comprehensive response for: "${userInput.slice(0, 40)}..."`,
          steps: [],
          selectedModel: model,
          estimatedComplexity: 'simple',
        };
      }
    }
  }
}
