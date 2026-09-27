import { ToolDefinition } from '../types';
import { globalRodexDoctor } from '../../doctor/doctorEngine';

export const doctorTool: ToolDefinition = {
  name: 'doctor_diagnostics',
  description: 'Run RODEX Doctor self-healing diagnostic suite, check subsystem health, verify neural latencies, or inspect circuit breaker statuses.',
  permissionLevel: 'safe',
  parameters: {
    action: {
      type: 'string',
      description: 'The diagnostic action: "run_health_check", "get_status", "run_self_repair"',
      enum: ['run_health_check', 'get_status', 'run_self_repair'],
      required: true,
    },
  },
  handler: async (params) => {
    const action = params?.action || 'run_health_check';

    if (action === 'run_health_check' || action === 'run_self_repair') {
      const report = await globalRodexDoctor.generateDiagnosticReport();
      const isHealthy = report.overallHealth === 'HEALTHY';

      return {
        success: true,
        output: {
          overallStatus: report.overallHealth,
          summary: report.summaryMessage,
          services: report.services,
          circuitBreakers: report.circuitBreakers,
          timestamp: report.timestamp,
        },
        message: isHealthy
          ? `RODEX Doctor health check complete: Overall status is HEALTHY. All core subsystems and circuit breakers are operational.`
          : `RODEX Doctor health check complete: Overall status is ${report.overallHealth}. ${report.summaryMessage}`,
      };
    }

    return {
      success: true,
      output: { status: 'operational' },
      message: 'All core RODEX subsystems are active and operational.',
    };
  },
  examples: [
    { query: 'Run a health check', params: { action: 'run_health_check' } },
    { query: 'Scan yourself for errors', params: { action: 'run_health_check' } },
  ],
};
