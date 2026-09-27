import { IntentClassifier } from './orchestrator/intentClassifier';
import { globalToolRegistry } from './orchestrator/registry';
import { globalOrchestrator } from './orchestrator/orchestrator';
import { ReasoningEngine } from './orchestrator/reasoningEngine';
import { globalMemoryService } from './orchestrator/memoryService';
import { globalUserProfile } from './orchestrator/userProfile';
import { globalAIProvider } from './orchestrator/aiProvider';

async function runTests() {
  console.log('=== RUNNING RODEX INTELLIGENCE ORCHESTRATOR & TOOL SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // --- SECTION 1: INTENT CLASSIFICATION ---
  console.log('1. Testing Intent Classification...');
  
  const creatorIntent = IntentClassifier.classify('Who is your creator and who developed RODEX?');
  assert(creatorIntent.primaryIntent === 'creator_inquiry', 'Identifies Creator Inquiry', creatorIntent.primaryIntent);

  const mathIntent = IntentClassifier.classify('Calculate 250 * 4.5');
  assert(mathIntent.primaryIntent === 'calculate_compute', 'Identifies Math Calculation', mathIntent.primaryIntent);
  assert(mathIntent.suggestedTools.includes('calculate_compute'), 'Suggests calculate_compute tool');

  const timeIntent = IntentClassifier.classify('What time is it in Uganda?');
  assert(timeIntent.primaryIntent === 'datetime_timezone', 'Identifies Datetime/Timezone', timeIntent.primaryIntent);
  assert(timeIntent.extractedEntities.targetTimeZone === 'Africa/Kampala', 'Extracts Africa/Kampala timezone');

  const sysIntent = IntentClassifier.classify('Check system memory and health');
  assert(sysIntent.primaryIntent === 'system_info', 'Identifies System Info', sysIntent.primaryIntent);

  const fileIntent = IntentClassifier.classify('Inspect package.json');
  assert(fileIntent.primaryIntent === 'file_inspection', 'Identifies File Inspection', fileIntent.primaryIntent);

  const spotifyIntent = IntentClassifier.classify('Play music on Spotify');
  assert(spotifyIntent.primaryIntent === 'media_control', 'Identifies Spotify Media Intent', spotifyIntent.primaryIntent);

  const appActionIntent = IntentClassifier.classify('Open settings');
  assert(appActionIntent.primaryIntent === 'app_action', 'Identifies App Action', appActionIntent.primaryIntent);

  const youtubeIntent = IntentClassifier.classify('RODEX, open YouTube');
  assert(youtubeIntent.primaryIntent === 'open_url', 'Identifies YouTube Open Intent', youtubeIntent.primaryIntent);
  assert(youtubeIntent.extractedEntities.targetUrl === 'https://www.youtube.com', 'Sets YouTube URL');

  const ytSongIntent = IntentClassifier.classify('RODEX, play Bohemian Rhapsody on YouTube');
  assert(ytSongIntent.primaryIntent === 'open_url', 'Identifies YouTube Song Play Intent', ytSongIntent.primaryIntent);
  assert(ytSongIntent.extractedEntities.actionType === 'youtube_search', 'Identifies YouTube Search Action');
  assert(ytSongIntent.extractedEntities.searchQuery === 'Bohemian Rhapsody', 'Extracts YouTube Song Query');
  assert(ytSongIntent.extractedEntities.targetUrl.includes('search_query=Bohemian%20Rhapsody'), 'Constructs Safe YouTube Search URL');

  const googleIntent = IntentClassifier.classify('Open Google');
  assert(googleIntent.primaryIntent === 'open_url', 'Identifies Google Open Intent', googleIntent.primaryIntent);
  assert(googleIntent.extractedEntities.targetUrl === 'https://www.google.com', 'Sets Google URL');

  const highRiskIntent = IntentClassifier.classify('Clear all chat history');
  assert(highRiskIntent.riskLevel === 'high_risk', 'Flags Clear History as High Risk', highRiskIntent.riskLevel);

  // --- SECTION 2: TOOL REGISTRY & VALIDATION ---
  console.log('\n2. Testing Tool Registry & Schemas...');

  const registeredTools = globalToolRegistry.listTools();
  assert(registeredTools.length >= 7, `Tool Registry has registered tools (count: ${registeredTools.length})`);
  assert(globalToolRegistry.has('calculate_compute'), 'calculate_compute registered');
  assert(globalToolRegistry.has('datetime_timezone'), 'datetime_timezone registered');
  assert(globalToolRegistry.has('system_info'), 'system_info registered');
  assert(globalToolRegistry.has('read_permitted_file'), 'read_permitted_file registered');
  assert(globalToolRegistry.has('media_control'), 'media_control registered');
  assert(globalToolRegistry.has('app_action'), 'app_action registered');

  // Parameter validation
  const calcDef = globalToolRegistry.get('calculate_compute')!;
  const invalidParams = globalToolRegistry.validateParameters(calcDef, {});
  assert(!invalidParams.valid, 'Rejects missing required expression parameter');

  const validParams = globalToolRegistry.validateParameters(calcDef, { expression: '10 + 20' });
  assert(validParams.valid, 'Accepts valid expression parameter');

  // --- SECTION 3: TOOL EXECUTION & SECURITY CHECKS ---
  console.log('\n3. Testing Individual Tool Execution & Guardrails...');

  // 3a. Calculate Tool
  const mathRes1 = await globalToolRegistry.executeTool('calculate_compute', { expression: '125 * 8' });
  assert(mathRes1.success && mathRes1.output.value === 1000, 'Computes 125 * 8 = 1000', JSON.stringify(mathRes1));

  const mathRes2 = await globalToolRegistry.executeTool('calculate_compute', { expression: 'sqrt(144) + 2^4' });
  assert(mathRes2.success && mathRes2.output.value === 28, 'Computes sqrt(144) + 2^4 = 28', JSON.stringify(mathRes2));

  const unitRes = await globalToolRegistry.executeTool('calculate_compute', { expression: '10 km to miles' });
  assert(unitRes.success && unitRes.output.unit === 'miles', 'Converts 10 km to miles', JSON.stringify(unitRes));

  // 3b. Datetime Tool
  const dtRes = await globalToolRegistry.executeTool('datetime_timezone', { targetTimeZone: 'Africa/Kampala' });
  assert(dtRes.success && dtRes.output.year === 2026, 'Anchors year in 2026 for Africa/Kampala', JSON.stringify(dtRes));

  const badDtRes = await globalToolRegistry.executeTool('datetime_timezone', { targetTimeZone: 'Invalid/Zone_XYZ' });
  assert(!badDtRes.success && !!badDtRes.error, 'Catches and reports invalid timezone gracefully');

  // 3c. System Info Tool
  const sysRes = await globalToolRegistry.executeTool('system_info', { category: 'overview' });
  assert(sysRes.success && sysRes.output.status === 'OPERATIONAL', 'Retrieves system operational status');

  // 3d. File Reader Tool & Security Guardrails
  const fileRes = await globalToolRegistry.executeTool('read_permitted_file', { filePath: 'package.json' });
  assert(fileRes.success && fileRes.output.totalLines > 0, 'Safely reads package.json');

  // Path traversal test
  const traversalRes = await globalToolRegistry.executeTool('read_permitted_file', { filePath: '../../../../etc/passwd' });
  assert(!traversalRes.success, 'Blocks path traversal attempt (../../../../etc/passwd)');

  // Secret file test
  const secretRes = await globalToolRegistry.executeTool('read_permitted_file', { filePath: '.env' });
  assert(!secretRes.success, 'Blocks access to .env secret configuration file');

  // 3e. App Action & High-Risk Confirmation
  const appRes = await globalToolRegistry.executeTool('app_action', { action: 'open_settings' });
  assert(appRes.success && appRes.output.action === 'open_settings', 'Executes safe app_action (open_settings)');

  // 3f. Open URL Tool (YouTube and Web opening)
  const ytToolRes = await globalToolRegistry.executeTool('open_approved_url', {
    url: 'https://www.youtube.com',
    label: 'YouTube',
    actionType: 'open_website',
  });
  assert(ytToolRes.success && ytToolRes.output.domain === 'youtube.com', 'Executes open_approved_url for YouTube');
  assert(ytToolRes.message === 'Opening YouTube now.', 'Returns spoken phrase "Opening YouTube now."');

  const ytSearchToolRes = await globalToolRegistry.executeTool('open_approved_url', {
    actionType: 'youtube_search',
    searchQuery: 'Adele Easy On Me',
  });
  assert(ytSearchToolRes.success && ytSearchToolRes.output.url.includes('search_query=Adele%20Easy%20On%20Me'), 'Constructs valid YouTube Search URL');
  assert(ytSearchToolRes.message?.includes('Searching YouTube for'), 'Returns spoken search confirmation');

  const destructiveRes = await globalToolRegistry.executeTool(
    'app_action',
    { action: 'clear_history' },
    { hasElevatedPermission: false }
  );
  assert(
    destructiveRes.requiresConfirmation === true,
    'Enforces confirmation for destructive clear_history without elevated permission'
  );

  // --- SECTION 4: FULL ORCHESTRATOR PIPELINE ---
  console.log('\n4. Testing Full Intelligence Orchestration Pipeline...');

  const orchMath = await globalOrchestrator.orchestrate({
    userInput: 'Calculate 50 * 12 + 100',
  });
  assert(orchMath.trace.intent.primaryIntent === 'calculate_compute', 'Orchestrates Math query intent');
  assert(orchMath.trace.validationPassed, 'Validates math execution output');
  assert(orchMath.reply.includes('700'), 'Returns accurate math calculation in reply', orchMath.reply);

  const orchTime = await globalOrchestrator.orchestrate({
    userInput: 'What is the current time in Uganda?',
  });
  assert(orchTime.trace.intent.primaryIntent === 'datetime_timezone', 'Orchestrates Time query intent');
  assert(orchTime.trace.validationPassed, 'Validates chronometer output');

  const orchSys = await globalOrchestrator.orchestrate({
    userInput: 'Check system health and status',
  });
  assert(orchSys.trace.intent.primaryIntent === 'system_info', 'Orchestrates System Info intent');
  assert(orchSys.trace.executedTools.length === 1, 'Records executed tool in trace');

  const orchYt = await globalOrchestrator.orchestrate({
    userInput: 'RODEX, open YouTube',
  });
  assert(orchYt.trace.intent.primaryIntent === 'open_url', 'Orchestrates YouTube Open intent');
  assert(orchYt.trace.executedTools.length === 1, 'Executes open_approved_url tool');
  assert(orchYt.reply === 'Opening YouTube now.', 'Returns spoken reply "Opening YouTube now."');

  const orchYtSong = await globalOrchestrator.orchestrate({
    userInput: 'RODEX, play Bohemian Rhapsody on YouTube',
  });
  assert(orchYtSong.trace.intent.primaryIntent === 'open_url', 'Orchestrates YouTube Song Play intent');
  assert(orchYtSong.trace.executedTools[0].result.output.url.includes('search_query=Bohemian%20Rhapsody'), 'Executes YouTube song search action');

  // --- SECTION 5: INTELLIGENT CONVERSATION, FOLLOW-UPS & CLARIFICATIONS ---
  console.log('\n5. Testing Intelligent Conversation, Diverse Phrasings, Follow-ups & Clarifications...');

  // 5a. Diverse ways of asking the same thing
  const altYt1 = IntentClassifier.classify('Pull up YouTube');
  assert(altYt1.primaryIntent === 'open_url', 'Diverse phrasing: "Pull up YouTube" -> open_url');

  const altYt2 = IntentClassifier.classify('Take me to YouTube');
  assert(altYt2.primaryIntent === 'open_url', 'Diverse phrasing: "Take me to YouTube" -> open_url');

  const altYt3 = IntentClassifier.classify('Stream Bohemian Rhapsody on YouTube');
  assert(altYt3.primaryIntent === 'open_url' && altYt3.extractedEntities.searchQuery === 'Bohemian Rhapsody', 'Diverse phrasing: "Stream Bohemian Rhapsody on YouTube"');

  const altCreator1 = IntentClassifier.classify('Who built RODEX?');
  assert(altCreator1.primaryIntent === 'creator_inquiry', 'Diverse phrasing: "Who built RODEX?" -> creator_inquiry');

  const altCreator2 = IntentClassifier.classify('Who is the author of RODEX?');
  assert(altCreator2.primaryIntent === 'creator_inquiry', 'Diverse phrasing: "Who is the author of RODEX?" -> creator_inquiry');

  const altMath1 = IntentClassifier.classify('How much is 45 * 20?');
  assert(altMath1.primaryIntent === 'calculate_compute', 'Diverse phrasing: "How much is 45 * 20?" -> calculate_compute');

  // 5b. Incomplete requests requiring clarification
  const incompleteYt = IntentClassifier.classify('RODEX, play on YouTube');
  assert(incompleteYt.primaryIntent === 'clarification_needed', 'Incomplete request: "play on YouTube" flags clarification_needed');
  assert(incompleteYt.isIncomplete === true, 'Flags isIncomplete: true');
  assert(incompleteYt.clarificationPrompt?.includes('YouTube'), 'Returns clarification prompt asking for song/video topic');

  const incompleteOpen = IntentClassifier.classify('RODEX, please open');
  assert(incompleteOpen.primaryIntent === 'clarification_needed', 'Incomplete request: "please open" flags clarification_needed');
  assert(incompleteOpen.clarificationPrompt?.includes('website or application'), 'Asks which website/app to open');

  const incompleteCalc = IntentClassifier.classify('Calculate');
  assert(incompleteCalc.primaryIntent === 'clarification_needed', 'Incomplete request: "Calculate" flags clarification_needed');

  const incompleteVol = IntentClassifier.classify('Set volume to');
  assert(incompleteVol.primaryIntent === 'clarification_needed', 'Incomplete request: "Set volume to" flags clarification_needed');

  // Test Orchestrator response on incomplete request
  const orchIncomplete = await globalOrchestrator.orchestrate({
    userInput: 'RODEX, play on YouTube',
  });
  assert(orchIncomplete.reply.includes('YouTube') && orchIncomplete.reply.includes('search for or play'), 'Orchestrator directly asks user for clarification instead of guessing', orchIncomplete.reply);

  // 5c. Follow-up answering a pending clarification
  // User answers previous incomplete YouTube clarification with the song name
  const clarificationAnswer = IntentClassifier.classify('Hotel California', [], 'default');
  assert(clarificationAnswer.primaryIntent === 'open_url', 'Answers clarification: "Hotel California" -> resolves to YouTube open_url');
  assert(clarificationAnswer.extractedEntities.searchQuery === 'Hotel California', 'Extracts answered query "Hotel California"');

  // 5d. Multi-turn conversation context & pronoun resolution
  const historyWithKingOyo = [
    { role: 'user', text: 'Tell me about King Oyo of Tooro' },
    { role: 'model', text: 'Omukama Oyo Nyimba Kabamba Iguru Rukidi IV was the King of Tooro Kingdom, Uganda. He passed away on August 27, 2026.' }
  ];
  const pronounFollowUp = IntentClassifier.classify('Who was his mother?', historyWithKingOyo);
  assert(pronounFollowUp.isFollowUp === true, 'Detects pronoun follow-up ("his") with history context');
  assert(pronounFollowUp.resolvedQuery?.includes('King Oyo'), 'Resolves pronoun "his" to King Oyo in context');

  // 5e. Detail level directives (concise vs detailed)
  const conciseQuery = IntentClassifier.classify('Briefly tell me what time it is in Tokyo');
  assert(conciseQuery.detailLevel === 'concise', 'Identifies concise detail directive');

  const detailedQuery = IntentClassifier.classify('Explain in detail the Tooro succession dispute');
  assert(detailedQuery.detailLevel === 'detailed', 'Identifies detailed in-depth directive');

  // 5f. Math follow-up continuation
  const historyWithMath = [
    { role: 'user', text: 'Calculate 25 * 4' },
    { role: 'model', text: '25 * 4 = 100' }
  ];
  const mathFollowUp = IntentClassifier.classify('Times 5', historyWithMath);
  assert(mathFollowUp.primaryIntent === 'calculate_compute', 'Resolves math follow-up "Times 5" to calculate_compute');
  assert(mathFollowUp.extractedEntities.expression?.includes('100') && mathFollowUp.extractedEntities.expression?.includes('5'), 'Incorporates prior result 100 into continuation (100 * 5)');

  // --- SECTION 6: ADVANCED AI REASONING ENGINE ---
  console.log('\n6. Testing Advanced AI Reasoning Engine...');

  const codingTask = ReasoningEngine.analyzeTask('Write a TypeScript function to debounce an async search API call');
  assert(codingTask.taskType === 'programming', 'Identifies programming task');
  assert(codingTask.suggestedFramework.includes('Clean Code'), 'Applies software engineering framework');

  const mathTask = ReasoningEngine.analyzeTask('Solve the equation 3x + 12 = 45');
  assert(mathTask.taskType === 'math', 'Identifies mathematical reasoning task');

  const comparisonTask = ReasoningEngine.analyzeTask('Compare React and Flutter for mobile development');
  assert(comparisonTask.taskType === 'comparative_analysis', 'Identifies comparative decision analysis');

  const planningTask = ReasoningEngine.analyzeTask('Create a step by step plan to build an Android AI personal assistant');
  assert(planningTask.taskType === 'planning', 'Identifies phased planning roadmap');

  const guidance = ReasoningEngine.getPromptGuidance(codingTask);
  assert(guidance.includes('REASONING DIRECTIVE') && guidance.includes('PROGRAMMING'), 'Builds clean prompt directive without exposing raw chain-of-thought');

  // --- SECTION 7: LONG-TERM MEMORY & SECURITY FILTER ---
  console.log('\n7. Testing Long-Term Memory & Security Boundaries...');

  // 7a. Storing normal factual memory
  const savedMem = await globalMemoryService.save({
    userId: 'Robert',
    category: 'preference',
    key: 'preferred_programming_language',
    value: 'TypeScript',
    confidence: 0.99,
    tags: ['coding', 'preference'],
  });
  assert(savedMem.id.startsWith('mem_'), 'Generates valid memory ID', savedMem.id);
  assert(savedMem.value === 'TypeScript', 'Saves memory value correctly');

  // 7b. Searching / Retrieving memory
  const searchResults = await globalMemoryService.search('Robert', { searchTerm: 'TypeScript' });
  assert(searchResults.length > 0 && searchResults[0].value === 'TypeScript', 'Retrieves stored memory by search term');

  // 7c. Security Filter: Rejecting passwords, API keys, credentials
  let secretBlocked = false;
  try {
    await globalMemoryService.save({
      userId: 'Robert',
      category: 'fact',
      key: 'my_password',
      value: 'SuperSecret123!',
      confidence: 1.0,
      tags: ['password'],
    });
  } catch (err: any) {
    secretBlocked = true;
  }
  assert(secretBlocked, 'Security filter blocks saving password as memory');

  let apiKeyBlocked = false;
  try {
    await globalMemoryService.save({
      userId: 'Robert',
      category: 'fact',
      key: 'gemini_api_key',
      value: 'sk-1234567890abcdef1234567890abcdef',
      confidence: 1.0,
      tags: ['api_key'],
    });
  } catch (err: any) {
    apiKeyBlocked = true;
  }
  assert(apiKeyBlocked, 'Security filter blocks saving API key as memory');

  // 7d. Memory Tool Execution via Tool Registry
  const memToolSave = await globalToolRegistry.executeTool('manage_user_memory', {
    action: 'save',
    key: 'city_of_residence',
    value: 'Kampala',
    category: 'profile',
  });
  assert(memToolSave.success && memToolSave.output.value === 'Kampala', 'manage_user_memory tool saves memory');

  const memToolSearch = await globalToolRegistry.executeTool('manage_user_memory', {
    action: 'search',
    searchTerm: 'Kampala',
  });
  assert(memToolSearch.success && memToolSearch.output.count > 0, 'manage_user_memory tool searches and finds memory');

  // 7e. Memory Intent Classification
  const memIntentSave = IntentClassifier.classify('RODEX, remember that my favorite framework is React');
  assert(memIntentSave.primaryIntent === 'memory_operation', 'Classifies "remember that" as memory_operation');
  assert(memIntentSave.extractedEntities.action === 'save', 'Extracts action: save');

  const memIntentRecall = IntentClassifier.classify('What do you remember about my preferences?');
  assert(memIntentRecall.primaryIntent === 'memory_operation', 'Classifies memory recall question as memory_operation');

  // 7f. Prompt Memory Context Generation
  const promptMemStr = await globalMemoryService.getPromptMemoryContext('Robert');
  assert(promptMemStr.includes('LONG-TERM USER MEMORY'), 'Generates prompt memory context block');

  // --- SECTION 8: WEATHER INTELLIGENCE TOOL ---
  console.log('\n8. Testing Weather Intelligence Tool...');

  const weatherRes = await globalToolRegistry.executeTool('get_weather_forecast', { location: 'Kampala' });
  assert(weatherRes.success && weatherRes.output.location === 'Kampala', 'Queries weather for Kampala');
  assert(weatherRes.output.temperatureC > 0, 'Returns valid temperature in Celsius');
  assert(weatherRes.message?.includes('Kampala'), 'Generates spoken weather message');

  const weatherIntent = IntentClassifier.classify('What is the weather in Kampala today?');
  assert(weatherIntent.primaryIntent === 'weather', 'Identifies weather intent');
  assert(weatherIntent.extractedEntities.location === 'Kampala', 'Extracts location Kampala');

  // --- SECTION 9: PLATFORM BRIDGE & HOST ENVIRONMENT ---
  console.log('\n9. Testing Platform Bridge & Android Capabilities...');

  const bridgeRes = await globalToolRegistry.executeTool('platform_bridge', { queryType: 'capabilities' });
  assert(bridgeRes.success, 'Queries platform bridge status');
  assert(bridgeRes.output.androidStudioReady === true, 'Verifies Android Studio architecture readiness');
  assert(bridgeRes.output.capabilities.androidReady.length > 0, 'Lists ready Android native capabilities');

  const bridgeIntent = IntentClassifier.classify('Check platform capabilities and Android bridge');
  assert(bridgeIntent.primaryIntent === 'platform_bridge', 'Identifies platform_bridge intent');

  // --- SECTION 10: USER PERSONALIZATION & MODEL FLEXIBILITY ---
  console.log('\n10. Testing Personalization Profile & Model Provider...');

  const profile = globalUserProfile.getProfile();
  assert(profile.preferredName === 'Robert', 'Personalization profile holds Robert as preferred name');
  assert(profile.honorific === 'Mr. Robert', 'Personalization profile holds Mr. Robert');

  const profileSnippet = globalUserProfile.buildPersonalizationPromptSnippet();
  assert(profileSnippet.includes('USER PERSONALIZATION PROFILE'), 'Builds personalization prompt snippet');

  const fastTiers = globalAIProvider.getModelTiers('fast');
  assert(fastTiers.includes('gemini-3.8-flash'), 'Fast tier includes gemini-3.8-flash');

  const reasoningTiers = globalAIProvider.getModelTiers('deep_reasoning');
  assert(reasoningTiers.includes('gemini-3.1-pro-preview'), 'Deep reasoning tier includes gemini-3.1-pro-preview');

  // Test full orchestration with weather
  const orchWeather = await globalOrchestrator.orchestrate({
    userInput: 'What is the weather in Kampala?',
  });
  assert(orchWeather.trace.intent.primaryIntent === 'weather', 'Orchestrates Weather query intent');
  assert(orchWeather.trace.validationPassed, 'Validates weather execution');
  assert(orchWeather.reply.includes('Kampala') && orchWeather.reply.includes('°C'), 'Returns spoken weather forecast');

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
