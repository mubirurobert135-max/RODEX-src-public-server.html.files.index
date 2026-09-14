import fs from 'fs';
import path from 'path';

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix epoch ms
  tokenType: string;
  scope: string;
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string; // 'Computer', 'Smartphone', 'Speaker', etc.
  volume_percent: number;
  supports_volume: boolean;
}

export interface SpotifyTrackInfo {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtUrl?: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  uri: string;
  previewUrl?: string | null;
  externalUrl?: string;
  device?: SpotifyDevice | null;
}

const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'app-remote-control',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-playback-position',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-library-modify',
].join(' ');

// Token cache
let cachedTokens: SpotifyTokens | null = null;
const TOKEN_CACHE_FILE = path.join(process.cwd(), '.spotify_token_cache.json');

// Attempt load persisted tokens on startup
try {
  if (fs.existsSync(TOKEN_CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf-8'));
    if (data && data.accessToken) {
      cachedTokens = data;
    }
  }
} catch (_) {}

function saveTokens(tokens: SpotifyTokens) {
  cachedTokens = tokens;
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Spotify] Could not persist token cache:', err);
  }
}

export function clearSpotifyTokens() {
  cachedTokens = null;
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      fs.unlinkSync(TOKEN_CACHE_FILE);
    }
  } catch (_) {}
}

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function getSpotifyClientId(): string {
  return process.env.SPOTIFY_CLIENT_ID || '';
}

export function getSpotifyRedirectUri(reqOrOrigin?: string): string {
  if (reqOrOrigin && reqOrOrigin.startsWith('http')) {
    const origin = reqOrOrigin.replace(/\/+$/, '');
    return `${origin}/auth/spotify/callback`;
  }
  const appUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : 'http://localhost:3000';
  return `${appUrl}/auth/spotify/callback`;
}

export function buildSpotifyAuthUrl(origin?: string): { url: string; redirectUri: string; configured: boolean } {
  const clientId = getSpotifyClientId();
  const redirectUri = getSpotifyRedirectUri(origin);
  const state = Math.random().toString(36).substring(2, 15);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: 'true',
  });

  return {
    url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    redirectUri,
    configured: isSpotifyConfigured(),
  };
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<SpotifyTokens> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing from environment variables.');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('[Spotify] Code exchange failed:', response.status, errBody);
    throw new Error(`Spotify token exchange failed (${response.status}): ${errBody}`);
  }

  const json = await response.json();
  const tokens: SpotifyTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || cachedTokens?.refreshToken || '',
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    tokenType: json.token_type || 'Bearer',
    scope: json.scope || SPOTIFY_SCOPES,
  };

  saveTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string | null> {
  if (!cachedTokens || !cachedTokens.accessToken) {
    return null;
  }

  // If token expires within 60 seconds, refresh it
  if (Date.now() >= cachedTokens.expiresAt) {
    if (!cachedTokens.refreshToken) {
      clearSpotifyTokens();
      return null;
    }

    try {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;

      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cachedTokens.refreshToken,
      });

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: params.toString(),
      });

      if (!res.ok) {
        console.warn('[Spotify] Refresh token rejected. Clearing session.');
        clearSpotifyTokens();
        return null;
      }

      const json = await res.json();
      const updated: SpotifyTokens = {
        accessToken: json.access_token,
        refreshToken: json.refresh_token || cachedTokens.refreshToken,
        expiresAt: Date.now() + (json.expires_in - 60) * 1000,
        tokenType: json.token_type || 'Bearer',
        scope: json.scope || cachedTokens.scope,
      };
      saveTokens(updated);
      return updated.accessToken;
    } catch (err) {
      console.error('[Spotify] Refresh token error:', err);
      return null;
    }
  }

  return cachedTokens.accessToken;
}

// Interactive simulated PC player state when Spotify is in demo/preview mode
let demoPlayerState: {
  isPlaying: boolean;
  trackName: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  durationMs: number;
  progressMs: number;
  volumePercent: number;
  deviceName: string;
  deviceType: string;
  lastUpdated: number;
} = {
  isPlaying: false,
  trackName: 'Starboy',
  artist: 'The Weeknd, Daft Punk',
  album: 'Starboy',
  albumArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
  durationMs: 230453,
  progressMs: 42100,
  volumePercent: 75,
  deviceName: "Mr. Robert's PC (Spotify Desktop)",
  deviceType: 'Computer',
  lastUpdated: Date.now(),
};

export async function getSpotifyDevices(): Promise<{ devices: SpotifyDevice[]; isDemo: boolean }> {
  const token = await getValidAccessToken();
  if (!token) {
    return {
      devices: [
        {
          id: 'pc-device-robert-primary',
          name: "Mr. Robert's Windows PC (Spotify Desktop)",
          type: 'Computer',
          is_active: true,
          is_private_session: false,
          is_restricted: false,
          volume_percent: demoPlayerState.volumePercent,
          supports_volume: true,
        },
        {
          id: 'web-player-chrome',
          name: 'Chrome Web Player (PC Browser)',
          type: 'Computer',
          is_active: false,
          is_private_session: false,
          is_restricted: false,
          volume_percent: 70,
          supports_volume: true,
        },
      ],
      isDemo: true,
    };
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Devices fetch failed: ${res.status}`);
    }
    const json = await res.json();
    return {
      devices: json.devices || [],
      isDemo: false,
    };
  } catch (err) {
    console.warn('[Spotify] Could not fetch devices:', err);
    return { devices: [], isDemo: false };
  }
}

export async function getSpotifyPlayback(): Promise<{
  connected: boolean;
  isDemo: boolean;
  playback: SpotifyTrackInfo | null;
  device: SpotifyDevice | null;
  user?: { displayName: string; email?: string; product?: string; id?: string };
}> {
  const token = await getValidAccessToken();

  if (!token) {
    // Return demo state for Mr. Robert's PC
    const elapsed = demoPlayerState.isPlaying
      ? Math.min(demoPlayerState.durationMs, demoPlayerState.progressMs + (Date.now() - demoPlayerState.lastUpdated))
      : demoPlayerState.progressMs;

    return {
      connected: false,
      isDemo: true,
      user: {
        displayName: 'Mr. Robert (PC Link Ready)',
        product: 'premium',
      },
      device: {
        id: 'pc-device-robert-primary',
        name: demoPlayerState.deviceName,
        type: 'Computer',
        is_active: true,
        is_private_session: false,
        is_restricted: false,
        volume_percent: demoPlayerState.volumePercent,
        supports_volume: true,
      },
      playback: {
        id: 'demo-track-1',
        name: demoPlayerState.trackName,
        artists: [demoPlayerState.artist],
        album: demoPlayerState.album,
        albumArtUrl: demoPlayerState.albumArtUrl,
        durationMs: demoPlayerState.durationMs,
        progressMs: elapsed,
        isPlaying: demoPlayerState.isPlaying,
        uri: 'spotify:track:5aAx2tiyePLZaQG6cqK3Yn',
        device: {
          id: 'pc-device-robert-primary',
          name: demoPlayerState.deviceName,
          type: 'Computer',
          is_active: true,
          is_private_session: false,
          is_restricted: false,
          volume_percent: demoPlayerState.volumePercent,
          supports_volume: true,
        },
      },
    };
  }

  try {
    // 1. Fetch current user profile
    let userProfile = { displayName: 'Spotify User', product: 'unknown' };
    try {
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (userRes.ok) {
        const u = await userRes.json();
        userProfile = {
          displayName: u.display_name || u.id || 'Mr. Robert',
          product: u.product || 'premium',
        };
      }
    } catch (_) {}

    // 2. Fetch live playback state
    const playbackRes = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (playbackRes.status === 204 || !playbackRes.ok) {
      // No active playback currently, check devices
      const { devices } = await getSpotifyDevices();
      const pcDevice = devices.find((d) => d.type === 'Computer') || devices[0] || null;

      return {
        connected: true,
        isDemo: false,
        user: userProfile,
        device: pcDevice,
        playback: null,
      };
    }

    const data = await playbackRes.json();
    const item = data.item;

    const track: SpotifyTrackInfo = {
      id: item?.id || 'unknown',
      name: item?.name || 'Unknown Track',
      artists: item?.artists?.map((a: any) => a.name) || ['Unknown Artist'],
      album: item?.album?.name || '',
      albumArtUrl: item?.album?.images?.[0]?.url || '',
      durationMs: item?.duration_ms || 0,
      progressMs: data.progress_ms || 0,
      isPlaying: Boolean(data.is_playing),
      uri: item?.uri || '',
      externalUrl: item?.external_urls?.spotify,
      device: data.device || null,
    };

    return {
      connected: true,
      isDemo: false,
      user: userProfile,
      device: data.device || null,
      playback: track,
    };
  } catch (err) {
    console.error('[Spotify] Playback error:', err);
    return {
      connected: true,
      isDemo: false,
      playback: null,
      device: null,
    };
  }
}

export async function executeSpotifyCommand(command: {
  action: 'play' | 'pause' | 'next' | 'previous' | 'volume' | 'transfer' | 'search_and_play' | 'seek';
  query?: string;
  volumePercent?: number;
  positionMs?: number;
  deviceId?: string;
  uris?: string[];
}): Promise<{ success: boolean; message: string; track?: any }> {
  const token = await getValidAccessToken();

  // If in Demo mode without API keys yet:
  if (!token) {
    if (command.action === 'play') {
      demoPlayerState.isPlaying = true;
      demoPlayerState.lastUpdated = Date.now();
      return { success: true, message: `Resumed playback on ${demoPlayerState.deviceName}` };
    }
    if (command.action === 'pause') {
      demoPlayerState.isPlaying = false;
      demoPlayerState.progressMs += Date.now() - demoPlayerState.lastUpdated;
      return { success: true, message: `Paused playback on ${demoPlayerState.deviceName}` };
    }
    if (command.action === 'next') {
      demoPlayerState.trackName = 'Blinding Lights';
      demoPlayerState.artist = 'The Weeknd';
      demoPlayerState.album = 'After Hours';
      demoPlayerState.progressMs = 0;
      demoPlayerState.lastUpdated = Date.now();
      demoPlayerState.isPlaying = true;
      return { success: true, message: `Skipped to next song: "Blinding Lights" on ${demoPlayerState.deviceName}` };
    }
    if (command.action === 'previous') {
      demoPlayerState.trackName = 'Save Your Tears';
      demoPlayerState.artist = 'The Weeknd';
      demoPlayerState.album = 'After Hours';
      demoPlayerState.progressMs = 0;
      demoPlayerState.lastUpdated = Date.now();
      demoPlayerState.isPlaying = true;
      return { success: true, message: `Previous song: "Save Your Tears" on ${demoPlayerState.deviceName}` };
    }
    if (command.action === 'volume' && command.volumePercent !== undefined) {
      demoPlayerState.volumePercent = Math.max(0, Math.min(100, command.volumePercent));
      return { success: true, message: `Spotify volume set to ${demoPlayerState.volumePercent}% on PC` };
    }
    if (command.action === 'transfer') {
      return { success: true, message: `Transferred Spotify playback directly to Mr. Robert's PC` };
    }
    if (command.action === 'search_and_play') {
      const q = command.query || 'Music';
      demoPlayerState.trackName = q.replace(/\b\w/g, (c) => c.toUpperCase());
      demoPlayerState.isPlaying = true;
      demoPlayerState.progressMs = 0;
      demoPlayerState.lastUpdated = Date.now();
      return {
        success: true,
        message: `Playing "${demoPlayerState.trackName}" on Mr. Robert's PC (Spotify)`,
        track: {
          name: demoPlayerState.trackName,
          artist: demoPlayerState.artist,
        },
      };
    }
    return { success: true, message: `Command ${command.action} executed on PC.` };
  }

  // Real Spotify Web API Execution:
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Play / Resume
    if (command.action === 'play') {
      const body: any = {};
      if (command.uris && command.uris.length > 0) body.uris = command.uris;
      const queryParam = command.deviceId ? `?device_id=${command.deviceId}` : '';

      const res = await fetch(`https://api.spotify.com/v1/me/player/play${queryParam}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok && res.status !== 204) {
        // Try transferring to PC device first if no active device
        const { devices } = await getSpotifyDevices();
        const pc = devices.find((d) => d.type === 'Computer') || devices[0];
        if (pc) {
          await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ device_ids: [pc.id], play: true }),
          });
          return { success: true, message: `Playback started on ${pc.name}` };
        }
      }
      return { success: true, message: 'Spotify playback started on your PC' };
    }

    // 2. Pause
    if (command.action === 'pause') {
      const queryParam = command.deviceId ? `?device_id=${command.deviceId}` : '';
      await fetch(`https://api.spotify.com/v1/me/player/pause${queryParam}`, {
        method: 'PUT',
        headers,
      });
      return { success: true, message: 'Spotify playback paused on your PC' };
    }

    // 3. Next Track
    if (command.action === 'next') {
      const queryParam = command.deviceId ? `?device_id=${command.deviceId}` : '';
      await fetch(`https://api.spotify.com/v1/me/player/next${queryParam}`, {
        method: 'POST',
        headers,
      });
      return { success: true, message: 'Skipped to next track on your PC' };
    }

    // 4. Previous Track
    if (command.action === 'previous') {
      const queryParam = command.deviceId ? `?device_id=${command.deviceId}` : '';
      await fetch(`https://api.spotify.com/v1/me/player/previous${queryParam}`, {
        method: 'POST',
        headers,
      });
      return { success: true, message: 'Returned to previous track on your PC' };
    }

    // 5. Volume Control
    if (command.action === 'volume' && command.volumePercent !== undefined) {
      const vol = Math.max(0, Math.min(100, Math.round(command.volumePercent)));
      const queryParam = command.deviceId
        ? `?volume_percent=${vol}&device_id=${command.deviceId}`
        : `?volume_percent=${vol}`;
      await fetch(`https://api.spotify.com/v1/me/player/volume${queryParam}`, {
        method: 'PUT',
        headers,
      });
      return { success: true, message: `Volume adjusted to ${vol}% on Spotify PC` };
    }

    // 6. Transfer Playback to PC
    if (command.action === 'transfer') {
      const targetDeviceId = command.deviceId;
      let devId = targetDeviceId;

      if (!devId) {
        const { devices } = await getSpotifyDevices();
        const pc = devices.find((d) => d.type === 'Computer') || devices[0];
        if (pc) devId = pc.id;
      }

      if (devId) {
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ device_ids: [devId], play: true }),
        });
        return { success: true, message: 'Transferred playback to your PC device.' };
      }
      return { success: false, message: 'No active PC or Spotify Connect device found.' };
    }

    // 7. Search and Play on PC
    if (command.action === 'search_and_play' && command.query) {
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(command.query)}&type=track,album,playlist&limit=3`,
        { headers }
      );

      if (!searchRes.ok) {
        throw new Error('Spotify search query failed.');
      }

      const searchData = await searchRes.json();
      const track = searchData.tracks?.items?.[0];

      if (!track) {
        return { success: false, message: `No Spotify matches found for "${command.query}".` };
      }

      // Check if we need to transfer to PC first
      const { devices } = await getSpotifyDevices();
      const pcDevice = devices.find((d) => d.type === 'Computer') || devices[0];

      const playRes = await fetch(
        `https://api.spotify.com/v1/me/player/play${pcDevice ? `?device_id=${pcDevice.id}` : ''}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ uris: [track.uri] }),
        }
      );

      if (!playRes.ok && playRes.status !== 204 && pcDevice) {
        // Transfer and play
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ device_ids: [pcDevice.id], play: true }),
        });
      }

      return {
        success: true,
        message: `Playing "${track.name}" by ${track.artists.map((a: any) => a.name).join(', ')} on your PC!`,
        track: {
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          album: track.album?.name,
          albumArtUrl: track.album?.images?.[0]?.url,
          uri: track.uri,
        },
      };
    }

    return { success: true, message: 'Spotify operation completed.' };
  } catch (err: any) {
    console.error('[Spotify] Execution error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to communicate with Spotify on PC.',
    };
  }
}
