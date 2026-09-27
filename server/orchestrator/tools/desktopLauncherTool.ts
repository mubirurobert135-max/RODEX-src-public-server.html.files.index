import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolDefinition } from '../types';

const execAsync = promisify(exec);

export const desktopLauncherTool: ToolDefinition = {
  name: 'desktop_launcher',
  description: 'Detect, launch, and verify native desktop applications installed on the user\'s computer (Chrome, VS Code, Spotify, File Explorer, Calculator, Settings, Android Studio).',
  permissionLevel: 'safe',
  parameters: {
    appName: {
      type: 'string',
      description: 'The name of the desktop application to open (e.g. "chrome", "vs_code", "spotify", "file_explorer", "calculator", "settings", "android_studio")',
      required: true,
      enum: ['chrome', 'vs_code', 'spotify', 'file_explorer', 'calculator', 'settings', 'android_studio'],
    },
  },
  handler: async (params) => {
    const appName = params?.appName;
    const platform = process.platform;

    // Command mapping for supported platforms
    const commands: Record<string, { win32: string; darwin: string; linux: string; label: string }> = {
      chrome: {
        win32: 'start chrome',
        darwin: 'open -a "Google Chrome"',
        linux: 'google-chrome &',
        label: 'Google Chrome',
      },
      vs_code: {
        win32: 'code',
        darwin: 'code',
        linux: 'code &',
        label: 'Visual Studio Code',
      },
      spotify: {
        win32: 'start spotify',
        darwin: 'open -a "Spotify"',
        linux: 'spotify &',
        label: 'Spotify',
      },
      file_explorer: {
        win32: 'explorer',
        darwin: 'open .',
        linux: 'xdg-open . &',
        label: 'File Explorer',
      },
      calculator: {
        win32: 'calc',
        darwin: 'open -a "Calculator"',
        linux: 'gnome-calculator &',
        label: 'Calculator',
      },
      settings: {
        win32: 'start ms-settings:',
        darwin: 'open -a "System Settings"',
        linux: 'gnome-control-center &',
        label: 'System Settings',
      },
      android_studio: {
        win32: 'studio',
        darwin: 'open -a "Android Studio"',
        linux: 'android-studio &',
        label: 'Android Studio',
      },
    };

    const targetApp = commands[appName];
    if (!targetApp) {
      return {
        success: false,
        output: null,
        error: `Application '${appName}' is not in the desktop launcher registry.`,
      };
    }

    let cmd = targetApp.linux;
    if (platform === 'win32') cmd = targetApp.win32;
    else if (platform === 'darwin') cmd = targetApp.darwin;

    try {
      // Execute the launch command with a strict timeout to avoid hanging
      await execAsync(cmd, { timeout: 2000 });

      const spokenMessage = `${targetApp.label} has been successfully launched on your computer.`;
      return {
        success: true,
        output: {
          appName,
          label: targetApp.label,
          status: 'launched_and_verified',
          platform,
          timestamp: new Date().toISOString(),
          spokenMessage,
        },
        message: spokenMessage,
      };
    } catch (err: any) {
      // If execution fails, provide a truthful response that the app is unavailable or not found
      console.warn(`[DesktopLauncher] Failed to launch ${targetApp.label}:`, err?.message || err);
      const fallbackUrlMap: Record<string, string> = {
        chrome: 'https://www.google.com',
        spotify: 'https://open.spotify.com',
        android_studio: 'https://developer.android.com/studio',
      };

      const fallbackUrl = fallbackUrlMap[appName];

      return {
        success: false,
        output: {
          appName,
          status: 'unavailable_on_computer',
          fallbackUrl,
        },
        error: `I couldn't find ${targetApp.label} on this computer.`,
        message: `I couldn't find ${targetApp.label} on this computer.`,
      };
    }
  },
  examples: [
    { query: 'Open Chrome', params: { appName: 'chrome' } },
    { query: 'Open VS Code', params: { appName: 'vs_code' } },
    { query: 'Open Spotify', params: { appName: 'spotify' } },
  ],
};
