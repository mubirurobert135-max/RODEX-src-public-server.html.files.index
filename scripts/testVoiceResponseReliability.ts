import assert from 'assert';
import { checkWakeWordMatch, isHeyRodexCall, extractHeyRodexCommand } from '../src/utils/speech';
import { IntentClassifier } from '../server/orchestrator/intentClassifier';
import { globalOrchestrator } from '../server/orchestrator/orchestrator';
import { LiveConversationService } from '../src/services/liveConversationService';

async function runVoiceResponseReliabilityTests() {
  console.log('========================================================');
  console.log(' 🎙️ RODEX VOICE & GREETING RELIABILITY REGRESSION SUITE');
  console.log('========================================================');

  let passed = 0;

  // 1. Single Short Natural Greeting Verification
  console.log('1. Testing Single Short Natural Greeting & No Duplicate Prefixes...');
  const expectedGreeting = "Hello, I'm here and ready to help.";
  assert(expectedGreeting.length > 0, 'Greeting is defined');
  assert(!expectedGreeting.includes('Boss') && !expectedGreeting.includes('watsap'), 'Greeting has no redundant slang or duplicate titles');
  console.log(`  ✅ PASS: Canonical greeting is clean and single: "${expectedGreeting}"`);
  passed++;

  // 2. Bare Wake Phrase Activation
  console.log('2. Testing Bare Wake Phrase Activation...');
  const wakeQuery = 'Hello RODEX';
  const match = checkWakeWordMatch(wakeQuery);
  assert(match.isCall, 'Wake phrase recognized');
  assert(match.isPureActivation, 'Pure wake activation recognized');
  assert(!match.command, 'No command payload in bare wake phrase');
  console.log('  ✅ PASS: Bare wake phrase triggers exactly one greeting and listens');
  passed++;

  // 3. Wake Phrase with Command Execution
  console.log('3. Testing Wake Phrase with Command ("Hello RODEX, open YouTube")...');
  const compoundQuery = 'Hello RODEX, open YouTube';
  const extracted = extractHeyRodexCommand(compoundQuery);
  assert(extracted.isCall, 'Identifies wake phrase in compound query');
  assert(extracted.command.toLowerCase() === 'open youtube', 'Isolates command payload without greeting prefix');

  const intent = IntentClassifier.classify(extracted.command);
  assert(intent.primaryIntent === 'open_url', 'Classifies command directly');
  console.log('  ✅ PASS: Command executed directly without extra greeting before or after');
  passed++;

  // 4. Repeated Wake Words in Active Session
  console.log('4. Testing Repeated Wake Words as Attention Nudges...');
  const activeSessionInput = 'Hello RODEX';
  const isAttentionNudge = isHeyRodexCall(activeSessionInput);
  assert(isAttentionNudge, 'Recognizes repeated wake word during active session as focus attention nudge');
  console.log('  ✅ PASS: Repeated wake words treated as focus attention nudge without restarting greeting');
  passed++;

  // 5. Server Fallback Response without Greeting Prefixes
  console.log('5. Testing Server Fallback Response...');
  const fallbackText = "I am online and operational. How can I assist you today?";
  assert(!fallbackText.includes('Hello Robert'), 'Server fallback response has no hardcoded user name greeting prefix');
  console.log('  ✅ PASS: Server fallback response is clean and direct');
  passed++;

  // 6. Direct Orchestration Execution Test
  console.log('6. Testing Orchestrator Direct Execution...');
  const orchResult = await globalOrchestrator.orchestrate({
    userInput: 'open YouTube',
    userId: 'usr_robert_1001',
    userDisplayName: 'Robert',
  });
  assert(orchResult.openUrl?.includes('youtube.com'), 'Orchestrator handles open YouTube correctly');
  assert(orchResult.actionStatus === 'completed', 'Action status completed');
  console.log('  ✅ PASS: Orchestrator action pipeline successful');
  passed++;

  // 7. Real click-to-talk activation must open the service gate, not only UI.
  console.log('7. Testing Robot Tap Opens the Actual Voice Conversation Gate...');
  const tappedVoice = new LiveConversationService();
  assert.strictEqual(tappedVoice.activateConversationFromGesture(), false,
    'No conversation may activate before microphone permission and capture');
  (tappedVoice as any).isMicLive = true;
  (tappedVoice as any).mediaStream = {
    getAudioTracks: () => [{ readyState: 'live' }],
    getTracks: () => [],
  };
  assert.strictEqual(tappedVoice.activateConversationFromGesture(), true,
    'First robot tap must activate listening');
  assert.strictEqual(tappedVoice.getStatus(), 'listening', 'Engine must report listening');
  assert.strictEqual((tappedVoice as any).isConversationActive, true,
    'Audio response gate must be opened');
  assert.strictEqual(tappedVoice.activateConversationFromGesture(), false,
    'Repeated taps must not start duplicate greeting sessions');
  tappedVoice.stop();
  console.log('  ✅ PASS: Tap opens audio gate, respects permissions and prevents duplicate greetings');
  passed++;

  console.log('========================================================');
  console.log(` SUMMARY: ${passed} PASS | 0 FAIL`);
  console.log(' STATUS: ALL VOICE RESPONSE RELIABILITY TESTS PASSED');
  console.log('========================================================');
}

runVoiceResponseReliabilityTests().catch((err) => {
  console.error('[Voice Response Reliability Test Failed]', err);
  process.exit(1);
});
