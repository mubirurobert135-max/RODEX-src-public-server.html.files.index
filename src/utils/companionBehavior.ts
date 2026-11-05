import { AssistantState } from '../types';

/**
 * RODEX keeps its technical states private and communicates through body language.
 * Pose names are internal animation instructions, never UI captions.
 */
export type CompanionPose =
  | 'rest'
  | 'attend'
  | 'consider'
  | 'converse'
  | 'welcome'
  | 'present'
  | 'celebrate'
  | 'concern'
  | 'ask';

export function getCompanionPose(state: AssistantState, utterance = ''): CompanionPose {
  switch (state) {
    case 'wake_detected':
    case 'listening':
    case 'input_detected':
    case 'interrupted':
      return 'attend';
    case 'thinking':
    case 'planning':
    case 'processing':
      return 'consider';
    case 'executing':
    case 'executing_tool':
      return 'present';
    case 'success':
      return 'celebrate';
    case 'permission_required':
      return 'ask';
    case 'warning':
    case 'error':
      return 'concern';
    case 'speaking': {
      // Speech content provides a soft conversational gesture hint.
      // An actual tool result still controls success and action poses.
      const said = utterance.trim().toLowerCase();
      if (/^(hello|hi|hey|good morning|good afternoon|good evening|welcome)\b/.test(said)) {
        return 'welcome';
      }
      if (/\b(sorry|apologize|unfortunately|cannot|can't|unable)\b/.test(said)) {
        return 'concern';
      }
      if (/\b(well done|completed successfully|great news|congratulations)\b/.test(said)) {
        return 'celebrate';
      }
      return 'converse';
    }
    case 'wake_listening':
    case 'idle':
    default:
      return 'rest';
  }
}

export function getCompanionMotion(pose: CompanionPose) {
  switch (pose) {
    case 'attend': return { head: -6, leftArm: 3, rightArm: -4, lean: -2, brightness: 1.3 };
    case 'consider': return { head: 7, leftArm: 0, rightArm: -17, lean: 1, brightness: 1.12 };
    case 'welcome': return { head: -4, leftArm: -7, rightArm: -25, lean: -2, brightness: 1.4 };
    case 'converse': return { head: -2, leftArm: -5, rightArm: -12, lean: -1, brightness: 1.25 };
    case 'present': return { head: -3, leftArm: -3, rightArm: -30, lean: -3, brightness: 1.42 };
    case 'celebrate': return { head: -5, leftArm: -14, rightArm: -35, lean: -3, brightness: 1.5 };
    case 'concern': return { head: 8, leftArm: 5, rightArm: 3, lean: 3, brightness: .85 };
    case 'ask': return { head: 7, leftArm: 0, rightArm: -20, lean: 2, brightness: 1.1 };
    case 'rest':
    default: return { head: 0, leftArm: 0, rightArm: 0, lean: 0, brightness: 1 };
  }
}
