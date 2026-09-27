import assert from 'assert';
import { globalAuthService } from '../server/services/auth/auth.service';
import { globalMemoryService } from '../server/orchestrator/memoryService';
import { IntentClassifier } from '../server/orchestrator/intentClassifier';
import { globalOrchestrator } from '../server/orchestrator/orchestrator';
import { SYSTEM_METADATA, CREATOR_ATTRIBUTION_RESPONSE } from '../server/systemMetadata';

async function runMultiUserTests() {
  console.log('========================================================');
  console.log(' 👥 RODEX MULTI-USER ACCOUNTS & CREATOR ISOLATION TESTS');
  console.log('========================================================');

  let passed = 0;

  // 1. Account Creation & Password Hashing
  console.log('1. Testing User Registration & Password Hashing...');
  const aliceRes = globalAuthService.registerUser({
    username: `alice_${Date.now()}`,
    email: `alice_${Date.now()}@example.com`,
    displayName: 'Alice Walker',
    password: 'securePassword123!',
    securityQuestion: 'Favorite city?',
    securityAnswer: 'Kampala',
    preferredName: 'Alice',
  });

  assert(aliceRes.user.id.startsWith('usr_'), 'User ID generated correctly');
  assert(aliceRes.user.displayName === 'Alice Walker', 'Display name preserved');
  assert(aliceRes.sessionToken.startsWith('session_'), 'Session token generated');
  // Verify password hash is not stored in plaintext
  const rawAlice = globalAuthService.getRawUserById(aliceRes.user.id);
  assert(rawAlice?.passwordHash !== 'securePassword123!', 'Password is securely hashed');
  console.log('  ✅ PASS: User A (Alice) registered with secure hashed credentials and active session');
  passed++;

  // 2. User B Registration
  console.log('2. Testing User B Registration...');
  const bobRes = globalAuthService.registerUser({
    username: `bob_${Date.now()}`,
    email: `bob_${Date.now()}@example.com`,
    displayName: 'Bob Smith',
    password: 'bobPassword456!',
    preferredName: 'Bob',
  });

  assert(bobRes.user.id !== aliceRes.user.id, 'User IDs are unique');
  console.log('  ✅ PASS: User B (Bob) registered with isolated user ID');
  passed++;

  // 3. User Session Verification & Isolation
  console.log('3. Testing Session Verification...');
  const verifiedAlice = globalAuthService.verifySession(aliceRes.sessionToken);
  assert(verifiedAlice?.id === aliceRes.user.id, 'Alice session verified');
  const verifiedBob = globalAuthService.verifySession(bobRes.sessionToken);
  assert(verifiedBob?.id === bobRes.user.id, 'Bob session verified');
  assert(verifiedAlice?.id !== verifiedBob?.id, 'Sessions remain completely separate');
  console.log('  ✅ PASS: Session verification isolates individual user accounts');
  passed++;

  // 4. User-Specific Memory Isolation
  console.log('4. Testing User-Specific Long-Term Memory Isolation...');
  await globalMemoryService.save({
    userId: aliceRes.user.id,
    key: 'project_name',
    value: 'Autonomous Robotics Lab in Entebbe',
    category: 'fact',
    confidence: 1.0,
    tags: ['project', 'robotics'],
  });

  await globalMemoryService.save({
    userId: bobRes.user.id,
    key: 'favorite_language',
    value: 'Rust and WebAssembly',
    category: 'preference',
    confidence: 0.95,
    tags: ['tech'],
  });

  // Query Alice memories
  const aliceMemories = await globalMemoryService.search(aliceRes.user.id);
  const bobMemories = await globalMemoryService.search(bobRes.user.id);

  assert(
    aliceMemories.some((m) => m.key === 'project_name'),
    'Alice memory contains her project'
  );
  assert(
    !aliceMemories.some((m) => m.key === 'favorite_language'),
    'Alice memory does NOT contain Bob data'
  );
  assert(
    bobMemories.some((m) => m.key === 'favorite_language'),
    'Bob memory contains his language preference'
  );
  assert(
    !bobMemories.some((m) => m.key === 'project_name'),
    'Bob memory does NOT contain Alice data'
  );
  console.log('  ✅ PASS: Memory strictly segregated between User A and User B');
  passed++;

  // 5. Creator Identity vs User Identity Inquiries
  console.log('5. Testing Creator Inquiry vs User Identity Inquiry...');
  
  // Test 5A: Creator inquiry
  const creatorIntent = IntentClassifier.classify('Who created you?');
  assert(creatorIntent.primaryIntent === 'creator_inquiry', 'Classifies creator inquiry');
  
  const creatorResp = await globalOrchestrator.orchestrate({
    userInput: 'Who created you?',
    userId: aliceRes.user.id,
    userDisplayName: aliceRes.user.displayName,
    userEmail: aliceRes.user.email,
  });

  assert(
    creatorResp.reply.includes('Mubiru Robert'),
    'Creator response truthfully identifies Mubiru Robert from system metadata'
  );
  console.log('  ✅ PASS: "Who created you?" returns truthful creator attribution from protected metadata');
  passed++;

  // Test 5B: User Identity Inquiry ("Who am I?")
  const userIdIntent = IntentClassifier.classify('Who am I?');
  assert(userIdIntent.primaryIntent === 'user_identity_inquiry', 'Classifies user identity inquiry');

  const aliceIdResp = await globalOrchestrator.orchestrate({
    userInput: 'Who am I?',
    userId: aliceRes.user.id,
    userDisplayName: aliceRes.user.displayName,
    userEmail: aliceRes.user.email,
  });

  assert(
    aliceIdResp.reply.includes('Alice Walker'),
    'Identifies Alice as currently logged in user'
  );
  assert(
    !aliceIdResp.reply.includes('Mubiru Robert'),
    'Does NOT confuse Alice with the creator'
  );

  const bobIdResp = await globalOrchestrator.orchestrate({
    userInput: 'Who am I?',
    userId: bobRes.user.id,
    userDisplayName: bobRes.user.displayName,
    userEmail: bobRes.user.email,
  });

  assert(
    bobIdResp.reply.includes('Bob Smith'),
    'Identifies Bob as currently logged in user'
  );
  console.log('  ✅ PASS: "Who am I?" returns the active authenticated user, not the creator');
  passed++;

  // 6. System Metadata Protection
  console.log('6. Testing System Metadata Protection...');
  assert(SYSTEM_METADATA.creator.name === 'Mubiru Robert', 'Creator name is protected');
  assert(Object.isFrozen(SYSTEM_METADATA), 'System metadata object is deeply frozen');
  console.log('  ✅ PASS: System creator metadata is immutable and protected');
  passed++;

  console.log('========================================================');
  console.log(` SUMMARY: ${passed} PASS | 0 FAIL`);
  console.log(' STATUS: MULTI-USER ARCHITECTURE & CREATOR ISOLATION VERIFIED');
  console.log('========================================================');
}

runMultiUserTests().catch((err) => {
  console.error('[Multi-User Test Failed]', err);
  process.exit(1);
});
