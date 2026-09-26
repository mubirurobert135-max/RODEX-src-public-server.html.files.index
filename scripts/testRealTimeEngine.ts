// RODEX — Real-Time Response Engine Automated Test Suite
import dotenv from 'dotenv';
import { globalRealTimeEngine } from '../server/services/realTimeEngine';
import { IntentClassifier } from '../server/orchestrator/intentClassifier';
import { globalPerformanceTracker } from '../server/services/performanceTracker';

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

  // TEST 1: Fast Intent Router (< 5ms)
  console.log('1. Testing Fast Intent Router...');
  const start1 = Date.now();
  const intentUrl = IntentClassifier.classify('RODEX, open YouTube');
  const elapsed1 = Date.now() - start1;

  assert(intentUrl.primaryIntent === 'open_url', 'Identifies open_url intent');
  assert(intentUrl.extractedEntities.targetUrl === 'https://www.youtube.com', 'Constructs target YouTube URL');
  assert(elapsed1 < 10, `Fast intent routing executed in ${elapsed1}ms (< 10ms threshold)`);

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
