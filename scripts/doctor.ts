// RODEX DOCTOR — CLI Diagnostic Tool
import dotenv from 'dotenv';
import { globalRodexDoctor } from '../server/doctor/doctorEngine';

dotenv.config();

async function runDoctorCLI() {
  console.log('\n================================================================');
  console.log(' 🩺 RODEX DOCTOR — MASTER SYSTEM DIAGNOSTICS & RELIABILITY REPORT ');
  console.log('================================================================\n');

  try {
    const report = await globalRodexDoctor.generateDiagnosticReport();

    const statusBadge =
      report.overallHealth === 'HEALTHY'
        ? '🟢 HEALTHY'
        : report.overallHealth === 'DEGRADED'
        ? '🟡 DEGRADED'
        : report.overallHealth === 'WARNING'
        ? '🟠 WARNING'
        : '🔴 CRITICAL';

    console.log(`OVERALL SYSTEM STATUS: ${statusBadge}`);
    console.log(`Summary: ${report.summaryMessage}`);
    console.log(`Timestamp: ${report.timestamp} | Version: ${report.version} | Env: ${report.environment}\n`);

    console.log('----------------------------------------------------------------');
    console.log(' 1. MONITORED SERVICES & SUBSYSTEMS REGISTRY');
    console.log('----------------------------------------------------------------');

    for (const [key, service] of Object.entries(report.services)) {
      const badge =
        service.status === 'HEALTHY'
          ? '[PASS]'
          : service.status === 'DEGRADED' || service.status === 'WARNING'
          ? '[WARN]'
          : '[FAIL]';
      const criticalMarker = service.isCritical ? '(Critical)' : '(Optional)';
      console.log(
        ` ${badge} ${service.name.padEnd(45)} ${service.status.padEnd(10)} ${service.responseTimeMs}ms ${criticalMarker}`
      );
      if (service.lastError) {
        console.log(`       └─ Detail: ${service.lastError}`);
      }
    }

    console.log('\n----------------------------------------------------------------');
    console.log(' 2. ENVIRONMENT & CONFIGURATION AUDIT (SECRETS MASKED)');
    console.log('----------------------------------------------------------------');

    for (const envVar of report.environmentChecks) {
      const badge = envVar.status === 'PRESENT' ? '[PASS]' : '[INFO]';
      console.log(` ${badge} ${envVar.name.padEnd(35)} : ${envVar.status}`);
    }

    console.log('\n----------------------------------------------------------------');
    console.log(' 3. SYSTEM RESOURCE & METRICS SNAPSHOT');
    console.log('----------------------------------------------------------------');
    console.log(` - Server Uptime    : ${report.resources.uptimeSeconds} seconds`);
    console.log(` - Node Heap Used   : ${report.resources.heapUsedMB} MB / ${report.resources.heapTotalMB} MB`);
    console.log(` - Process RSS      : ${report.resources.rssMB} MB`);
    console.log(` - Average Latency  : ${report.resources.avgLatencyMs} ms`);
    console.log(` - Error Rate       : ${report.resources.errorRate}`);
    console.log(` - Cache Hit Rate   : ${report.resources.cacheHitRate}`);

    if (report.rootCauses.length > 0) {
      console.log('\n----------------------------------------------------------------');
      console.log(' 4. ROOT-CAUSE ANALYSIS & ACTIONABLE ADVISORIES');
      console.log('----------------------------------------------------------------');

      for (const rc of report.rootCauses) {
        console.log(`\n ⚠️  ${rc.title.toUpperCase()} (${rc.severity})`);
        console.log(`     Description   : ${rc.description}`);
        console.log(`     Services      : ${rc.affectedServices.join(', ')}`);
        console.log(`     Actionable Fix: ${rc.actionableFix}`);
      }
    }

    console.log('\n================================================================');
    if (report.overallHealth === 'HEALTHY' || report.overallHealth === 'DEGRADED') {
      console.log(' STATUS VERIFIED: RODEX IS READY AND STABLE FOR INGESTION');
    } else {
      console.log(' ATTENTION REQUIRED: REVIEW ROOT-CAUSE ACTIONABLE FIXES ABOVE');
    }
    console.log('================================================================\n');

    process.exit(report.overallHealth === 'CRITICAL' ? 1 : 0);
  } catch (err: any) {
    console.error('❌ Exception during RODEX Doctor execution:', err?.stack || err);
    process.exit(1);
  }
}

runDoctorCLI();
