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
import { weatherTool } from './tools/weatherTool';
import { memoryTool } from './tools/memoryTool';
import { platformBridgeTool } from './tools/platformBridgeTool';
import { emailTool } from './tools/emailTool';
import { contactsTool } from './tools/contactsTool';
import { deviceSecurityTool } from './tools/deviceSecurityTool';
import { imageIntelligenceTool } from './tools/imageIntelligenceTool';
import { desktopLauncherTool } from './tools/desktopLauncherTool';
import { scheduleTool } from './tools/scheduleTool';
import { doctorTool } from './tools/doctorTool';
import { updateTool } from './tools/updateTool';
import {
  gmailCheckNewTool,
  gmailListTool,
  gmailReadTool,
  gmailSearchTool,
  gmailDraftReplyTool,
  gmailSendReplyTool,
  gmailSendTool,
} from '../services/gmail/gmail.tools';

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
    this.register(weatherTool);
    this.register(memoryTool);
    this.register(platformBridgeTool);
    this.register(emailTool);
    this.register(contactsTool);
    this.register(deviceSecurityTool);
    this.register(imageIntelligenceTool);
    this.register(desktopLauncherTool);
    this.register(scheduleTool);
    this.register(doctorTool);
    this.register(updateTool);
    this.register(gmailCheckNewTool);
    this.register(gmailListTool);
    this.register(gmailReadTool);
    this.register(gmailSearchTool);
    this.register(gmailDraftReplyTool);
    this.register(gmailSendReplyTool);
    this.register(gmailSendTool);
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
    const tool = this.get(toolName);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool '${toolName}' is not registered in the RODEX Intelligence Core.`,
      };
    }

    // Validate parameters
    const { valid, error, validatedParams } = this.validateParameters(tool, params);
    if (!valid) {
      return {
        success: false,
        output: null,
        error,
      };
    }

    try {
      const result = await tool.handler(validatedParams, context);
      return result;
    } catch (err: any) {
      console.error(`[Tool Execution Error: ${toolName}]`, err);
      return {
        success: false,
        output: null,
        error: `Execution failure in tool '${toolName}': ${err?.message || 'Unknown error'}`,
      };
    }
  }
}

export const globalToolRegistry = new ToolRegistry();
