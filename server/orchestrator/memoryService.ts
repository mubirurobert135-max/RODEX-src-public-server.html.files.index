import fs from 'fs';
import { resolveRodexDataFile, writeRodexJson } from '../services/persistentStorage';

export type MemoryCategory = 'preference' | 'fact' | 'project' | 'profile' | 'routine' | 'custom';

export interface MemoryEntry {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isSensitive?: boolean;
}

export interface MemoryFilterOptions {
  category?: MemoryCategory;
  searchTerm?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Clean Interface for Long-Term Memory Repository
 * Enables persistent local JSON storage now, and maps 1:1 to Firebase Firestore
 * collection `users/{userId}/memories` when provisioned.
 */
export interface IMemoryRepository {
  save(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | null>;
  search(userId: string, options?: MemoryFilterOptions): Promise<MemoryEntry[]>;
  update(id: string, updates: Partial<Pick<MemoryEntry, 'value' | 'category' | 'tags'>>): Promise<MemoryEntry | null>;
  delete(id: string): Promise<boolean>;
  clearAll(userId: string): Promise<number>;
}

export class MemoryService implements IMemoryRepository {
  private static instance: MemoryService | null = null;
  private storagePath: string;
  private memoryCache: Map<string, MemoryEntry> = new Map();

  private constructor() {
    this.storagePath = resolveRodexDataFile('.rodex_memory.json', '.rodex_memory.json');
    this.loadFromDisk();
  }

  public static getInstance(): MemoryService {
    if (!this.instance) {
      this.instance = new MemoryService();
    }
    return this.instance;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.memoryCache.clear();
          for (const item of data) {
            if (item && item.id) {
              this.memoryCache.set(item.id, item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[RODEX MemoryService] Warning loading memories from disk:', err);
      // A corrupt memory file is not overwritten with synthetic user memories.
    }
  }

  private saveToDisk(): void {
    try {
      const arr = Array.from(this.memoryCache.values());
      writeRodexJson(this.storagePath, arr);
    } catch (err) {
      console.error('[RODEX MemoryService] Error saving memories to disk:', err);
    }
  }

  /**
   * Security Filter: Prevent saving passwords, API keys, tokens, or secret credentials as memories
   */
  public static isSensitiveSecret(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    const sensitivePatterns = [
      /(password|passwd|api[_\s-]?key|secret[_\s-]?key|auth[_\s-]?token|bearer\s+[a-z0-9_\-\.]{20,}|private[_\s-]?key|ssh-rsa|sk-[a-z0-9_-]{20,}|ghp_[a-z0-9]{20,})/i,
      /\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/, // Credit card format
      /(my password is|api key is|secret is|pin code is)\s*[:=]?\s*\S+/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(lower));
  }

  private saveSync(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): MemoryEntry {
    const now = new Date().toISOString();
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryCache.set(id, fullEntry);
    this.saveToDisk();
    return fullEntry;
  }

  public async save(
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MemoryEntry> {
    if (MemoryService.isSensitiveSecret(entry.key) || MemoryService.isSensitiveSecret(entry.value)) {
      throw new Error(
        'Security guardrail activated: Saving passwords, API keys, authentication tokens, or payment secrets as memories is strictly prohibited.'
      );
    }

    // Check if an existing memory with the same key exists for this user; if so, update it
    const existing = Array.from(this.memoryCache.values()).find(
      (m) => m.userId === entry.userId && m.key.toLowerCase() === entry.key.toLowerCase()
    );

    if (existing) {
      existing.value = entry.value;
      existing.category = entry.category || existing.category;
      existing.tags = Array.from(new Set([...existing.tags, ...(entry.tags || [])]));
      existing.updatedAt = new Date().toISOString();
      this.saveToDisk();
      return existing;
    }

    return this.saveSync(entry);
  }

  public async get(id: string): Promise<MemoryEntry | null> {
    return this.memoryCache.get(id) || null;
  }

  public async search(userId: string = 'Robert', options?: MemoryFilterOptions): Promise<MemoryEntry[]> {
    let results = Array.from(this.memoryCache.values()).filter(
      (m) => m.userId.toLowerCase() === userId.toLowerCase()
    );

    if (options?.category) {
      results = results.filter((m) => m.category === options.category);
    }

    if (options?.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      results = results.filter(
        (m) =>
          m.key.toLowerCase().includes(term) ||
          m.value.toLowerCase().includes(term) ||
          m.tags.some((t) => t.toLowerCase().includes(term))
      );
    }

    if (options?.tags && options.tags.length > 0) {
      const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
      results = results.filter((m) => m.tags.some((t) => tagSet.has(t.toLowerCase())));
    }

    // Sort by most recently updated
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  public async update(
    id: string,
    updates: Partial<Pick<MemoryEntry, 'value' | 'category' | 'tags'>>
  ): Promise<MemoryEntry | null> {
    const existing = this.memoryCache.get(id);
    if (!existing) return null;

    if (updates.value && MemoryService.isSensitiveSecret(updates.value)) {
      throw new Error('Security guardrail: Cannot update memory with sensitive credentials.');
    }

    if (updates.value !== undefined) existing.value = updates.value;
    if (updates.category !== undefined) existing.category = updates.category;
    if (updates.tags !== undefined) existing.tags = updates.tags;
    existing.updatedAt = new Date().toISOString();

    this.saveToDisk();
    return existing;
  }

  public async delete(id: string, userId?: string): Promise<boolean> {
    const existing = this.memoryCache.get(id);
    if (!existing) return false;
    if (userId && existing.userId && existing.userId.toLowerCase() !== userId.toLowerCase()) {
      throw new Error('Access denied: Cannot delete memory belonging to another user.');
    }
    const existed = this.memoryCache.delete(id);
    if (existed) {
      this.saveToDisk();
    }
    return existed;
  }

  public async deleteByKey(userId: string, keyOrTopic: string): Promise<number> {
    const lower = keyOrTopic.toLowerCase();
    let deletedCount = 0;
    for (const [id, entry] of this.memoryCache.entries()) {
      if (
        entry.userId.toLowerCase() === userId.toLowerCase() &&
        (entry.key.toLowerCase().includes(lower) || entry.value.toLowerCase().includes(lower))
      ) {
        this.memoryCache.delete(id);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.saveToDisk();
    }
    return deletedCount;
  }

  public async clearAll(userId: string = 'Robert'): Promise<number> {
    let count = 0;
    for (const [id, entry] of this.memoryCache.entries()) {
      if (entry.userId.toLowerCase() === userId.toLowerCase()) {
        this.memoryCache.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.saveToDisk();
    }
    return count;
  }

  /**
   * Builds formatted string of relevant user memories to inject into system prompt
   */
  public async getPromptMemoryContext(userId: string = 'Robert', queryText?: string): Promise<string> {
    const allMemories = await this.search(userId, { limit: 10 });
    if (allMemories.length === 0) return '';

    const lines = allMemories.map((m) => `- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`);
    return `LONG-TERM USER MEMORY & PREFERENCES:\n${lines.join('\n')}\nUse these remembered details to personalize responses seamlessly.`;
  }
}

export const globalMemoryService = MemoryService.getInstance();
