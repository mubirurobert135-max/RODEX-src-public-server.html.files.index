// RODEX DOCTOR — Continuous Monitoring Runner
import dotenv from 'dotenv';
import { globalRodexDoctor } from '../server/doctor/doctorEngine';

dotenv.config();

console.log('\n================================================================');
console.log(' 🩺 RODEX DOCTOR — CONTINUOUS WATCHDOG MONITOR ACTIVE ');
console.log('================================================================');
console.log(' Monitoring server health every 15 seconds. Press Ctrl+C to stop.\n');

let lastOverallHealth = '';

async function runCheck() {
  const report = await globalRodexDoctor.generateDiagnosticReport();
  const timestamp = new Date().toLocaleTimeString();

  if (report.overallHealth !== lastOverallHealth) {
    console.log(
      `[${timestamp}] HEALTH CHANGE: ${lastOverallHealth || 'INITIAL'} -> ${report.overallHealth}`
    );
    console.log(` Status Message: ${report.summaryMessage}`);
    if (report.rootCauses.length > 0) {
      console.log(` Active Root Causes: ${report.rootCauses.map((rc) => rc.title).join(' | ')}`);
    }
    lastOverallHealth = report.overallHealth;
  } else {
    console.log(
      `[${timestamp}] Health Check: ${report.overallHealth} | Heap: ${report.resources.heapUsedMB}MB | Uptime: ${report.resources.uptimeSeconds}s`
    );
  }
}

// Initial check
runCheck();

// 15-second loop
setInterval(runCheck, 15000);
