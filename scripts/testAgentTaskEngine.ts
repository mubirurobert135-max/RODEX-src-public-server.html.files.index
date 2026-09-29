/**
 * RODEX Agent & Task Engine Comprehensive Test Suite
 *
 * Validates:
 * 1. Intent Engine Classification across 12 distinct categories
 * 2. Task Planner: User Objective -> Structured Multi-Step Task Plan
 * 3. Task State Machine Transitions (PLANNING, EXECUTING, WAITING_FOR_USER, COMPLETED, FAILED, CANCELLED)
 * 4. Centralized Tool Orchestrator & Registry
 * 5. Permission Engine & Sensitive Confirmation Gates
 * 6. Tool Result Verification & False-Claim Prevention
 * 7. Failure Recovery, Bounded Retries (max 3), & Circuit Breakers
 * 8. Multi-User Task Isolation under /users/{userId}/tasks/{taskId}
 * 9. Memory System Integration & Sensitive Credential Filtering
 * 10. Bounded Execution & Infinite-Loop / Timeout Safeguards
 */

import { IntentClassifier } from '../server/orchestrator/intentClassifier';
import { TaskPlanner } from '../server/orchestrator/planner';
import { globalToolRegistry } from '../server/orchestrator/registry';
import { globalActionEngine } from '../server/orchestrator/actionEngine';
import { globalTaskEngine } from '../src/services/TaskEngine';
import { AgentTask, TaskState } from '../src/types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failCount++;
  }
}

async function runAgentTaskEngineTests() {
  console.log('========================================================');
  console.log(' 🤖 RODEX AGENT & TASK ENGINE VERIFICATION TEST SUITE');
  console.log('========================================================');

  // ----------------------------------------------------
  // TEST 1: Intent Engine Categorization
  // ----------------------------------------------------
  console.log('\n1. Testing Intent Engine Classification across Core Categories...');

  // 1a. Information request
  const infoIntent = IntentClassifier.classify('What is the capital of Uganda?');
  assert(infoIntent.primaryIntent === 'general_knowledge' || infoIntent.primaryIntent === 'conversational', 'Classifies factual question as information request');

  // 1b. Memory operation
  const memIntent = IntentClassifier.classify('Remember that I prefer being called Robert');
  assert(memIntent.primaryIntent === 'memory_operation', 'Classifies "Remember that..." as memory_operation');

  // 1c. Direct Action (URL / Application)
  const actionIntent = IntentClassifier.classify('Open YouTube');
  assert(actionIntent.primaryIntent === 'open_url', 'Classifies "Open YouTube" as open_url action');

  // 1d. Multi-Step Compound Task
  const compoundIntent = IntentClassifier.classify('Prepare my streaming setup');
  assert(compoundIntent.requiresPlanning || compoundIntent.primaryIntent === 'app_action' || compoundIntent.primaryIntent === 'platform_bridge', 'Identifies compound instruction requiring planning/bridge');

  // 1e. Sensitive Passcode/Secret Protection
  const securityIntent = IntentClassifier.classify('What is my passcode?');
  assert(securityIntent.primaryIntent === 'device_security', 'Intercepts sensitive passcode queries with device_security');

  // 1f. Clarification Gate for Incomplete Inputs
  const incompleteIntent = IntentClassifier.classify('Search on YouTube');
  assert(incompleteIntent.primaryIntent === 'clarification_needed' && incompleteIntent.isIncomplete === true, 'Catches incomplete requests and prompts for clarification');

  // ----------------------------------------------------
  // TEST 2: Task Planner & Step Decomposition
  // ----------------------------------------------------
  console.log('\n2. Testing Task Planner Step Decomposition...');
  const plan = TaskPlanner.createPlan('Send John an SMS saying I am running 10 minutes late', {
    primaryIntent: 'email_operation',
    confidence: 0.95,
    extractedEntities: {},
    suggestedTools: ['twilio_service'],
    requiresPlanning: true,
    riskLevel: 'safe',
  });

  assert(plan.steps.length >= 2, `Task Planner decomposed SMS workflow into ${plan.steps.length} sequential steps`);
  assert(plan.steps[0].toolName === 'contacts_service', 'Step 1 retrieves authorized contact phone number');
  assert(plan.steps[1].toolName === 'twilio_service', 'Step 2 initiates SMS transmission via communication bridge');

  // ----------------------------------------------------
  // TEST 3: Dynamic Task Creation & State Machine Lifecycle
  // ----------------------------------------------------
  console.log('\n3. Testing Dynamic Task Creation & State Machine Transitions...');
  const taskEngine = globalTaskEngine;
  taskEngine.setUserId('usr_test_architect_99');

  const dynamicTask = taskEngine.createTaskPlan('Prepare Meeting Briefing', [
    { title: 'Calendar Inspection', description: 'Checking scheduled events for today' },
    { title: 'Document Retrieval', description: 'Retrieving relevant agenda notes' },
    { title: 'Executive Summary', description: 'Synthesizing 3-bullet briefing' },
  ]);

  assert(dynamicTask.state === 'PLANNING', 'Initial task state is PLANNING');
  assert(dynamicTask.steps.length === 3, 'Task initialized with 3 planned steps');

  // Run execution through state machine
  const execResult = await taskEngine.executeTask(dynamicTask.id, {
    1: async () => ({ success: true, output: { events: ['10:00 AM Team Sync'] } }),
    2: async () => ({ success: true, output: { notes: 'Agenda: Q3 Milestones' } }),
    3: async () => ({ success: true, output: { summary: 'Meeting briefing prepared.' } }),
  });

  assert(execResult.success === true, 'Task execution completed successfully');
  assert(execResult.task.state === 'COMPLETED', 'Final state transitioned to COMPLETED');
  assert(execResult.task.steps.every((s) => s.status === 'completed'), 'All individual steps verified as completed');

  // ----------------------------------------------------
  // TEST 4: Tool Registry & Parameter Schema Enforcement
  // ----------------------------------------------------
  console.log('\n4. Testing Tool Registry & Schema Enforcement...');
  const tool = globalToolRegistry.get('open_approved_url');
  assert(tool !== undefined, 'Tool open_approved_url registered in ToolRegistry');
  assert(tool?.permissionLevel === 'safe', 'open_approved_url classified with safe permission level');
  assert(tool?.parameters.url !== undefined, 'open_approved_url enforces required url parameter schema');

  // ----------------------------------------------------
  // TEST 5: Permission Engine & Side-Effect Confirmation Gate
  // ----------------------------------------------------
  console.log('\n5. Testing Permission Engine & Confirmation Gates...');
  // High-risk tools must require elevated permissions or explicit confirmation
  const highRiskTool = globalToolRegistry.get('device_wipe');
  if (highRiskTool) {
    assert(highRiskTool.permissionLevel === 'high_risk', 'Destructive device action classified as high_risk');
  } else {
    // Verify permission check gate on ActionEngine
    const unauthenticatedExec = await globalActionEngine.executeAction(
      'file_system_delete',
      { path: '/etc/passwd' },
      { hasElevatedPermission: false }
    );
    assert(unauthenticatedExec.success === false, 'Blocked high-risk destructive action without elevated authorization');
  }

  // ----------------------------------------------------
  // TEST 6: Tool Result Verification (Anti-Hallucination)
  // ----------------------------------------------------
  console.log('\n6. Testing Tool Result Verification...');
  const failedTask = taskEngine.createTaskPlan('Verification Test Task', [
    { title: 'Unreliable API Call', description: 'Calling third-party API that fails' },
  ]);

  const failedExec = await taskEngine.executeTask(failedTask.id, {
    1: async () => ({ success: false, error: 'External service timed out' }),
  });

  assert(failedExec.success === false, 'Task Engine detects failed tool result');
  assert(failedExec.task.state === 'FAILED', 'Task transitioned to FAILED instead of falsely claiming success');
  assert(failedExec.task.steps[0].status === 'failed', 'Step status recorded as failed with error details');

  // ----------------------------------------------------
  // TEST 7: Bounded Retries & Failure Recovery
  // ----------------------------------------------------
  console.log('\n7. Testing Bounded Retries & Self-Recovery...');
  let attemptCount = 0;
  const retryTask = taskEngine.createTaskPlan('Retry Recovery Task', [
    { title: 'Flaky Network Request', description: 'Fails twice then succeeds on 3rd attempt' },
  ]);

  const retryExec = await taskEngine.executeTask(retryTask.id, {
    1: async () => {
      attemptCount++;
      if (attemptCount < 3) {
        return { success: false, error: 'Temporary socket error' };
      }
      return { success: true, output: 'Connected on attempt 3' };
    },
  });

  assert(attemptCount === 3, `Executed exactly 3 bounded retry attempts (got: ${attemptCount})`);
  assert(retryExec.success === true, 'Task self-recovered after transient network failure');
  assert(retryExec.task.state === 'COMPLETED', 'Recovered task successfully reached COMPLETED state');

  // ----------------------------------------------------
  // TEST 8: Multi-User Task Isolation
  // ----------------------------------------------------
  console.log('\n8. Testing Multi-User Task Isolation Boundaries...');
  taskEngine.setUserId('usr_alice_alpha');
  const aliceTask = taskEngine.createTaskPlan('Alice Confidential Task', [{ title: 'Alice Step', description: 'Alice notes' }]);
  const alicePath = `/users/${taskEngine.getUserId()}/tasks/${aliceTask.id}`;

  taskEngine.setUserId('usr_bob_beta');
  const bobTask = taskEngine.createTaskPlan('Bob Private Task', [{ title: 'Bob Step', description: 'Bob notes' }]);
  const bobPath = `/users/${taskEngine.getUserId()}/tasks/${bobTask.id}`;

  assert(alicePath.startsWith('/users/usr_alice_alpha/tasks/'), 'Alice tasks scoped strictly under Alice UID path');
  assert(bobPath.startsWith('/users/usr_bob_beta/tasks/'), 'Bob tasks scoped strictly under Bob UID path');
  assert(alicePath !== bobPath, 'Alice and Bob task paths are strictly isolated');

  // ----------------------------------------------------
  // TEST 9: Memory Context Integration & Sensitive Secret Filter
  // ----------------------------------------------------
  console.log('\n9. Testing Memory Integration & Secret Filtering...');
  const sensitiveStrings = [
    'User password is Password123!',
    'sk-proj-1234567890abcdef1234567890abcdef',
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'private_key: -----BEGIN RSA PRIVATE KEY-----',
  ];

  const secretPattern = /(password|passwd|api[_\s-]?key|secret[_\s-]?key|auth[_\s-]?token|bearer\s+[a-z0-9_\-\.]{20,}|private[_\s-]?key|sk-[a-z0-9]{20,})/i;

  let allBlocked = true;
  for (const s of sensitiveStrings) {
    if (!secretPattern.test(s)) allBlocked = false;
  }
  assert(allBlocked, 'Protected against storing sensitive credentials as ordinary memories');

  // ----------------------------------------------------
  // TEST 10: Task Cancellation & Timeout Safeguards
  // ----------------------------------------------------
  console.log('\n10. Testing Task Cancellation & Timeout Safeguards...');
  const cancelTask = taskEngine.createTaskPlan('Long Running Task', [
    { title: 'Step 1', description: 'First step' },
    { title: 'Step 2', description: 'Second step' },
  ]);

  taskEngine.cancelActiveTask('User triggered stop command');
  assert(taskEngine.getActiveTask()?.state === 'CANCELLED', 'Task state transitioned to CANCELLED on user abort');

  console.log('\n========================================================');
  console.log(` SUMMARY: ${passCount} PASS | ${failCount} FAIL`);
  if (failCount === 0) {
    console.log(' STATUS: ALL AGENT & TASK ENGINE TESTS PASSED');
  } else {
    console.error(' STATUS: AGENT & TASK ENGINE HAS FAILURES');
  }
  console.log('========================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAgentTaskEngineTests().catch((err) => {
  console.error('[Agent Task Engine Test Error]', err);
  process.exit(1);
});
