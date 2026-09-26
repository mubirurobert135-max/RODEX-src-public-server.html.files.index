import { ToolDefinition } from '../types';
import { globalMemoryService } from '../memoryService';

export const memoryTool: ToolDefinition = {
  name: 'manage_user_memory',
  description: 'Store, retrieve, search, or delete long-term facts, preferences, and personal information for the user.',
  permissionLevel: 'safe',
  parameters: {
    action: {
      type: 'string',
      description: 'The memory operation: "save", "search", "get", "delete", "clear_all"',
      required: true,
      enum: ['save', 'search', 'get', 'delete', 'clear_all'],
    },
    key: {
      type: 'string',
      description: 'Key or topic of the memory (e.g. "favorite_programming_language", "city_residence")',
      required: false,
    },
    value: {
      type: 'string',
      description: 'The factual detail or preference to remember',
      required: false,
    },
    category: {
      type: 'string',
      description: 'Category: "preference", "fact", "project", "profile", "custom"',
      required: false,
      enum: ['preference', 'fact', 'project', 'profile', 'custom'],
    },
    tags: {
      type: 'array',
      description: 'Descriptive tags for searchability',
      required: false,
    },
    searchTerm: {
      type: 'string',
      description: 'Search keyword for finding memories',
      required: false,
    },
    memoryId: {
      type: 'string',
      description: 'ID of the specific memory to get or delete',
      required: false,
    },
  },
  handler: async (params, context) => {
    const action = params?.action || 'search';
    const userId = context.userName || 'Robert';

    try {
      if (action === 'save') {
        const key = params.key || 'user_note';
        const value = params.value || '';
        if (!value) {
          return {
            success: false,
            output: null,
            error: 'Cannot save an empty memory value.',
          };
        }

        const saved = await globalMemoryService.save({
          userId,
          category: params.category || 'fact',
          key,
          value,
          confidence: 0.98,
          tags: Array.isArray(params.tags) ? params.tags : [key],
        });

        const spokenMsg = `I have committed that to long-term memory: ${saved.key} is noted as "${saved.value}".`;
        return {
          success: true,
          output: saved,
          message: spokenMsg,
        };
      }

      if (action === 'search' || action === 'get') {
        const term = params.searchTerm || params.key || '';
        const results = await globalMemoryService.search(userId, {
          searchTerm: term,
          category: params.category,
          limit: 10,
        });

        if (results.length === 0) {
          const msg = term
            ? `I have no saved long-term memories matching "${term}".`
            : 'You currently have no custom saved memories in your profile.';
          return {
            success: true,
            output: { count: 0, memories: [] },
            message: msg,
          };
        }

        const summary = results.map((m) => `• ${m.key}: ${m.value}`).join('\n');
        const spokenMsg = `I found ${results.length} saved memor${results.length === 1 ? 'y' : 'ies'}:\n${summary}`;

        return {
          success: true,
          output: { count: results.length, memories: results },
          message: spokenMsg,
        };
      }

      if (action === 'delete') {
        if (params.memoryId) {
          const deleted = await globalMemoryService.delete(params.memoryId);
          return {
            success: deleted,
            output: { deleted, memoryId: params.memoryId },
            message: deleted
              ? 'The specified memory has been deleted.'
              : 'Memory not found or already deleted.',
          };
        }

        const target = params.key || params.searchTerm || '';
        if (target) {
          const count = await globalMemoryService.deleteByKey(userId, target);
          return {
            success: count > 0,
            output: { deletedCount: count, target },
            message: count > 0
              ? `Deleted ${count} memory record${count > 1 ? 's' : ''} related to "${target}".`
              : `No memory found matching "${target}" to delete.`,
          };
        }

        return {
          success: false,
          output: null,
          error: 'Specify a memoryId, key, or topic to delete.',
        };
      }

      if (action === 'clear_all') {
        // Enforce high-risk check if elevated permission is not active
        if (!context.hasElevatedPermission) {
          return {
            success: false,
            output: null,
            requiresConfirmation: true,
            confirmationPayload: {
              actionName: 'manage_user_memory',
              description: 'Permanently erase all your long-term memories and preferences',
              params: { action: 'clear_all' },
            },
            message: 'Erase all long-term memories requires your confirmation.',
          };
        }

        const cleared = await globalMemoryService.clearAll(userId);
        return {
          success: true,
          output: { clearedCount: cleared },
          message: `All ${cleared} saved memory records have been erased from your profile.`,
        };
      }

      return {
        success: false,
        output: null,
        error: `Unsupported memory action "${action}"`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Memory operation failed',
        message: err?.message || 'Unable to complete memory operation.',
      };
    }
  },
  examples: [
    { query: 'Remember that my favorite language is TypeScript', params: { action: 'save', key: 'favorite_programming_language', value: 'TypeScript' } },
    { query: 'What do you remember about me?', params: { action: 'search' } },
    { query: 'Forget that my car is a Honda', params: { action: 'delete', key: 'car' } },
  ],
};
