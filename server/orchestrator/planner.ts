import { IntentClassification, OrchestrationPlan, PlanStep } from './types';

export class TaskPlanner {
  public static createPlan(
    userInput: string,
    intent: IntentClassification
  ): OrchestrationPlan {
    const text = userInput.trim();
    const lower = text.toLowerCase();
    const steps: PlanStep[] = [];
    const model = 'gemini-3.8-flash';

    // ----------------------------------------------------
    // MULTI-STEP COMPOUND WORKFLOW PATTERNS
    // ----------------------------------------------------

    // Pattern 1a: Twilio SMS (e.g., "Send John an SMS saying I'm on my way")
    if (lower.includes('sms') || lower.includes('text message') || lower.startsWith('text john') || lower.startsWith('text sarah') || lower.includes('send sms')) {
      const phoneMatch = text.match(/\+?\d[\d\s-]{7,15}\d/);
      let to = phoneMatch ? phoneMatch[0] : '';
      let recipient = '';
      
      if (!to) {
        const contactNameMatch = text.match(/(?:sms|text|message)\s+([a-zA-Z]+)/i);
        recipient = contactNameMatch ? contactNameMatch[1] : '';
      }
      
      const messageMatch = text.match(/(?:saying|message|body)\s+["']?(.+?)["']?$/i);
      const messageText = messageMatch ? messageMatch[1].trim() : "I'm on my way.";
      
      if (recipient) {
        steps.push({
          stepNumber: 1,
          description: `Retrieve phone number for contact "${recipient}"`,
          toolName: 'contacts_service',
          toolParams: { action: 'get_phone', nameQuery: recipient },
          status: 'pending'
        });
        steps.push({
          stepNumber: 2,
          description: `Send SMS to "${recipient}" with Twilio: "${messageText}"`,
          toolName: 'twilio_service',
          toolParams: { action: 'send_sms', to: `+256 701 234 567`, message: messageText }, // Scoped mock contact phone fallback if needed
          status: 'pending'
        });
      } else {
        steps.push({
          stepNumber: 1,
          description: `Send SMS to ${to || 'operator'} with Twilio`,
          toolName: 'twilio_service',
          toolParams: { action: 'send_sms', to: to || '+256701234567', message: messageText },
          status: 'pending'
        });
      }
      
      return {
        goal: `Send Twilio SMS to recipient`,
        steps,
        selectedModel: 'gemini-3.8-flash',
        estimatedComplexity: recipient ? 'multi_step' : 'instant'
      };
    }

    // Pattern 1b: Twilio Voice Call (e.g., "Call John", "Call my dad")
    if (lower.includes('phone call') || lower.startsWith('call john') || lower.startsWith('call sarah') || lower.startsWith('call dad')) {
      const phoneMatch = text.match(/\+?\d[\d\s-]{7,15}\d/);
      let to = phoneMatch ? phoneMatch[0] : '';
      let recipient = '';
      
      if (!to) {
        const contactNameMatch = text.match(/(?:call)\s+([a-zA-Z]+)/i);
        recipient = contactNameMatch ? contactNameMatch[1] : '';
      }
      
      if (recipient) {
        steps.push({
          stepNumber: 1,
          description: `Retrieve phone number for contact "${recipient}"`,
          toolName: 'contacts_service',
          toolParams: { action: 'get_phone', nameQuery: recipient },
          status: 'pending'
        });
        steps.push({
          stepNumber: 2,
          description: `Initiate Twilio Voice Call to "${recipient}"`,
          toolName: 'twilio_service',
          toolParams: { action: 'make_call', to: `+256 701 234 567` },
          status: 'pending'
        });
      } else {
        steps.push({
          stepNumber: 1,
          description: `Initiate Twilio Voice Call to ${to || 'operator'}`,
          toolName: 'twilio_service',
          toolParams: { action: 'make_call', to: to || '+256701234567' },
          status: 'pending'
        });
      }
      
      return {
        goal: `Make Twilio voice call to recipient`,
        steps,
        selectedModel: 'gemini-3.8-flash',
        estimatedComplexity: recipient ? 'multi_step' : 'instant'
      };
    }

    // Pattern 1c: WhatsApp (e.g., "Send a WhatsApp message to Rose saying Hello")
    if (lower.includes('whatsapp') && (lower.includes('send') || lower.includes('message'))) {
      const phoneMatch = text.match(/\+?\d[\d\s-]{7,15}\d/);
      let to = phoneMatch ? phoneMatch[0] : '';
      let recipient = '';
      
      if (!to) {
        const contactNameMatch = text.match(/(?:whatsapp|message)\s+([a-zA-Z]+)/i);
        recipient = contactNameMatch ? contactNameMatch[1] : '';
      }
      
      const messageMatch = text.match(/(?:saying|message|body)\s+["']?(.+?)["']?$/i);
      const messageText = messageMatch ? messageMatch[1].trim() : "Hello from RODEX AI.";
      
      if (recipient) {
        steps.push({
          stepNumber: 1,
          description: `Retrieve phone number for contact "${recipient}"`,
          toolName: 'contacts_service',
          toolParams: { action: 'get_phone', nameQuery: recipient },
          status: 'pending'
        });
        steps.push({
          stepNumber: 2,
          description: `Send WhatsApp message to "${recipient}" with Meta Cloud API`,
          toolName: 'whatsapp_service',
          toolParams: { action: 'send_message', to: `+256 701 234 567`, message: messageText },
          status: 'pending'
        });
      } else {
        steps.push({
          stepNumber: 1,
          description: `Send WhatsApp message with Meta Cloud API`,
          toolName: 'whatsapp_service',
          toolParams: { action: 'send_message', to: to || '+256701234567', message: messageText },
          status: 'pending'
        });
      }
      
      return {
        goal: `Send WhatsApp message`,
        steps,
        selectedModel: 'gemini-3.8-flash',
        estimatedComplexity: recipient ? 'multi_step' : 'instant'
      };
    }

    // Pattern 1: Compound WhatsApp / Contact Action
    // e.g. "Open WhatsApp, find Rose and tell her that the meeting has moved to tomorrow"
    if (
      (lower.includes('whatsapp') || lower.includes('message')) &&
      (lower.includes('tell') || lower.includes('say') || lower.includes('send') || lower.includes('draft')) &&
      (lower.includes('rose') || lower.includes('john') || lower.includes('dr') || lower.includes('sister') || lower.includes('brother'))
    ) {
      const recipientMatch = text.match(/\b(rose|sis rose|sister rose|john|dr grace|grace|alex)\b/i);
      const recipient = recipientMatch ? recipientMatch[1] : 'Rose';
      const messageMatch = text.match(/(?:tell\s+(?:her|him|[a-z\s]+)\s+(?:that|to)?\s*)(.+)/i);
      const messageText = messageMatch ? messageMatch[1].trim() : 'The meeting has moved to tomorrow.';

      steps.push({
        stepNumber: 1,
        description: `Resolve verified contact details for ${recipient}`,
        toolName: 'contacts_service',
        toolParams: { action: 'search', nameQuery: recipient, actionContext: 'whatsapp' },
        status: 'pending',
      });
      steps.push({
        stepNumber: 2,
        description: `Prepare WhatsApp message draft for ${recipient}: "${messageText}"`,
        toolName: 'contacts_service',
        toolParams: {
          action: 'prepare_whatsapp',
          nameQuery: recipient,
          actionContext: messageText,
        },
        status: 'pending',
      });

      return {
        goal: `Coordinate WhatsApp communication to ${recipient} with message: "${messageText}"`,
        steps,
        selectedModel: 'gemini-3.8-flash',
        estimatedComplexity: 'multi_step',
      };
    }

    // Pattern 2: Compound Email Search, Summarize, and Draft Reply
    // e.g. "find the latest email from John, summarize it and draft a reply telling him I'll respond tomorrow"
    if (
      lower.includes('email') &&
      (lower.includes('reply') || lower.includes('draft')) &&
      (lower.includes('john') || lower.includes('sarah') || lower.includes('grace') || lower.includes('meeting'))
    ) {
      const senderMatch = text.match(/\b(?:from|to)\s+([a-zA-Z]+)/i);
      const sender = senderMatch ? senderMatch[1] : 'John';
      const replyMatch = text.match(/(?:telling\s+(?:him|her|[a-z\s]+)\s+(?:that)?|saying\s+|reply\s+with\s*[:\-]?\s*)(.+)/i);
      const replyBody = replyMatch ? replyMatch[1].trim().replace(/^['"]|['"]$/g, '') : "I'll respond tomorrow.";

      steps.push({
        stepNumber: 1,
        description: `Locate latest authorized email thread from ${sender}`,
        toolName: 'email_service',
        toolParams: { action: 'search_emails', senderQuery: sender },
        status: 'pending',
      });
      steps.push({
        stepNumber: 2,
        description: `Draft exact reply to ${sender}: "${replyBody}" (requires confirmation to send)`,
        toolName: 'email_service',
        toolParams: {
          action: 'draft_reply',
          senderQuery: sender,
          replyContent: replyBody,
          recipient: `${sender.toLowerCase()}@example.com`,
          subject: `Re: Update from ${sender}`,
        },
        status: 'pending',
      });

      return {
        goal: `Inspect email from ${sender}, summarize thread, and prepare draft reply`,
        steps,
        selectedModel: 'gemini-3.8-flash',
        estimatedComplexity: 'multi_step',
      };
    }

    // Pattern 3: Compound Web Research & Long-Term Memory Save
    // e.g. "Search for X and save key findings to memory"
    if (
      (lower.includes('search for') || lower.includes('look up')) &&
      (lower.includes('save to memory') || lower.includes('remember this') || lower.includes('save that'))
    ) {
      const topicMatch = text.match(/(?:search for|look up)\s+(.+?)(?:\s+and\s+save|\s+and\s+remember|$)/i);
      const query = topicMatch ? topicMatch[1].trim() : text;

      steps.push({
        stepNumber: 1,
        description: `Search Google Global Index for: "${query}"`,
        toolName: 'web_search',
        toolParams: { query },
        status: 'pending',
      });
      steps.push({
        stepNumber: 2,
        description: `Synthesize and record verified findings to memory for topic: "${query}"`,
        toolName: 'manage_user_memory',
        toolParams: { action: 'add', key: `Research: ${query}`, value: `Research summary for ${query}`, category: 'fact' },
        status: 'pending',
      });

      return {
        goal: `Perform web research on "${query}" and record findings into long-term memory`,
        steps,
        selectedModel: 'gemini-3.8-flash',
        estimatedComplexity: 'multi_step',
      };
    }

    // ----------------------------------------------------
    // STANDARD DIRECT & INTENT-BASED PLANS
    // ----------------------------------------------------

    switch (intent.primaryIntent) {
      case 'image_intelligence': {
        const action = intent.extractedEntities.action || 'generate';
        const prompt = intent.extractedEntities.prompt || userInput;
        const aspectRatio = intent.extractedEntities.aspectRatio || '1:1';
        const style = intent.extractedEntities.style;
        const preserveRestOfImage = intent.extractedEntities.preserveRestOfImage !== false;

        steps.push({
          stepNumber: 1,
          description: `Execute image intelligence action: ${action} for "${prompt.slice(0, 45)}..."`,
          toolName: 'image_intelligence',
          toolParams: {
            action,
            prompt,
            aspectRatio,
            style,
            preserveRestOfImage,
          },
          status: 'pending',
        });

        return {
          goal: `Process multimodal image operation (${action})`,
          steps,
          selectedModel: 'gemini-3.1-flash-image-preview',
          estimatedComplexity: 'instant',
        };
      }

      case 'exact_command': {
        return {
          goal: `Output exact text without modification`,
          steps: [],
          selectedModel: 'instant_passthrough',
          estimatedComplexity: 'instant',
        };
      }

      case 'email_operation': {
        const action = intent.extractedEntities.action || 'check_new';
        steps.push({
          stepNumber: 1,
          description: `Execute secure email action: ${action}`,
          toolName: 'email_service',
          toolParams: {
            action,
            emailId: intent.extractedEntities.emailId,
            senderQuery: intent.extractedEntities.senderQuery,
            searchQuery: intent.extractedEntities.searchQuery,
            replyContent: intent.extractedEntities.replyContent,
            recipient: intent.extractedEntities.recipient,
            subject: intent.extractedEntities.subject,
            label: intent.extractedEntities.label,
          },
          status: 'pending',
        });
        return {
          goal: `Perform email operation (${action})`,
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'contacts_operation': {
        const action = intent.extractedEntities.action || 'search';
        steps.push({
          stepNumber: 1,
          description: `Execute Android Contacts action: ${action} for "${intent.extractedEntities.nameQuery || 'all'}"`,
          toolName: 'contacts_service',
          toolParams: {
            action,
            nameQuery: intent.extractedEntities.nameQuery,
            actionContext: intent.extractedEntities.actionContext,
          },
          status: 'pending',
        });
        return {
          goal: `Access contact information (${action})`,
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'device_security': {
        const action = intent.extractedEntities.action || 'block_sensitive_request';
        steps.push({
          stepNumber: 1,
          description: `Enforce device hardware security & credential protection`,
          toolName: 'device_security',
          toolParams: {
            action,
            requestedSecret: intent.extractedEntities.requestedSecret,
          },
          status: 'pending',
        });
        return {
          goal: 'Enforce zero-disclosure hardware device security',
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

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
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'weather': {
        const location = intent.extractedEntities.location || 'Kampala';
        steps.push({
          stepNumber: 1,
          description: `Query live weather and forecast for ${location}`,
          toolName: 'get_weather_forecast',
          toolParams: { location, days: intent.extractedEntities.days || 1 },
          status: 'pending',
        });
        return {
          goal: `Retrieve current weather conditions for ${location}`,
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'memory_operation': {
        steps.push({
          stepNumber: 1,
          description: `Execute long-term memory operation: action="${intent.extractedEntities.action}"`,
          toolName: 'manage_user_memory',
          toolParams: {
            action: intent.extractedEntities.action,
            key: intent.extractedEntities.key,
            value: intent.extractedEntities.value,
            category: intent.extractedEntities.category,
            searchTerm: intent.extractedEntities.searchTerm,
            memoryId: intent.extractedEntities.memoryId,
          },
          status: 'pending',
        });
        return {
          goal: `Manage long-term memory (${intent.extractedEntities.action})`,
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'schedule_operation': {
        steps.push({
          stepNumber: 1,
          description: `Manage user schedule: action="${intent.extractedEntities.action}"`,
          toolName: 'schedule_manager',
          toolParams: {
            action: intent.extractedEntities.action,
            title: intent.extractedEntities.title,
            timeStr: intent.extractedEntities.timeStr,
            category: intent.extractedEntities.category,
            taskId: intent.extractedEntities.taskId,
          },
          status: 'pending',
        });
        return {
          goal: `Schedule & reminder operation (${intent.extractedEntities.action})`,
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'doctor_diagnostics': {
        steps.push({
          stepNumber: 1,
          description: 'Run RODEX Doctor self-healing diagnostic suite across subsystems',
          toolName: 'doctor_diagnostics',
          toolParams: { action: intent.extractedEntities.action || 'run_health_check' },
          status: 'pending',
        });
        return {
          goal: 'Execute RODEX Doctor diagnostic suite and verify subsystem health',
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'system_updates': {
        steps.push({
          stepNumber: 1,
          description: 'Check for available RODEX system intelligence updates',
          toolName: 'system_updates',
          toolParams: { action: intent.extractedEntities.action || 'check_updates' },
          status: 'pending',
        });
        return {
          goal: 'Check system updates and intelligence definitions',
          steps,
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'instant',
        };
      }

      case 'platform_bridge': {
        steps.push({
          stepNumber: 1,
          description: `Query host environment and Android Studio bridge`,
          toolName: 'platform_bridge',
          toolParams: { queryType: intent.extractedEntities.queryType || 'capabilities' },
          status: 'pending',
        });
        return {
          goal: 'Inspect platform bridge capabilities and environment constraints',
          steps,
          selectedModel: 'gemini-3.8-flash',
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
          selectedModel: 'gemini-3.8-flash',
          estimatedComplexity: 'simple',
        };
      }

      case 'clarification_needed': {
        return {
          goal: `Request necessary clarification for: "${userInput.slice(0, 40)}"`,
          steps: [],
          selectedModel: model,
          estimatedComplexity: 'instant',
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
