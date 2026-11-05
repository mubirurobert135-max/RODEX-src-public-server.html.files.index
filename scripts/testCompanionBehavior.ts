import assert from 'node:assert/strict';
import { getCompanionMotion, getCompanionPose } from '../src/utils/companionBehavior';

const cases: Array<[Parameters<typeof getCompanionPose>[0], string, string]> = [
  ['idle', '', 'rest'],
  ['wake_listening', '', 'rest'],
  ['wake_detected', '', 'attend'],
  ['input_detected', '', 'attend'],
  ['listening', '', 'attend'],
  ['interrupted', '', 'attend'],
  ['thinking', '', 'consider'],
  ['planning', '', 'consider'],
  ['processing', '', 'consider'],
  ['executing', '', 'present'],
  ['executing_tool', '', 'present'],
  ['success', '', 'celebrate'],
  ['permission_required', '', 'ask'],
  ['warning', '', 'concern'],
  ['error', '', 'concern'],
  ['speaking', 'Hello! How can I help?', 'welcome'],
  ['speaking', 'Sorry, I cannot do that.', 'concern'],
  ['speaking', 'The weather is lovely today.', 'converse'],
  ['speaking', 'Great news! You are all set.', 'celebrate'],
];

for (const [state, response, expected] of cases) {
  assert.equal(getCompanionPose(state, response), expected, state + ': ' + response);
}

for (const pose of ['rest','attend','consider','converse','welcome','present','celebrate','concern','ask'] as const) {
  const motion = getCompanionMotion(pose);
  assert(Number.isFinite(motion.head) && Number.isFinite(motion.leftArm));
  assert(Number.isFinite(motion.rightArm) && Number.isFinite(motion.brightness));
}
console.log('RODEX companion nonverbal behavior: ' + cases.length + ' tests passed');
