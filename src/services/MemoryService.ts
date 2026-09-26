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
}

export class MemoryClient {
  public static async listMemories(category?: MemoryCategory, searchTerm?: string): Promise<MemoryEntry[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (searchTerm) params.set('q', searchTerm);

      const res = await fetch(`/api/rodex/memory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.memories || [];
      }
    } catch (err) {
      console.warn('[MemoryClient] Error fetching memories:', err);
    }
    return [];
  }

  public static async saveMemory(
    key: string,
    value: string,
    category: MemoryCategory = 'fact',
    tags: string[] = []
  ): Promise<MemoryEntry | null> {
    try {
      const res = await fetch('/api/rodex/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, category, tags }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.memory || null;
      }
    } catch (err) {
      console.warn('[MemoryClient] Error saving memory:', err);
    }
    return null;
  }

  public static async deleteMemory(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/rodex/memory/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.deleted);
      }
    } catch (err) {
      console.warn('[MemoryClient] Error deleting memory:', err);
    }
    return false;
  }
}
