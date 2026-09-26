// RODEX — Self-Recovery & Resilience Automated Test Suite
import dotenv from 'dotenv';
import { globalCircuitBreakerManager } from '../server/doctor/circuitBreaker';
import { globalRecoveryManager } from '../server/doctor/recoveryManager';
import { globalServiceRegistry } from '../server/doctor/serviceRegistry';

dotenv.config();

async function runRecoverySelfTest() {
  console.log('\n========================================================');
  console.log(' 🛡️ RODEX SELF-RECOVERY & RESILIENCE TEST SUITE ');
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

  // TEST 1: Circuit Breaker Transitions
  console.log('1. Testing Circuit Breaker State Transitions...');
  const breaker = globalCircuitBreakerManager.getBreaker('youtube_integration');
  breaker.reset();
  assert(breaker.canExecute() === true, 'Circuit Breaker starts CLOSED and permits execution');

  breaker.recordFailure();
  breaker.recordFailure();
  breaker.recordFailure(); // Threshold reached (3)
  assert(breaker.canExecute() === false, 'Circuit Breaker transitions to OPEN after 3 failures and blocks execution');

  const status = breaker.getStatus();
  assert(status.state === 'OPEN', 'Status reports state = OPEN');
  assert(status.failureCount === 3, 'Failure count recorded = 3');

  breaker.reset();
  assert(breaker.canExecute() === true, 'Reset transitions Circuit Breaker back to CLOSED');

  // TEST 2: Exponential Backoff Calculation
  console.log('\n2. Testing Exponential Backoff & Jitter...');
  const delay1 = globalRecoveryManager.calculateBackoff(1, 500, 10000);
  const delay2 = globalRecoveryManager.calculateBackoff(2, 500, 10000);
  const delay3 = globalRecoveryManager.calculateBackoff(3, 500, 10000);

  assert(delay1 >= 500 && delay1 <= 800, `Attempt 1 delay in expected range (~500ms): ${delay1}ms`);
  assert(delay2 >= 1000 && delay2 <= 1400, `Attempt 2 delay scales exponentially (~1000ms): ${delay2}ms`);
  assert(delay3 >= 2000 && delay3 <= 2500, `Attempt 3 delay scales exponentially (~2000ms): ${delay3}ms`);

  // TEST 3: Failure Isolation (Optional Service Fault Does NOT Crash Core)
  console.log('\n3. Testing Failure Isolation...');
  globalServiceRegistry.updateServiceHealth('spotify_integration', 'CRITICAL', 0, 'Simulated OAuth outage');
  const backendHealth = globalServiceRegistry.getService('backend')?.status;
  const spotifyHealth = globalServiceRegistry.getService('spotify_integration')?.status;

  assert(spotifyHealth === 'CRITICAL', 'Optional service (Spotify) marked CRITICAL during simulated failure');
  assert(backendHealth === 'HEALTHY', 'Core backend remains HEALTHY (failure isolated successfully)');

  // TEST 4: Safe Auto-Recovery Execution & Verification
  console.log('\n4. Testing Safe Auto-Recovery Pipeline...');
  const recoveryResult = await globalRecoveryManager.attemptRecovery('memory_system');
  assert(Boolean(recoveryResult), 'Recovery manager returned execution details');
  assert(recoveryResult?.result.verified === true, 'Recovery verified memory system operational');

  console.log('\n========================================================');
  console.log(` SUMMARY: ${passed} PASS | ${failed} FAIL`);
  if (failed === 0) {
    console.log(' STATUS: RODEX SELF-RECOVERY & RESILIENCE SUBSYSTEM VERIFIED');
  } else {
    console.log(' STATUS: RESILIENCE TEST FAILED');
  }
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runRecoverySelfTest();
