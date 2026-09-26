export interface ReasoningAnalysisResult {
  taskType: 'programming' | 'math' | 'concept_explanation' | 'comparative_analysis' | 'planning' | 'troubleshooting' | 'general';
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedFramework: string;
  recommendedSteps: string[];
  requiresTool: boolean;
  toolRecommendation?: string;
  missingInformationIdentified?: string[];
  executionGuidance: string;
}

export class ReasoningEngine {
  /**
   * Performs pre-generation cognitive analysis to guide the model toward
   * high-rigor problem-solving without exposing raw chain-of-thought to the user.
   */
  public static analyzeTask(query: string): ReasoningAnalysisResult {
    const text = query.trim();
    const lower = text.toLowerCase();

    // 1. Comparative Option Analysis (Evaluated first to catch queries like "Compare React and Flutter")
    if (
      /\b(compare|versus|vs|pros and cons|difference between|which is better|evaluate options)\b/i.test(lower)
    ) {
      return {
        taskType: 'comparative_analysis',
        complexity: 'moderate',
        suggestedFramework: 'Multi-Criteria Decision Analysis',
        recommendedSteps: [
          'Establish objective evaluation dimensions (e.g. performance, cost, maintainability)',
          'Assess each option factually against these criteria',
          'Provide trade-off matrix or structured side-by-side comparison',
          'Deliver an actionable recommendation based on context',
        ],
        requiresTool: false,
        executionGuidance:
          'Use clear comparison tables or bullet criteria. Avoid bias; state concrete trade-offs clearly.',
      };
    }

    // 2. Programming & Software Engineering Tasks
    if (
      /\b(code|function|class|bug|debug|algorithm|typescript|javascript|react|python|css|html|api|database|sql|docker|git|refactor|optimize code)\b/i.test(
        lower
      )
    ) {
      return {
        taskType: 'programming',
        complexity: lower.includes('architect') || lower.includes('system design') ? 'complex' : 'moderate',
        suggestedFramework: 'Clean Code, Architectural Robustness, and Production-Ready Standards',
        recommendedSteps: [
          'Understand requirements and edge cases',
          'Select optimal algorithmic approach or design pattern',
          'Produce clean, type-safe, maintainable implementation',
          'Highlight verification and error handling',
        ],
        requiresTool: false,
        executionGuidance:
          'Provide production-ready code blocks, type definitions, and concise architectural explanations. Focus on readability and real-world edge cases.',
      };
    }

    // 3. Mathematical & Quantitative Reasoning
    if (
      /\b(math|equation|calculate|compute|solve|algebra|probability|statistics|integral|derivative|geometry|matrix|formula)\b/i.test(
        lower
      ) ||
      /\b(\d+\s*[\+\-\*\/]\s*\d+)/.test(text)
    ) {
      const isSimpleArithmetic = /^(\d+\s*[\+\-\*\/]\s*\d+)$/.test(text.trim());
      return {
        taskType: 'math',
        complexity: isSimpleArithmetic ? 'simple' : 'moderate',
        suggestedFramework: 'Formal Quantitative Deduction',
        recommendedSteps: [
          'Identify known variables and target solution',
          'Formulate mathematical equations',
          'Calculate precisely with verification',
          'Present exact value followed by concise explanation',
        ],
        requiresTool: isSimpleArithmetic,
        toolRecommendation: isSimpleArithmetic ? 'calculate_compute' : undefined,
        executionGuidance:
          'State the verified final value clearly, followed by structured steps showing how it was calculated.',
      };
    }

    // 4. Strategic Planning & Step Breakdown
    if (
      /\b(plan|how to build|roadmap|step by step guide|strategy for|implementation steps|architecture plan)\b/i.test(
        lower
      )
    ) {
      return {
        taskType: 'planning',
        complexity: 'complex',
        suggestedFramework: 'Phased Project Execution Roadmap',
        recommendedSteps: [
          'Phase 1: Foundation & Prerequisites',
          'Phase 2: Core Implementation & Integration',
          'Phase 3: Hardening, Security & Verification',
          'Phase 4: Deployment & Scaling',
        ],
        requiresTool: false,
        executionGuidance:
          'Organize into chronological, actionable phases. Include concrete milestones and risk mitigation.',
      };
    }

    // 5. Concept Explanation
    if (
      /\b(explain|what is|how does.*work|deep dive|teach me|concept of|demystify)\b/i.test(lower)
    ) {
      return {
        taskType: 'concept_explanation',
        complexity: 'moderate',
        suggestedFramework: 'First Principles Conceptual Clarity',
        recommendedSteps: [
          'Intuitive high-level summary / executive overview',
          'First-principles mechanical explanation of how it works',
          'Concrete real-world example or analogy',
          'Key takeaways and practical implications',
        ],
        requiresTool: false,
        executionGuidance:
          'Start with an intuitive summary, then dive into the core mechanics with clarity and rigor.',
      };
    }

    return {
      taskType: 'general',
      complexity: 'simple',
      suggestedFramework: 'Direct Intellectual Delivery',
      recommendedSteps: ['Synthesize accurate answer', 'Validate facts'],
      requiresTool: false,
      executionGuidance: 'Provide a direct, authoritative, and helpful answer for Mr. Robert.',
    };
  }

  /**
   * Builds high-level guidance for prompt injection
   */
  public static getPromptGuidance(analysis: ReasoningAnalysisResult): string {
    return `REASONING DIRECTIVE (${analysis.taskType.toUpperCase()}):
- Approach: ${analysis.suggestedFramework}
- Structure: ${analysis.recommendedSteps.join(' -> ')}
- Delivery: ${analysis.executionGuidance}
Provide the final structured reasoning clearly without dumping internal chain-of-thought tokens.`;
  }
}
