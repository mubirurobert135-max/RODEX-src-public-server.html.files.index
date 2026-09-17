import { ToolDefinition } from '../types';
import { executeSpotifyCommand, getSpotifyPlayback } from '../../spotify';

export const mediaControlTool: ToolDefinition = {
  name: 'media_control',
  description: 'Control Spotify PC playback, search tracks/artists, manage volume, play, pause, or query currently playing audio.',
  permissionLevel: 'safe',
  parameters: {
    action: {
      type: 'string',
      description: 'Media action: "play", "pause", "next", "previous", "volume", "search_and_play", "status"',
      enum: ['play', 'pause', 'next', 'previous', 'volume', 'search_and_play', 'status'],
      required: true,
    },
    query: {
      type: 'string',
      description: 'Track title, album, or artist name when using search_and_play',
    },
    volumePercent: {
      type: 'number',
      description: 'Volume level from 0 to 100 when action is "volume"',
    },
  },
  handler: async (params) => {
    const { action, query, volumePercent } = params;

    if (!action) {
      return {
        success: false,
        output: null,
        error: 'An action parameter (play, pause, next, previous, volume, search_and_play, status) is required.',
      };
    }

    try {
      if (action === 'status') {
        const pb = await getSpotifyPlayback();
        if (pb.playback) {
          return {
            success: true,
            output: pb,
            message: `Currently playing "${pb.playback.name}" by ${pb.playback.artists.join(', ')} on ${pb.device?.name || 'PC'}.`,
            sources: [
              {
                title: 'Spotify PC Connect',
                url: pb.playback.externalUrl || 'https://open.spotify.com',
                domain: 'spotify.com',
              },
            ],
          };
        } else {
          return {
            success: true,
            output: pb,
            message: 'No track is currently playing on Spotify PC.',
          };
        }
      }

      const result = await executeSpotifyCommand({
        action,
        query,
        volumePercent,
      });

      const currentPb = await getSpotifyPlayback();

      return {
        success: result.success !== false,
        output: {
          commandResult: result,
          playback: currentPb.playback,
          device: currentPb.device,
        },
        message: result.message || `Spotify ${action} command dispatched.`,
        sources: [
          {
            title: 'Spotify PC Controller',
            url: 'https://open.spotify.com',
            domain: 'spotify.com',
          },
        ],
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: `Media control error: ${err?.message}`,
      };
    }
  },
  examples: [
    { query: 'Play music on Spotify', params: { action: 'play' } },
    { query: 'Pause Spotify', params: { action: 'pause' } },
    { query: 'Set volume to 80', params: { action: 'volume', volumePercent: 80 } },
    { query: 'What song is playing?', params: { action: 'status' } },
  ],
};
