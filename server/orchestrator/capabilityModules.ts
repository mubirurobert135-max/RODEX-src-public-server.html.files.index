import { CapabilityDomain } from './types';

export class CapabilityRegistry {
  private static domains: CapabilityDomain[] = [
    {
      id: 'image_intelligence',
      name: 'Image Intelligence & Multimodal Vision',
      tagline: 'Natural-language image creation, region-aware editing, object removal, and style transformation',
      description:
        'Generates creative artwork, logos, YouTube thumbnails, posters, and graphics. Edits existing images with region preservation, object removal/addition, background changes, and lighting enhancements with conversational memory.',
      icon: 'ImageIcon',
      status: 'active',
      version: '3.1.0',
      tools: ['image_intelligence'],
      features: [
        'Natural-Language Image Generation (Logos, Posters, Art, UI/UX)',
        'Region-Preserving Image Editing & Inpainting',
        'Object Removal (e.g. "remove the tree", "remove the two leaves")',
        'Object Addition & Placement (e.g. "add a giraffe to background", "add farmers")',
        'Conversational Multi-Turn Image Memory Continuity',
        'Style Transfer & Professional Poster Transforms',
      ],
      subsystems: [
        { name: 'Gemini 3.1 Flash Image Engine', status: 'active', description: 'High-fidelity image generation and editing' },
        { name: 'Visual Understanding Parser', status: 'active', description: 'Semantic segmentation and object isolation' },
        { name: 'Active Image Context Memory', status: 'active', description: 'Binds iterative edits across conversational turns' },
      ],
    },
    {
      id: 'intelligence_reasoning',
      name: 'Intelligence & Reasoning Core',
      tagline: 'High-rigor cognitive deduction, task decomposition, and logical synthesis',
      description:
        'Analyzes complex requests, breaks multi-step problems into solvable phases, compares options systematically, and produces precise, verified answers without filler tokens.',
      icon: 'Brain',
      status: 'active',
      version: '3.7.0',
      tools: ['calculate_compute', 'datetime_timezone', 'system_info', 'read_permitted_file'],
      features: [
        'Multi-Criteria Comparative Analysis',
        'Mathematical & Quantitative Precision Engine',
        'Complex Task Phased Decomposition',
        'Contextual Pronoun and Follow-up Resolution',
        'Exact Output Mode Enforcement',
      ],
      subsystems: [
        { name: 'Reasoning Engine', status: 'active', description: 'Pre-generation cognitive framework selector' },
        { name: 'Intent Classifier', status: 'active', description: 'Deep NLP categorization & entity extraction' },
        { name: 'Chronometer Context Anchor', status: 'active', description: '2026 East Africa Time & UTC temporal sync' },
      ],
    },
    {
      id: 'long_term_memory',
      name: 'Long-Term Memory Engine',
      tagline: 'Persistent, searchable, user-controlled cognitive recall',
      description:
        'Retains past conversations, user preferences, active projects, custom instructions, and deliberate user facts. Controlled, encrypted, editable, and private to Robert.',
      icon: 'Database',
      status: 'active',
      version: '2.4.0',
      tools: ['manage_user_memory'],
      features: [
        'Semantic & Keyword Memory Search',
        'Creator & Personalization Fact Injection',
        'Ongoing Project Context Tracking',
        'Multi-Turn Conversation State Sync',
        'Zero-Leakage Private Data Vault',
      ],
      subsystems: [
        { name: 'Context Memory Manager', status: 'active', description: 'Session-level multi-turn continuity' },
        { name: 'Disk Persistence Vault', status: 'active', description: '.rodex_memory.json secure local storage' },
        { name: 'Profile Synthesizer', status: 'active', description: 'User tone and workflow preference model' },
      ],
    },
    {
      id: 'device_interaction',
      name: 'Device & Application Bridge',
      tagline: 'Android platform bridge, app triggers, and hardware controls',
      description:
        'Controls device functions, opens applications, launches verified web portals, and interfaces with Android platform capabilities without compromising phone security.',
      icon: 'Smartphone',
      status: 'active',
      version: '2.1.0',
      tools: ['open_approved_url', 'app_action', 'platform_bridge', 'media_control'],
      features: [
        'Spotify PC Remote Controller & Volume',
        'Android App Launch & Intent Dispatcher',
        'Web Media Streaming Hub',
        'Flutter Android Native Bridge Protocol',
        'Hardware State & Sensor Polling',
      ],
      subsystems: [
        { name: 'Spotify Web API Client', status: 'active', description: 'PC playback and device sync' },
        { name: 'Android Intent Dispatcher', status: 'active', description: 'Safe URL and app URI schemes' },
        { name: 'Platform Capability Matrix', status: 'active', description: 'Host environment inspection' },
      ],
    },
    {
      id: 'communication_messaging',
      name: 'Communication & Contacts Engine',
      tagline: 'Authorized calling, SMS, WhatsApp dispatch, and contacts lookup',
      description:
        'Accesses permitted contacts, looks up verified phone numbers and emails, and prepares calls or WhatsApp messages with strict user confirmation before dispatch.',
      icon: 'Phone',
      status: 'active',
      version: '2.0.0',
      tools: ['contacts_service'],
      features: [
        'Android Contact Search by Name & Relation (e.g. Sis Rose, Dr. Grace)',
        'Phone Call Preparation (tel: protocol with prompt)',
        'WhatsApp Direct Message Composer',
        'SMS Preparation & Text Integrity Verification',
        'Granular Contact Permission Guard',
      ],
      subsystems: [
        { name: 'Contacts Resolver', status: 'active', description: 'Fuzzy match across authorized contacts' },
        { name: 'Communication Validator', status: 'active', description: 'Ensures zero hallucinated phone numbers' },
      ],
    },
    {
      id: 'email_hub',
      name: 'Secure Email & Reply Hub',
      tagline: 'Authorized inbox reading, search, summarization, and exact reply drafting',
      description:
        'Interacts with authorized email services to check inbox, read sender & subject, summarize message threads, draft exact replies matching user instructions, and send with approval.',
      icon: 'Mail',
      status: 'active',
      version: '2.0.0',
      tools: ['email_service'],
      features: [
        'Check Unread & Recent Emails',
        'Search Messages by Sender or Topic',
        'Thread Summarization & Key Point Extraction',
        'Strict Instruction Reply Drafting (zero invented commitments)',
        'Explicit Confirmation Gate for Outgoing Emails',
      ],
      subsystems: [
        { name: 'Email Parser & Sanitizer', status: 'active', description: 'Strips malicious payloads & HTML' },
        { name: 'Reply Synthesis Guard', status: 'active', description: 'Guarantees fidelity to user instructions' },
      ],
    },
    {
      id: 'web_global_knowledge',
      name: 'World Wide Web & Cultural Intel',
      tagline: 'Real-time Google search grounding, citations, and Ugandan cultural heritage',
      description:
        'Streams live global intelligence with citations and domain sources. Deeply grounded in Ugandan heritage, including the Kingdom of Tooro and contemporary 2026 events.',
      icon: 'Globe',
      status: 'active',
      version: '3.1.0',
      tools: ['web_search', 'get_weather_forecast'],
      features: [
        'Google Global Index Grounding with Citations',
        'Kingdom of Tooro Royal History & 2026 Succession Intelligence',
        'Live Global Weather & Multi-Day Forecasts',
        'Financial Market Highlights & Breaking Tech Streams',
      ],
      subsystems: [
        { name: 'Google Grounding Module', status: 'active', description: 'Real-time verified source attribution' },
        { name: 'Cultural Knowledge Bank', status: 'active', description: 'Uganda & East Africa factual repository' },
      ],
    },
    {
      id: 'automation_multistep',
      name: 'Multi-Step Automation & Compound Planner',
      tagline: 'Compound instruction planning, step dependency graphs, and orchestrated execution',
      description:
        'Transforms compound user instructions into structured execution graphs. Sequences multi-tool workflows (e.g. check email -> summarize -> draft reply -> verify).',
      icon: 'Layers',
      status: 'active',
      version: '2.5.0',
      tools: ['app_action', 'email_service', 'contacts_service', 'manage_user_memory', 'web_search'],
      features: [
        'Compound Query Deconstruction (e.g. "Find Rose, open WhatsApp, tell her...")',
        'Multi-Step Execution Pipeline with Status Badges',
        'Intermediate Result Passing Between Tools',
        'Fast-Path Direct Passthrough for Deterministic Workflows',
      ],
      subsystems: [
        { name: 'Task Planner', status: 'active', description: 'Builds phased tool execution plans' },
        { name: 'Step Dependency Orchestrator', status: 'active', description: 'Binds step outputs to successor inputs' },
      ],
    },
    {
      id: 'security_permission_gate',
      name: 'Zero-Disclosure Security & Privacy Gate',
      tagline: 'Hardware passcode shield, zero-credential disclosure, and granular permissions',
      description:
        'Guarantees that sensitive secrets, device passcodes, PINs, or API keys are never exposed. Enforces strict authorization before high-risk actions are performed.',
      icon: 'Shield',
      status: 'active',
      version: '3.0.0',
      tools: ['device_security'],
      features: [
        'Absolute Block of Device Passcode / PIN Leakage Queries',
        'Granular Permission Manager (Mic, Contacts, Email, Hardware)',
        'Zero Autonomous Monetary or Destructive Actions',
        'Live Threat Monitoring & Anomaly Detection',
      ],
      subsystems: [
        { name: 'Device Security Guard', status: 'active', description: 'Intercepts credential requests instantly' },
        { name: 'Permission Enforcement Layer', status: 'active', description: 'Validates user elevation before execution' },
      ],
    },
  ];

  public static getAllDomains(): CapabilityDomain[] {
    return this.domains;
  }

  public static getDomain(id: string): CapabilityDomain | undefined {
    return this.domains.find((d) => d.id === id);
  }

  public static getSystemOverview() {
    return {
      systemName: 'RODEX Multi-Capability AI System',
      architecture: 'Central AI Brain with Extensible Capability Domains',
      version: '3.7.0',
      totalDomains: this.domains.length,
      activeDomains: this.domains.filter((d) => d.status === 'active').length,
      domains: this.domains,
    };
  }
}
