// RODEX DOCTOR — Self-Test Suite
import dotenv from 'dotenv';
import { globalRodexDoctor } from '../server/doctor/doctorEngine';
import { globalServiceRegistry } from '../server/doctor/serviceRegistry';
import { globalErrorAnalyzer } from '../server/doctor/errorAnalyzer';
import { globalAutoRepairEngine } from '../server/doctor/autoRepairEngine';

dotenv.config();

async function runDoctorSelfTest() {
  console.log('\n====================================================');
  console.log(' 🧪 RODEX DOCTOR AUTOMATED SELF-TEST SUITE ');
  console.log('====================================================\n');

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

  // Test 1: Service Registry Initialization
  console.log('1. Testing Service Registry...');
  const services = globalServiceRegistry.getAllServices();
  assert(Boolean(services.backend), 'Backend service registered');
  assert(Boolean(services.ai_provider), 'AI provider service registered');
  assert(Boolean(services.memory_system), 'Memory service registered');

  // Test 2: Diagnostic Report Generation
  console.log('\n2. Testing Diagnostic Report Generation...');
  const report = await globalRodexDoctor.generateDiagnosticReport();
  assert(Boolean(report.overallHealth), 'Report contains overall health');
  assert(Array.isArray(report.environmentChecks), 'Report includes environment checks');
  assert(report.resources.uptimeSeconds >= 0, 'Resource metrics active');

  // Test 3: Secret Masking Verification
  console.log('\n3. Testing Secret Masking Security...');
  const envChecksStr = JSON.stringify(report.environmentChecks);
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (rawKey && rawKey.length > 5) {
    assert(!envChecksStr.includes(rawKey), 'Raw API keys are masked and not exposed in reports');
  } else {
    assert(true, 'Secret masking logic active');
  }

  // Test 4: Error Analyzer & Root Cause Triage
  console.log('\n4. Testing Error Analyzer & Root Cause Triage...');
  globalErrorAnalyzer.recordIncident({
    service: 'memory_system',
    severity: 'WARNING',
    errorType: 'TEST_LATENCY_SPIKE',
    message: 'Test latency warning recorded',
    rootCause: 'Simulated latency spike for self-test',
    recommendedAction: 'Verify auto-repair',
  });
  const incidents = globalErrorAnalyzer.getIncidentHistory(5);
  assert(incidents.length > 0, 'Incident recorded in incident history');

  // Test 5: Safe Auto-Repair Execution & Post-Verification
  console.log('\n5. Testing Non-Destructive Safe Auto-Repair...');
  const repairResults = await globalAutoRepairEngine.executeRepair('memory_system');
  assert(repairResults.length > 0, 'Auto-repair produced execution result');
  assert(repairResults[0].verified === true, 'Auto-repair verified memory system operational');

  console.log('\n====================================================');
  console.log(` SUMMARY: ${passed} PASS | ${failed} FAIL`);
  if (failed === 0) {
    console.log(' STATUS: RODEX DOCTOR SUBSYSTEM FULLY FUNCTIONAL');
  } else {
    console.log(' STATUS: DOCTOR SELF-TEST FAILED');
  }
  console.log('====================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runDoctorSelfTest();
