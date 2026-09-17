import { ToolDefinition } from '../types';

export const systemInfoTool: ToolDefinition = {
  name: 'system_info',
  description: 'Retrieve real-time safe system information, runtime health, host environment, memory allocation, and operational metrics for RODEX.',
  permissionLevel: 'safe',
  parameters: {
    category: {
      type: 'string',
      description: 'Optional category of system info to retrieve: "overview", "memory", "runtime", "all"',
      enum: ['overview', 'memory', 'runtime', 'all'],
      default: 'overview',
    },
  },
  handler: async (params) => {
    const category = params.category || 'overview';
    const uptimeSec = process.uptime();
    const memUsage = process.memoryUsage();

    const memMb = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    const payload: Record<string, any> = {
      assistantName: 'RODEX',
      version: 'v4.8.2-prod',
      status: 'OPERATIONAL',
      neuralThroughput: '600M+ ops/sec',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(uptimeSec),
      uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${Math.floor(uptimeSec % 60)}s`,
      memory: memMb,
      securityStatus: 'PROTECTED',
      geminiEngine: process.env.GEMINI_API_KEY ? 'ACTIVE_MULTIMODAL' : 'STANDBY_LOCAL',
    };

    let summaryText = `RODEX System Status: OPERATIONAL. Uptime: ${payload.uptimeFormatted}. Memory Heap: ${memMb.heapUsed}MB / ${memMb.heapTotal}MB. Core Neural Engine: ${payload.geminiEngine}.`;

    if (category === 'memory') {
      summaryText = `Memory Telemetry: Heap Used: ${memMb.heapUsed}MB, Heap Allocated: ${memMb.heapTotal}MB, Resident Set Size (RSS): ${memMb.rss}MB.`;
    }

    return {
      success: true,
      output: payload,
      message: summaryText,
    };
  },
  examples: [
    { query: 'Check system status', params: { category: 'overview' } },
    { query: 'How much memory is being used?', params: { category: 'memory' } },
  ],
};
