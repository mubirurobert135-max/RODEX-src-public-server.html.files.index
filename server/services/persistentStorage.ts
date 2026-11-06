import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Keep user/session/memory JSON outside Git-tracked source. Migrate copies of
 * legacy records on first startup, preserving the originals as a fallback.
 * Production deployments must provide a PERSISTENT volume at RODEX_DATA_DIR;
 * ephemeral hosts lose local data between deployments.
 */
export function resolveRodexDataFile(filename: string, legacyRelativePath: string): string {
  if (!/^\.[a-z0-9_-]+\.json$/i.test(filename)) {
    throw new Error('Invalid RODEX data filename');
  }
  const dir = path.resolve(process.env.RODEX_DATA_DIR || path.join(process.cwd(), 'data'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const destination = path.join(dir, filename);
  const legacy = path.resolve(process.cwd(), legacyRelativePath);
  if (!fs.existsSync(destination) && fs.existsSync(legacy)) {
    // COPYFILE_EXCL protects concurrently initialized deployments against
    // silently overwriting an existing migrated database.
    try {
      fs.copyFileSync(legacy, destination, fs.constants.COPYFILE_EXCL);
      try { fs.chmodSync(destination, 0o600); } catch { /* Windows */ }
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        console.warn('[RODEX storage] Legacy migration failed:', error?.code || 'filesystem error');
      }
    }
  }
  return destination;
}

export function writeRodexJson(filePath: string, data: unknown): void {
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* ignore */ }
  }
}
