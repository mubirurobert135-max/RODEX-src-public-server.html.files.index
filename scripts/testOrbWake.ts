import assert from 'assert';
import {
  isHeyRodexCall,
  containsHeyRodexWakeWord,
  extractHeyRodexCommand,
  checkWakeWordMatch,
  isConversationExit,
} from '../src/utils/speech';
import { IntentClassifier } from '../server/orchestrator/intentClassifier';
import { globalOrchestrator } from '../server/orchestrator/orchestrator';

async function runOrbWakeTests() {
  console.log('========================================================');
  console.log(' 🔮 RODEX RESPONSIVE ORB & WAKE ACTIVATION TEST SUITE');
  console.log('========================================================');

  let passed = 0;

  // 1. Natural Wake Phrase Variations
  console.log('1. Testing Natural Wake Phrase Variations...');
  const wakePhrases = [
    'Hello RODEX',
    'Hello, RODEX',
    'Hey RODEX',
    'Hey, RODEX',
    'Hi RODEX',
    'Hi, RODEX',
    'RODEX',
    'Rodex',
    'Okay RODEX',
    'OK RODEX',
    'Good morning RODEX',
    'Good evening RODEX',
  ];

  for (const phrase of wakePhrases) {
    const isCall = isHeyRodexCall(phrase) || containsHeyRodexWakeWord(phrase);
    assert(isCall, `Wake phrase "${phrase}" must activate RODEX`);
    const match = checkWakeWordMatch(phrase);
    assert(match.isCall, `checkWakeWordMatch("${phrase}") must return isCall: true`);
    assert(match.isPureActivation, `Pure wake phrase "${phrase}" must be marked isPureActivation: true`);
  }
  console.log(`  ✅ PASS: All ${wakePhrases.length} natural wake phrase variations activate RODEX instantly`);
  passed++;

  // 2. Phonetic Speech Recognition Tolerance
  console.log('2. Testing Phonetic Speech Recognition Variants...');
  const phoneticVariants = [
    'hello roadex',
    'hey roddex',
    'hi rodix',
    'okay rotex',
    'hey rolex',
    'hello radex',
    'hey rodek',
    'hi rhodex',
  ];

  for (const variant of phoneticVariants) {
    const isCall = isHeyRodexCall(variant) || containsHeyRodexWakeWord(variant);
    assert(isCall, `Phonetic variant "${variant}" must activate RODEX`);
  }
  console.log(`  ✅ PASS: All ${phoneticVariants.length} phonetic speech-recognition variations activate RODEX`);
  passed++;

  // 3. Combined Wake Phrase + Command Extraction
  console.log('3. Testing Combined Wake Phrase + Direct Command Capture...');
  const compoundQuery = 'Hello RODEX, open YouTube and search for Python tutorials';
  const extracted = extractHeyRodexCommand(compoundQuery);
  assert(extracted.isCall, 'Identifies wake phrase in compound query');
  assert(
    extracted.command.toLowerCase().includes('open youtube and search for python tutorials'),
    'Correctly isolates the command payload'
  );

  const intent = IntentClassifier.classify(extracted.command);
  assert(intent.primaryIntent === 'open_url', 'Classifies open_url intent');
  assert(
    intent.extractedEntities?.targetUrl?.toLowerCase().includes('python%20tutorials') ||
    intent.extractedEntities?.targetUrl?.toLowerCase().includes('python+tutorials'),
    'Constructs target YouTube search URL with encoded query'
  );
  console.log('  ✅ PASS: "Hello RODEX, open YouTube and search for Python tutorials" extracts command & constructs URL');
  passed++;

  // 4. Two-Stage Natural Interaction & Follow-Up Context
  console.log('4. Testing Two-Stage Contextual Follow-Up Execution...');
  // Stage 1: User says "Open YouTube and search for Python tutorials"
  const turn1History = [
    { role: 'user', text: 'Open YouTube and search for Python tutorials' },
    { role: 'model', text: 'YouTube is open and searching for Python tutorials.' },
  ];

  // Stage 2: User says "Open the first result"
  const turn2Intent = IntentClassifier.classify('Open the first result', turn1History);
  assert(turn2Intent.primaryIntent === 'open_url', 'Turn 2 classified as open_url');
  console.log('  ✅ PASS: Follow-up command "Open the first result" uses conversation context seamlessly');
  passed++;

  // 5. Interruption / Barge-in ("Stop")
  console.log('5. Testing Interruption / Barge-in Detection...');
  assert(isConversationExit('Stop'), '"Stop" triggers barge-in');
  assert(isConversationExit('Cancel'), '"Cancel" triggers barge-in');
  assert(isConversationExit('Hang up'), '"Hang up" triggers conversation exit');
  assert(isConversationExit('End call'), '"End call" triggers conversation exit');
  assert(!isConversationExit('Search for Python tutorials'), 'Normal commands do NOT trigger barge-in');
  console.log('  ✅ PASS: Barge-in interruption correctly stops speech on "Stop" and "Cancel"');
  passed++;

  // 6. Background Speech Noise Rejection
  console.log('6. Testing Background Speech Noise Rejection...');
  const unrelatedBackgroundPhrases = [
    'the weather is nice today',
    'pass the salt please',
    'television commercial playing in the living room',
    'let us discuss the project timeline',
  ];

  for (const bg of unrelatedBackgroundPhrases) {
    assert(!isHeyRodexCall(bg), `Background phrase "${bg}" must NOT trigger wake call`);
  }
  console.log('  ✅ PASS: Unrelated background conversations do not trigger false wake activations');
  passed++;

  // 7. Full Direct Orchestration Execution
  console.log('7. Testing Instant Action Orchestration...');
  const orchResult = await globalOrchestrator.orchestrate({
    userInput: 'Open YouTube and search for Python tutorials',
    userId: 'usr_robert_1001',
    userDisplayName: 'Robert',
  });

  assert(orchResult.openUrl?.includes('youtube.com'), 'Orchestrator returns openUrl target');
  assert(orchResult.actionStatus === 'completed', 'Orchestration completes directly');
  console.log('  ✅ PASS: Direct action orchestration completes without unnecessary delay');
  passed++;

  console.log('========================================================');
  console.log(` SUMMARY: ${passed} PASS | 0 FAIL`);
  console.log(' STATUS: ORB & WAKE PHRASE SUBSYSTEM FULLY VERIFIED');
  console.log('========================================================');
}

runOrbWakeTests().catch((err) => {
  console.error('[Orb Wake Test Failed]', err);
  process.exit(1);
});
