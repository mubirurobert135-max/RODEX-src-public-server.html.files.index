import { ToolDefinition } from '../types';

export const appActionTool: ToolDefinition = {
  name: 'app_action',
  description: 'Trigger application navigation, open feature modals, configure voice settings, or trigger administrative actions in RODEX.',
  permissionLevel: 'safe',
  parameters: {
    action: {
      type: 'string',
      description: 'The app action to perform: "open_settings", "open_voice_profile", "open_security_center", "open_spotify_player", "open_modes", "open_update_center", "open_user_profile", "open_web_verifier", "clear_history"',
      enum: [
        'open_settings',
        'open_voice_profile',
        'open_security_center',
        'open_spotify_player',
        'open_modes',
        'open_update_center',
        'open_user_profile',
        'open_web_verifier',
        'clear_history',
      ],
      required: true,
    },
  },
  handler: async (params, context) => {
    const action = params?.action;

    if (!action) {
      return {
        success: false,
        output: null,
        error: 'An action name is required.',
      };
    }

    // Check for high-risk action: clearing session history
    if (action === 'clear_history') {
      if (!context?.hasElevatedPermission) {
        return {
          success: false,
          output: null,
          requiresConfirmation: true,
          confirmationPayload: {
            actionName: 'clear_history',
            description: 'Clear all stored chat history and live transcript messages.',
            params,
          },
          message: 'Clearing chat history is a destructive action requiring explicit operator confirmation.',
        };
      }
    }

    const actionMap: Record<string, string> = {
      open_settings: 'Opening Settings & Secrets Modal.',
      open_voice_profile: 'Opening Biometric Voice Profile & Calibration.',
      open_security_center: 'Opening RODEX Security Center.',
      open_spotify_player: 'Opening Spotify Desktop Connect Player.',
      open_modes: 'Opening RODEX Operating Modes.',
      open_update_center: 'Opening System Update & Technology Center.',
      open_user_profile: 'Opening User Account Profile & Settings.',
      open_web_verifier: 'Opening World Wide Web Link Verifier.',
      clear_history: 'Chat history cleared successfully.',
    };

    return {
      success: true,
      output: {
        action,
        executedAt: new Date().toISOString(),
      },
      message: actionMap[action] || `App action '${action}' triggered.`,
    };
  },
  examples: [
    { query: 'Open Settings', params: { action: 'open_settings' } },
    { query: 'Open Voice Profile', params: { action: 'open_voice_profile' } },
    { query: 'Open Security Center', params: { action: 'open_security_center' } },
  ],
};
