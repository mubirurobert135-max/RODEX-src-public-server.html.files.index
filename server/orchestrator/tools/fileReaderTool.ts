import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../types';

// Whitelist of permitted file extensions and directories for knowledge / code inspection
const PERMITTED_EXTENSIONS = new Set(['.json', '.ts', '.tsx', '.js', '.md', '.txt', '.css', '.html']);
const FORBIDDEN_NAMES = new Set(['.env', '.env.local', 'id_rsa', 'credentials.json', 'secrets.json']);

export const fileReaderTool: ToolDefinition = {
  name: 'read_permitted_file',
  description: 'Safely read project files or knowledge configuration documents within the application workspace with strict path traversal protection.',
  permissionLevel: 'safe',
  parameters: {
    filePath: {
      type: 'string',
      description: 'The relative file path to read (e.g. "package.json", "metadata.json", "README.md", "src/types.ts")',
      required: true,
    },
    maxLines: {
      type: 'number',
      description: 'Maximum number of lines to return (default: 80, max: 200)',
      default: 80,
    },
  },
  handler: async (params) => {
    const rawPath = params?.filePath;
    if (!rawPath || typeof rawPath !== 'string') {
      return {
        success: false,
        output: null,
        error: 'A valid file path is required.',
      };
    }

    const workspaceRoot = process.cwd();
    // Resolve clean absolute path
    const resolvedPath = path.resolve(workspaceRoot, rawPath.replace(/^\/+/, ''));

    // Check Path Traversal: Ensure the resolved path resides strictly inside workspaceRoot
    if (!resolvedPath.startsWith(workspaceRoot)) {
      return {
        success: false,
        output: null,
        error: 'Access denied: Path escapes the application workspace directory.',
      };
    }

    const baseName = path.basename(resolvedPath).toLowerCase();
    const ext = path.extname(resolvedPath).toLowerCase();

    if (FORBIDDEN_NAMES.has(baseName) || baseName.startsWith('.env')) {
      return {
        success: false,
        output: null,
        error: 'Access denied: Reading secret or environment configuration files is restricted.',
      };
    }

    if (!PERMITTED_EXTENSIONS.has(ext)) {
      return {
        success: false,
        output: null,
        error: `Access denied: File type '${ext}' is not permitted for inspection.`,
      };
    }

    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          output: null,
          error: 'Specified path is not a regular file.',
        };
      }

      // Check file size (cap at 250KB)
      if (stats.size > 250 * 1024) {
        return {
          success: false,
          output: null,
          error: 'File size exceeds maximum inspection threshold (250KB).',
        };
      }

      const content = await fs.readFile(resolvedPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const limit = Math.min(params.maxLines || 80, 200);
      const slicedContent = lines.slice(0, limit).join('\n');
      const isTruncated = lines.length > limit;

      return {
        success: true,
        output: {
          filePath: path.relative(workspaceRoot, resolvedPath),
          totalLines: lines.length,
          displayedLines: Math.min(lines.length, limit),
          isTruncated,
          content: slicedContent,
        },
        message: `Successfully read ${path.relative(workspaceRoot, resolvedPath)} (${lines.length} lines).`,
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return {
          success: false,
          output: null,
          error: `File not found: ${rawPath}`,
        };
      }
      return {
        success: false,
        output: null,
        error: `Error reading file: ${err?.message}`,
      };
    }
  },
  examples: [
    { query: 'Inspect package.json', params: { filePath: 'package.json' } },
    { query: 'Read src/types.ts', params: { filePath: 'src/types.ts' } },
  ],
};
