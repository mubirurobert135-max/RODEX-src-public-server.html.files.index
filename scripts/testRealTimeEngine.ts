// RODEX — Real-Time Response Engine Automated Test Suite
import dotenv from 'dotenv';
import { globalRealTimeEngine } from '../server/services/realTimeEngine';
import { IntentClassifier } from '../server/orchestrator/intentClassifier';
import { globalPerformanceTracker } from '../server/services/performanceTracker';
import { isLiveActionIntentSupported, buildLiveClockAnswer } from '../server/services/liveGeminiService';
import { globalLiveConversationService, matchWakePhrase } from '../src/services/liveConversationService';

dotenv.config();

async function runRealTimeEngineTest() {
  console.log('\n========================================================');
  console.log(' ⚡ RODEX REAL-TIME RESPONSE ENGINE TEST SUITE ');
  console.log('========================================================\n');

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

  // TEST 1: Fast Intent Router (< 30ms)
  console.log('1. Testing Fast Intent Router...');
  IntentClassifier.classify('warmup query');
  const start1 = Date.now();
  const intentUrl = IntentClassifier.classify('RODEX, open YouTube');
  const elapsed1 = Date.now() - start1;

  assert(intentUrl.primaryIntent === 'open_url', 'Identifies open_url intent');
  assert(intentUrl.extractedEntities.targetUrl === 'https://www.youtube.com', 'Constructs target YouTube URL');

  const wikipedia = IntentClassifier.classify('Open Wikipedia');
  assert(
    wikipedia.primaryIntent === 'open_url' && wikipedia.extractedEntities.targetUrl === 'https://en.wikipedia.org',
    'Constructs the correct Wikipedia destination'
  );
  const wakePrefixedWikipedia = IntentClassifier.classify('Hello RODEX, open Wikipedia');
  assert(
    wakePrefixedWikipedia.primaryIntent === 'open_url' && wakePrefixedWikipedia.extractedEntities.targetUrl === 'https://en.wikipedia.org',
    'Recognizes a website command that includes the spoken wake phrase'
  );
  const takeMeToWikipedia = IntentClassifier.classify('Take me to Wikipedia');
  assert(
    takeMeToWikipedia.primaryIntent === 'open_url' && takeMeToWikipedia.extractedEntities.targetUrl === 'https://en.wikipedia.org',
    'Recognizes natural navigation phrasing for Wikipedia'
  );
  assert(elapsed1 < 30, `Fast intent routing executed in ${elapsed1}ms (< 30ms threshold)`);

  assert(isLiveActionIntentSupported('open_url'), 'Live voice can route website-opening actions');
  assert(isLiveActionIntentSupported('calculate_compute'), 'Live voice can route calculations');
  assert(isLiveActionIntentSupported('datetime_timezone'), 'Live voice can route date/time checks');
  assert(!isLiveActionIntentSupported('email_operation'), 'Live voice refuses private email actions without authenticated context');
  assert(!isLiveActionIntentSupported('contacts_operation'), 'Live voice refuses private contact actions without authenticated context');
  assert(!isLiveActionIntentSupported('weather'), 'Live action bridge refuses mock weather output');

  const fixedClock = buildLiveClockAnswer('Uganda', '2026-10-17T07:32:00.000Z');
  assert(
    fixedClock.text === 'The time in Uganda is 10:32 AM.' &&
      fixedClock.clockSource === 'client_clock',
    'Live time answer uses the exact client clock and speaks only hours/minutes'
  );
  const invalidZoneClock = buildLiveClockAnswer('uganda', '2026-10-17T07:32:00.000Z');
  assert(
    invalidZoneClock.timeZone === 'Africa/Kampala' && invalidZoneClock.timeOnly === '10:32 AM',
    'Maps Uganda to the valid Africa/Kampala timezone'
  );

  const liveServiceForTest = globalLiveConversationService as any;
  const directBrowserClock = liveServiceForTest.buildDirectTimeAnswer(
    'Hello RODEX, what time is it in Uganda right now?'
  );
  assert(
    typeof directBrowserClock === 'string' &&
      /^The time in Uganda is \d{1,2}:\d{2} (AM|PM)\.$/.test(directBrowserClock),
    'Uses a deterministic browser-clock response for spoken Uganda time questions'
  );
  assert(
    liveServiceForTest.buildDirectTimeAnswer('Tell me about the history of Uganda') === null,
    'Does not intercept ordinary questions that are not asking for current time'
  );

  const politeYouTube = IntentClassifier.classify('Open YouTube for me');
  assert(politeYouTube.primaryIntent === 'open_url', 'Accepts natural polite website commands');
  const conversationalYouTube = IntentClassifier.classify('Could you please open YouTube for me?');
  assert(
    conversationalYouTube.primaryIntent === 'open_url' &&
      conversationalYouTube.extractedEntities.targetUrl === 'https://www.youtube.com',
    'Recognizes conversational voice requests to open websites'
  );
  const conversationalDomain = IntentClassifier.classify('Can you open example.com?');
  assert(
    conversationalDomain.primaryIntent === 'open_url' &&
      conversationalDomain.extractedEntities.targetUrl === 'https://example.com/',
    'Recognizes conversational requests for arbitrary domains'
  );
  const arbitraryWebsite = IntentClassifier.classify('RODEX, open example.com');
  assert(
    arbitraryWebsite.primaryIntent === 'open_url' &&
      arbitraryWebsite.extractedEntities.targetUrl === 'https://example.com/',
    'Constructs a safe HTTPS URL for an arbitrary domain'
  );
  const claude = IntentClassifier.classify('Open Claude');
  assert(
    claude.primaryIntent === 'open_url' &&
      claude.extractedEntities.targetUrl === 'https://claude.ai',
    'Routes Claude to its own website rather than YouTube'
  );

  // TEST 1B: The actual LiveConversationService wake gate must accept bare and compound calls.
  console.log('1B. Testing the Live Orb Wake Gate...');
  const bareHello = matchWakePhrase('hello');
  assert(
    bareHello.matched && bareHello.phrase === 'hello' && bareHello.command === '',
    'A bare "hello" activates the live orb and requests the short greeting'
  );
  const helloRodex = matchWakePhrase('Hello RODEX');
  assert(
    helloRodex.matched && helloRodex.phrase === 'hello rodex' && helloRodex.command === '',
    'Hello RODEX is recognized as a pure wake phrase'
  );
  const helloWithCommand = matchWakePhrase('Hello RODEX, open Wikipedia');
  assert(
    helloWithCommand.matched && helloWithCommand.command === 'open wikipedia',
    'A wake phrase plus command preserves the command instead of only greeting'
  );
  const phoneticHello = matchWakePhrase('hello roadex');
  assert(
    phoneticHello.matched && phoneticHello.phrase === 'hello rodex',
    'A common phonetic spelling is normalized by the live orb wake gate'
  );
  const backgroundSpeech = matchWakePhrase('please pass me the water');
  assert(!backgroundSpeech.matched, 'Unrelated background speech does not wake the live orb');

  // TEST 2: Creator Inquiry Fast Path
  console.log('\n2. Testing Creator Inquiry Fast Path...');
  const intentCreator = IntentClassifier.classify('Who is your creator and who developed RODEX?');
  assert(intentCreator.primaryIntent === 'creator_inquiry', 'Identifies creator_inquiry intent');

  // TEST 3: Datetime Fast Path
  console.log('\n3. Testing Datetime Fast Path...');
  const intentTime = IntentClassifier.classify('What time is it in Uganda?');
  assert(intentTime.primaryIntent === 'datetime_timezone', 'Identifies datetime_timezone intent');

  // TEST 4: Mock SSE Stream Execution & Sentence Boundary Chunking
  console.log('\n4. Testing Sentence Boundary Extractor (Early Speech Start / TTFA)...');
  const mockBuffer = 'Hello Robert. I am RODEX AI. All real-time systems are operational.';
  const engineAny = globalRealTimeEngine as any;
  const { sentences, remaining } = engineAny.extractSentences(mockBuffer);

  assert(sentences.length === 2, `Extracted 2 sentence boundaries for TTFA: "${sentences[0]}", "${sentences[1]}"`);
  assert(remaining === 'All real-time systems are operational.', 'Preserved trailing un-punctuated token buffer');

  // TEST 5: Performance Tracker Integration
  console.log('\n5. Testing Performance Metrics Tracker...');
  const perf = globalPerformanceTracker.getMetricsSummary();
  assert(typeof perf.activeRequests === 'number', 'Metrics tracker active');

  console.log('\n========================================================');
  console.log(` SUMMARY: ${passed} PASS | ${failed} FAIL`);
  if (failed === 0) {
    console.log(' STATUS: REAL-TIME RESPONSE ENGINE VERIFIED & READY');
  } else {
    console.log(' STATUS: TEST FAILED');
  }
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runRealTimeEngineTest();
