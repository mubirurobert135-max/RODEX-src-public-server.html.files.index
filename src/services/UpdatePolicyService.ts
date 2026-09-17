import { EventEmitter } from 'events';

export interface UpdatePolicyConfig {
  intervalType: 'daily' | 'weekly' | 'manual';
  autoApplyLowRisk: boolean;
  notifyOnCriticalSecurity: boolean;
  lastRunTimestamp?: string;
  nextRunTimestamp?: string;
}

class UpdatePolicyService extends EventEmitter {
  private config: UpdatePolicyConfig = {
    intervalType: 'daily',
    autoApplyLowRisk: true,
    notifyOnCriticalSecurity: true,
  };
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.scheduleNextRun();
  }

  public getConfig(): UpdatePolicyConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<UpdatePolicyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.scheduleNextRun();
  }

  private scheduleNextRun(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.config.intervalType === 'manual') {
      return;
    }

    // Determine interval in milliseconds (Daily = 24h, Weekly = 7d)
    // For demo/robust testing robustness, we can set a reasonable interval or simulation cycle.
    const intervalMs = this.config.intervalType === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    this.config.lastRunTimestamp = new Date().toISOString();
    const nextRun = new Date(Date.now() + intervalMs);
    this.config.nextRunTimestamp = nextRun.toISOString();

    // Set background interval check
    this.timer = setInterval(() => {
      this.executeScheduledCheck();
    }, intervalMs);
  }

  public async executeScheduledCheck(): Promise<{ criticalFound: boolean; summary: string }> {
    console.log('[UpdatePolicyService] Executing scheduled background technology and security check...');
    this.config.lastRunTimestamp = new Date().toISOString();

    // Simulate check for critical security advisories
    const criticalFound = true; // Simulating monitored advisory scan
    const summary = 'Background scan completed successfully. 1 critical security advisory evaluated against policy.';

    if (criticalFound && this.config.notifyOnCriticalSecurity) {
      this.emit('criticalSecurityAlert', {
        title: 'Critical Security Advisory Detected',
        description: 'A verified security patch has been discovered for upstream proxy routing.',
        timestamp: new Date().toISOString(),
      });
    }

    return { criticalFound, summary };
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const updatePolicyService = new UpdatePolicyService();
