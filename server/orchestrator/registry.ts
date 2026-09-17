import {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolPermissionLevel,
} from './types';
import { systemInfoTool } from './tools/systemInfoTool';
import { datetimeTool } from './tools/datetimeTool';
import { calculateTool } from './tools/calculateTool';
import { fileReaderTool } from './tools/fileReaderTool';
import { openUrlTool } from './tools/openUrlTool';
import { mediaControlTool } from './tools/mediaControlTool';
import { appActionTool } from './tools/appActionTool';
import { webSearchTool } from './tools/webSearchTool';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register(systemInfoTool);
    this.register(datetimeTool);
    this.register(calculateTool);
    this.register(fileReaderTool);
    this.register(openUrlTool);
    this.register(mediaControlTool);
    this.register(appActionTool);
    this.register(webSearchTool);
  }

  public register(tool: ToolDefinition) {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid string name.');
    }
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public has(name: string): boolean {
    return this.tools.has(name);
  }

  public listTools(): Array<Omit<ToolDefinition, 'handler'>> {
    return Array.from(this.tools.values()).map(({ handler, ...meta }) => meta);
  }

  public validateParameters(
    tool: ToolDefinition,
    params: any
  ): { valid: boolean; error?: string; validatedParams: any } {
    if (!params || typeof params !== 'object') {
      params = {};
    }

    const validated: Record<string, any> = { ...params };

    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      const val = params[paramName];

      if (schema.required && (val === undefined || val === null || val === '')) {
        return {
          valid: false,
          error: `Missing required parameter '${paramName}' for tool '${tool.name}'.`,
          validatedParams: {},
        };
      }

      if (val === undefined && schema.default !== undefined) {
        validated[paramName] = schema.default;
      }

      if (val !== undefined && schema.enum && !schema.enum.includes(val)) {
        return {
          valid: false,
          error: `Parameter '${paramName}' value '${val}' is not in allowed list [${schema.enum.join(', ')}].`,
          validatedParams: {},
        };
      }
    }

    return { valid: true, validatedParams: validated };
  }

  public async executeTool(
    toolName: string,
    params: any,
    context: ToolExecutionContext = {}
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool '${toolName}' is not registered in the RODEX Intelligence Core.`,
      };
    }

    // Parameter validation
    const validation = this.validateParameters(tool, params);
    if (!validation.valid) {
      return {
        success: false,
        output: null,
        error: validation.error,
      };
    }

    // Permission enforcement
    if (tool.permissionLevel === 'high_risk' && !context.hasElevatedPermission) {
      return {
        success: false,
        output: null,
        requiresConfirmation: true,
        confirmationPayload: {
          actionName: tool.name,
          description: tool.description,
          params: validation.validatedParams,
        },
        message: `Tool '${tool.name}' is designated high-risk and requires operator approval before execution.`,
      };
    }

    try {
      const result = await tool.handler(validation.validatedParams, context);
      return result;
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: `Unhandled error executing tool '${toolName}': ${err?.message || String(err)}`,
      };
    }
  }
}

export const globalToolRegistry = new ToolRegistry();
