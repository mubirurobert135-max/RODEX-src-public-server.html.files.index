import {
  IntentClassification,
  TaskIntentCategory,
  ToolPermissionLevel,
  InteractionType,
  ResponseFormat,
} from './types';
import { ContextMemoryManager } from './contextMemory';

export class IntentClassifier {
  public static classify(
    userInput: string,
    history: Array<{ role: string; text: string }> = [],
    sessionId: string = 'default'
  ): IntentClassification {
    if (!userInput || typeof userInput !== 'string') {
      return {
        primaryIntent: 'conversational',
        confidence: 1.0,
        extractedEntities: {},
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'conversation',
        responseFormat: 'normal',
      };
    }

    const rawText = userInput.trim();
    const resolution = ContextMemoryManager.resolveContext(
      rawText,
      history,
      ContextMemoryManager.getSessionState(sessionId)
    );

    const text = resolution.resolvedInput || rawText;
    const lower = text.toLowerCase();
    const rawLower = rawText.toLowerCase();

    // Determine Response Formats & Minimal Modes from user instruction
    let responseFormat: ResponseFormat = 'normal';
    let detailLevel: 'concise' | 'normal' | 'detailed' = resolution.detailLevel || 'normal';

    if (/\b(yes or no\??|is it yes or no)\b/i.test(rawLower)) {
      responseFormat = 'yes_no';
      detailLevel = 'concise';
    } else if (/\b(give me the answer only|answer only|just the number|only the result|number only|value only)\b/i.test(rawLower)) {
      responseFormat = 'numeric_only';
      detailLevel = 'concise';
    } else if (/\b(read this|read it|read without commentary|read verbatim)\b/i.test(rawLower)) {
      responseFormat = 'read_only';
    } else if (/\b(don't say anything else|do not say anything else|say nothing else|no extra words|no fluff)\b/i.test(rawLower)) {
      responseFormat = 'exact';
      detailLevel = 'concise';
    }

    // 1. STRICT COMMAND FOLLOWING: "Say only: X", "Say exactly: X", "Output only: X"
    const exactMatch =
      rawText.match(/^(?:say\s+only|say\s+exactly|output\s+only|echo\s+only|repeat\s+only|just\s+say):\s*(.+)$/i) ||
      rawText.match(/^(?:say\s+only|say\s+exactly|output\s+only|repeat\s+only)\s+["'](.+?)["']$/i);
    if (exactMatch && exactMatch[1]) {
      const exactContent = exactMatch[1].trim();
      return {
        primaryIntent: 'exact_command',
        confidence: 1.0,
        extractedEntities: { exactText: exactContent },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'action_command',
        responseFormat: 'exact',
        exactOutputRequested: true,
        exactText: exactContent,
        detailLevel: 'concise',
      };
    }

    // 2. DEVICE SECURITY / PASSCODE / SECRET PROTECTION
    if (
      /\b(what is my passcode|what is the passcode|give me the passcode|reveal passcode|what is my password|give me the password|reveal password|what is my pin|reveal pin|what is the api key|reveal api key|give me the secret|show secret token|bypass lock|bypass security)\b/i.test(
        rawLower
      )
    ) {
      return {
        primaryIntent: 'device_security',
        confidence: 0.99,
        extractedEntities: { action: 'block_sensitive_request' },
        suggestedTools: ['device_security'],
        requiresPlanning: false,
        riskLevel: 'high_risk',
        interactionType: 'action_command',
        responseFormat: 'exact',
      };
    }

    // 3. INCOMPLETE REQUESTS & CLARIFICATION GATES
    // YouTube incomplete
    if (
      /^(rodex,?\s*)?(please\s+)?(play on youtube|search on youtube|search youtube for|youtube search|watch on youtube|find on youtube|listen on youtube)$/i.test(
        rawLower
      ) ||
      /^(rodex,?\s*)?(play|search|watch)\s+(something|anything)\s+on\s+youtube$/i.test(rawLower)
    ) {
      return {
        primaryIntent: 'clarification_needed',
        confidence: 0.98,
        extractedEntities: { missingField: 'searchQuery', destinationType: 'youtube' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'ambiguous',
        isIncomplete: true,
        clarificationPrompt: 'What would you like me to search for or play on YouTube, Robert?',
        isFollowUp: resolution.isFollowUp,
        detailLevel,
      };
    }

    // Google search incomplete
    if (/^(rodex,?\s*)?(please\s+)?(search google for|google search for|search on google|look up on google)$/i.test(rawLower)) {
      return {
        primaryIntent: 'clarification_needed',
        confidence: 0.98,
        extractedEntities: { missingField: 'searchQuery', destinationType: 'google' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'ambiguous',
        isIncomplete: true,
        clarificationPrompt: 'What topic or question would you like me to search Google for, Robert?',
        isFollowUp: resolution.isFollowUp,
        detailLevel,
      };
    }

    // Open incomplete
    if (/^(rodex,?\s*)?(please\s+)?(open|launch|go to|visit|pull up|take me to|navigate to)$/i.test(rawLower)) {
      return {
        primaryIntent: 'clarification_needed',
        confidence: 0.95,
        extractedEntities: { missingField: 'targetUrl' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'ambiguous',
        isIncomplete: true,
        clarificationPrompt: 'Which website or application would you like me to open, Robert?',
        isFollowUp: resolution.isFollowUp,
        detailLevel,
      };
    }

    // Math incomplete
    if (/^(rodex,?\s*)?(please\s+)?(calculate|compute|convert|work out|solve)$/i.test(rawLower)) {
      return {
        primaryIntent: 'clarification_needed',
        confidence: 0.95,
        extractedEntities: { missingField: 'expression' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'ambiguous',
        isIncomplete: true,
        clarificationPrompt: 'What mathematical calculation or unit conversion should I compute?',
        isFollowUp: resolution.isFollowUp,
        detailLevel,
      };
    }

    // 4. IMAGE INTELLIGENCE: GENERATION, EDITING, TRANSFORMATION & UNDERSTANDING
    // A. Image Editing / Object Removal / Background Change / Lighting
    // e.g. "edit this image and remove the background", "remove the tree", "remove the two leaves", "make the sky brighter", "add a realistic giraffe to the background", "change the background to a modern office"
    const isImageEditCommand =
      /\b(remove (the )?background|remove (the )?[a-zA-Z\s]+ from (it|this image|the image)|remove the (tree|leaves|two leaves|car|person|clouds|watermark)|add (a |an |some )?[a-zA-Z\s]+ to (it|this image|the image|the background)|make (it|this image|the sky|the lighting) brighter|change (the )?background to|replace (the )?[a-zA-Z\s]+ with|turn this image into|make it suitable for a poster|transform this image into|crop this image)\b/i.test(
        lower
      ) ||
      (resolution.isFollowUp &&
        /\b(add (farmers|people|trees|birds|a giraffe)|remove (the tree|the leaves)|brighter|into a poster|as a poster|cleaner background|more professional)\b/i.test(
          lower
        ));

    if (isImageEditCommand) {
      let action = 'edit';
      if (/remove (the )?background/i.test(lower)) {
        action = 'remove_background';
      } else if (/remove (the )?(tree|leaves|two leaves|[a-zA-Z\s]+)/i.test(lower) && !lower.includes('background')) {
        action = 'remove_object';
      } else if (/add (a |an |some )?[a-zA-Z\s]+ to/i.test(lower) || /add (farmers|giraffe|people|birds)/i.test(lower)) {
        action = 'add_object';
      } else if (/turn this image into|transform this image into|make it suitable for a poster|poster style/i.test(lower)) {
        action = 'style_transfer';
      }

      let ratio: '1:1' | '16:9' | '9:16' = '1:1';
      if (/poster|wallpaper|portrait|story|reel/i.test(lower)) {
        ratio = '9:16';
      } else if (/banner|youtube thumbnail|thumbnail|landscape|wide/i.test(lower)) {
        ratio = '16:9';
      }

      return {
        primaryIntent: 'image_intelligence',
        confidence: 0.96,
        extractedEntities: {
          action,
          prompt: rawText,
          aspectRatio: ratio,
          preserveRestOfImage: true,
        },
        suggestedTools: ['image_intelligence'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'action_command',
        responseFormat: 'normal',
        isFollowUp: resolution.isFollowUp,
        detailLevel: 'concise',
      };
    }

    // B. Image Generation: "create an image of...", "generate an image...", "generate a logo for...", "create a poster of...", "make a picture of..."
    const isImageGenCommand =
      /\b(create (an? |a )?image of|generate (an? |a )?image of|create (a |an )?picture of|generate (a |an )?picture of|draw (a |an )?picture of|create (a |an )?(logo|poster|wallpaper|illustration|thumbnail|youtube thumbnail|concept art|ui concept)|generate (a |an )?(logo|poster|wallpaper|illustration|thumbnail|branding material|artwork) for)\b/i.test(
        lower
      ) ||
      /^(rodex,?\s*)?(create|generate|make|draw)\s+(an? |a )?(image|picture|photo|illustration|logo|poster|artwork|wallpaper|thumbnail)\s+(of|for|about)\s+(.+)$/i.test(
        rawLower
      );

    if (isImageGenCommand) {
      let promptText = rawText
        .replace(/^(rodex,?\s*)?(please\s+)?(create|generate|make|draw)\s+(an? |a )?(image|picture|photo|illustration|logo|poster|artwork|wallpaper|thumbnail)\s+(of|for|about)\s+/i, '')
        .trim();

      if (!promptText || promptText === rawText) {
        promptText = rawText;
      }

      let ratio: '1:1' | '16:9' | '9:16' = '1:1';
      if (/poster|wallpaper|portrait|story|reel/i.test(lower)) {
        ratio = '9:16';
      } else if (/banner|youtube thumbnail|thumbnail|landscape|wide/i.test(lower)) {
        ratio = '16:9';
      }

      return {
        primaryIntent: 'image_intelligence',
        confidence: 0.98,
        extractedEntities: {
          action: 'generate',
          prompt: promptText,
          aspectRatio: ratio,
        },
        suggestedTools: ['image_intelligence'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'content_generation',
        responseFormat: 'normal',
        detailLevel: 'concise',
      };
    }

    // C. Image Analysis / Understanding: "explain this image", "what is in this photo", "describe this image", "analyze this image"
    const isImageAnalysisCommand =
      /\b(explain this image|describe this image|describe this picture|describe this photo|what is in this image|what is in this picture|what is in this photo|analyze this image|analyze the image|inspect this image|what do you see in this image)\b/i.test(
        lower
      );

    if (isImageAnalysisCommand) {
      return {
        primaryIntent: 'image_intelligence',
        confidence: 0.98,
        extractedEntities: {
          action: 'analyze',
          prompt: rawText,
        },
        suggestedTools: ['image_intelligence'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'content_generation',
        responseFormat: 'normal',
        detailLevel: 'normal',
      };
    }

    // 5. EMAIL OPERATIONS & EXACT RESPONSE CONTROL
    // Draft reply with exact user instruction:
    // e.g. "Reply to John with: I'll attend the meeting"
    // e.g. "Reply to John and tell him I'll come tomorrow at 10"
    // e.g. "Draft a reply to Sarah saying I'll come tomorrow at 10"
    const replyWithMatch =
      rawText.match(/(?:reply\s+(?:to\s+)?([a-zA-Z\s]+?)\s+(?:with|saying|and\s+tell\s+(?:him|her|them))[:\s]+)(.+)$/i) ||
      rawText.match(/(?:draft\s+(?:a\s+)?reply\s+(?:to\s+)?([a-zA-Z\s]+?)\s+(?:with|saying|and\s+tell\s+(?:him|her|them))[:\s]+)(.+)$/i) ||
      rawText.match(/(?:email\s+([a-zA-Z\s]+?)\s+(?:saying|and\s+tell\s+(?:him|her|them)|with)[:\s]+)(.+)$/i);

    if (replyWithMatch && replyWithMatch[1] && replyWithMatch[2]) {
      const recipient = replyWithMatch[1].trim();
      let replyContent = replyWithMatch[2].trim();
      // Remove surrounding quotes if present
      replyContent = replyContent.replace(/^["']|["']$/g, '');

      return {
        primaryIntent: 'email_operation',
        confidence: 0.98,
        extractedEntities: {
          action: 'draft_reply',
          recipient,
          senderQuery: recipient,
          replyContent,
        },
        suggestedTools: ['email_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // Send drafted email: "send it", "send the email", "send email", "send draft"
    if (/^(rodex,?\s*)?(please\s+)?(send it|send email|send the email|send draft|send this email|send message)$/i.test(rawLower)) {
      return {
        primaryIntent: 'email_operation',
        confidence: 0.99,
        extractedEntities: { action: 'send_email' },
        suggestedTools: ['email_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'confirmation_required',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // Check new emails: "check emails", "check for new emails", "do i have new emails", "unread emails"
    if (/\b(check emails|check for new emails|new emails|unread emails|any new emails|check my inbox|check inbox)\b/i.test(lower)) {
      return {
        primaryIntent: 'email_operation',
        confidence: 0.97,
        extractedEntities: { action: 'check_new' },
        suggestedTools: ['email_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
        responseFormat: 'concise',
        detailLevel: 'concise',
      };
    }

    // Read email from sender: "read email from John", "read Sarah's email", "read the latest email"
    const readEmailMatch = lower.match(/(?:read\s+(?:the\s+)?email\s+(?:from\s+)?([a-zA-Z\s]+)|read\s+([a-zA-Z]+)'s\s+email)/i);
    if (readEmailMatch && (readEmailMatch[1] || readEmailMatch[2])) {
      const sender = (readEmailMatch[1] || readEmailMatch[2]).trim();
      return {
        primaryIntent: 'email_operation',
        confidence: 0.96,
        extractedEntities: { action: 'read_email', senderQuery: sender },
        suggestedTools: ['email_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
        responseFormat: 'concise',
      };
    }

    // Summarize emails / list summaries
    if (/\b(summarize my emails|email summaries|list my emails|recent emails)\b/i.test(lower)) {
      return {
        primaryIntent: 'email_operation',
        confidence: 0.95,
        extractedEntities: { action: 'list_summaries' },
        suggestedTools: ['email_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
        detailLevel: 'concise',
      };
    }

    // Search emails: "search emails for meeting", "search emails from Alex"
    const searchEmailMatch = lower.match(/(?:search\s+emails?\s+(?:for|from|about)\s+(.+))/i);
    if (searchEmailMatch && searchEmailMatch[1]) {
      return {
        primaryIntent: 'email_operation',
        confidence: 0.95,
        extractedEntities: { action: 'search_emails', searchQuery: searchEmailMatch[1].trim() },
        suggestedTools: ['email_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
      };
    }

    // 5. CONTACTS ACCESS & CALLING
    // Find phone number: "find John's number", "what is John's phone number", "get Sarah's number"
    const phoneMatch = lower.match(/(?:find|what is|get)\s+([a-zA-Z\s]+?)'s\s+(?:phone\s+)?(?:number|phone)/i);
    if (phoneMatch && phoneMatch[1]) {
      return {
        primaryIntent: 'contacts_operation',
        confidence: 0.98,
        extractedEntities: { action: 'get_phone', nameQuery: phoneMatch[1].trim() },
        suggestedTools: ['contacts_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'info_request',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // Call contact: "call John", "call Sarah Nalubega", "dial David"
    const callMatch = lower.match(/^(?:rodex,?\s*)?(?:please\s+)?(?:call|dial|phone)\s+([a-zA-Z\s]+)$/i);
    if (callMatch && callMatch[1]) {
      return {
        primaryIntent: 'contacts_operation',
        confidence: 0.98,
        extractedEntities: { action: 'initiate_call', nameQuery: callMatch[1].trim() },
        suggestedTools: ['contacts_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // Find email from contacts: "find Sarah's email", "what is John's email"
    const contactEmailMatch = lower.match(/(?:find|what is|get)\s+([a-zA-Z\s]+?)'s\s+email/i);
    if (contactEmailMatch && contactEmailMatch[1]) {
      return {
        primaryIntent: 'contacts_operation',
        confidence: 0.97,
        extractedEntities: { action: 'get_email', nameQuery: contactEmailMatch[1].trim() },
        suggestedTools: ['contacts_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'info_request',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // General contacts search: "find contact John", "search contacts for Sarah"
    if (/\b(search contacts|find contact|contacts list|my contacts)\b/i.test(lower)) {
      const q = lower.replace(/\b(search contacts|find contact|for|my contacts|contacts list)\b/gi, '').trim();
      return {
        primaryIntent: 'contacts_operation',
        confidence: 0.94,
        extractedEntities: { action: q ? 'search' : 'list_recent', nameQuery: q },
        suggestedTools: ['contacts_service'],
        requiresPlanning: true,
        riskLevel: 'elevated',
        interactionType: 'action_command',
        detailLevel: 'concise',
      };
    }

    // 6. OPEN URL & DESTINATION BROWSING
    // Strict concise command e.g. "Open YouTube", "Open Gmail", "Open Spotify", "Open Google"
    if (
      /^(rodex,?\s*)?(please\s+)?(open|launch|go to|visit)\s+(youtube|google|gmail|spotify|github|twitter|x\.com|wikipedia|reddit|claude|gemini|openai)(\s+website|\s+app)?$/i.test(
        rawLower
      )
    ) {
      const match = rawLower.match(/(?:open|launch|go to|visit)\s+([a-z0-9.]+)/i);
      const target = match ? match[1].toLowerCase() : 'youtube';
      let targetUrl = 'https://www.youtube.com';
      let label = 'YouTube';

      if (target.includes('google')) {
        targetUrl = 'https://www.google.com';
        label = 'Google';
      } else if (target.includes('gmail')) {
        targetUrl = 'https://mail.google.com';
        label = 'Gmail';
      } else if (target.includes('spotify')) {
        targetUrl = 'https://open.spotify.com';
        label = 'Spotify';
      } else if (target.includes('github')) {
        targetUrl = 'https://github.com';
        label = 'GitHub';
      } else if (target.includes('twitter') || target.includes('x.com')) {
        targetUrl = 'https://x.com';
        label = 'X';
      } else if (target.includes('wikipedia')) {
        targetUrl = 'https://en.wikipedia.org';
        label = 'Wikipedia';
      }

      return {
        primaryIntent: 'open_url',
        confidence: 0.99,
        extractedEntities: { targetUrl, label, actionType: 'open_website' },
        suggestedTools: ['open_approved_url'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'action_command',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // YouTube search commands e.g. "play <song> on youtube", "search youtube for <query>"
    const ytMatch =
      lower.match(/(?:search\s+youtube\s+for|search\s+on\s+youtube\s+for|play\s+on\s+youtube|watch\s+on\s+youtube|youtube\s+search\s+for|find\s+on\s+youtube)\s+(.+)$/i) ||
      lower.match(/(?:play|watch|find)\s+(.+?)\s+on\s+youtube$/i);
    if (ytMatch && ytMatch[1]) {
      const query = ytMatch[1].trim();
      return {
        primaryIntent: 'open_url',
        confidence: 0.98,
        extractedEntities: {
          targetUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          label: `YouTube (${query})`,
          actionType: 'search_youtube',
          searchQuery: query,
        },
        suggestedTools: ['open_approved_url'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'action_command',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // 7. WEATHER: "Tell me the weather", "What is the weather in Kampala"
    if (/\b(weather|temperature|forecast|is it raining|climate)\b/i.test(lower)) {
      const locMatch = lower.match(/(?:in|for|at)\s+([a-zA-Z\s]+)$/i);
      const location = locMatch ? locMatch[1].trim() : 'Kampala';
      return {
        primaryIntent: 'weather',
        confidence: 0.98,
        extractedEntities: { location, days: 1 },
        suggestedTools: ['get_weather_forecast'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'info_request',
        detailLevel: 'concise',
      };
    }

    // 8. MATH & COMPUTATION
    // Direct math expressions e.g. "125 * 8", "what is 15% of 850", "sqrt(144) + 2^5"
    const mathPattern = /^(?:what\s+is\s+|calculate\s+|compute\s+|solve\s+)?(?:[\d.,]+(?:\s*[+\-*/^%]\s*[\d.,]+)+|sqrt\(\d+\)|[\d.]+\s*(?:km|miles|kg|lbs|celsius|fahrenheit)\s+to\s+[a-z]+|\d+%\s+of\s+\d+)$/i;
    if (mathPattern.test(rawLower.replace(/,/g, '')) || /\b(calculate|compute|math|what is \d+ \+ \d+)\b/i.test(lower)) {
      const expr = rawText.replace(/^(?:what is|calculate|compute|solve|work out|evaluate)\s+/i, '').replace(/\?$/, '').trim();
      return {
        primaryIntent: 'calculate_compute',
        confidence: 0.98,
        extractedEntities: { expression: expr || rawText },
        suggestedTools: ['calculate_compute'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'action_command',
        responseFormat: responseFormat === 'numeric_only' ? 'numeric_only' : 'exact',
        detailLevel: 'concise',
      };
    }

    // 9. DATE & TIME
    if (/\b(what time is it|current time|what is the time|today's date|what date is it|what day is it)\b/i.test(lower)) {
      const tzMatch = lower.match(/(?:in|for)\s+([a-zA-Z/_]+)$/i);
      const targetTimeZone = tzMatch ? tzMatch[1].trim() : 'Africa/Kampala';
      return {
        primaryIntent: 'datetime_timezone',
        confidence: 0.99,
        extractedEntities: { targetTimeZone },
        suggestedTools: ['datetime_timezone'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'info_request',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // 10. MEDIA & SPOTIFY CONTROLS
    if (
      /\b(play music|pause music|skip song|next song|previous song|spotify volume|stop music|resume music)\b/i.test(lower)
    ) {
      let action = 'play';
      if (lower.includes('pause') || lower.includes('stop')) action = 'pause';
      else if (lower.includes('next') || lower.includes('skip')) action = 'next';
      else if (lower.includes('previous') || lower.includes('last')) action = 'previous';
      else if (lower.includes('resume')) action = 'play';

      return {
        primaryIntent: 'media_control',
        confidence: 0.98,
        extractedEntities: { action },
        suggestedTools: ['media_control'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'action_command',
        responseFormat: 'exact',
        detailLevel: 'concise',
      };
    }

    // 11. CREATOR INQUIRY
    if (/\b(who created you|who is your founder|who developed you|who made you|who is robert|who is mubiru robert)\b/i.test(lower)) {
      return {
        primaryIntent: 'creator_inquiry',
        confidence: 0.99,
        extractedEntities: { creatorName: 'Mubiru Robert' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'info_request',
        detailLevel: 'concise',
      };
    }

    // 12. TOORO KINGDOM KNOWLEDGE
    if (/\b(tooro kingdom|toro kingdom|king oyo|omukama oyo|fort portal|queen best kemigisa|princess komuntale|kijanangoma)\b/i.test(lower)) {
      return {
        primaryIntent: 'cultural_knowledge',
        confidence: 0.98,
        extractedEntities: { topic: 'Kingdom of Tooro' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'info_request',
        detailLevel,
      };
    }

    // 13. CONTENT GENERATION REQUESTS
    if (/\b(write an email to|compose a|write a story|write a poem|draft a letter|generate a summary)\b/i.test(lower)) {
      return {
        primaryIntent: 'general_knowledge',
        confidence: 0.95,
        extractedEntities: { contentType: 'generated_text' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
        interactionType: 'content_generation',
        detailLevel,
      };
    }

    // 14. WEB SEARCH / INFORMATION REQUESTS
    if (
      /\b(who is|what is|how to|why does|latest news|breaking news|current events|price of|weather in|search for)\b/i.test(lower)
    ) {
      return {
        primaryIntent: 'web_search',
        confidence: 0.92,
        extractedEntities: { query: text },
        suggestedTools: ['web_search'],
        requiresPlanning: true,
        riskLevel: 'safe',
        interactionType: 'info_request',
        detailLevel,
      };
    }

    // 15. DEFAULT CONVERSATIONAL
    return {
      primaryIntent: 'conversational',
      confidence: 0.9,
      extractedEntities: {},
      suggestedTools: [],
      requiresPlanning: false,
      riskLevel: 'safe',
      interactionType: 'conversation',
      responseFormat,
      detailLevel,
    };
  }
}
