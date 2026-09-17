import { IntentClassifier } from './orchestrator/intentClassifier';
import { globalToolRegistry } from './orchestrator/registry';
import { globalOrchestrator } from './orchestrator/orchestrator';

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

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
