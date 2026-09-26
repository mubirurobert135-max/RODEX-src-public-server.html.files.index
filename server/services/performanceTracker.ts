// Performance Tracking & High-Resolution Metrics Engine for RODEX
export interface MetricRecord {
  timestamp: number;
  type: 'chat' | 'orchestrate' | 'fast_intent' | 'tool' | 'memory' | 'search';
  totalLatencyMs: number;
  aiLatencyMs?: number;
  toolLatencyMs?: number;
  memoryLatencyMs?: number;
  cacheHit: boolean;
  success: boolean;
  modelUsed?: string;
}

class PerformanceTracker {
  private records: MetricRecord[] = [];
  private readonly MAX_RECORDS = 500;
  private activeRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  public requestStart(): () => void {
    this.activeRequests++;
    return () => {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
    };
  }

  public recordCacheHit() {
    this.cacheHits++;
  }

  public recordCacheMiss() {
    this.cacheMisses++;
  }

  public logMetric(record: Omit<MetricRecord, 'timestamp'>) {
    const fullRecord: MetricRecord = {
      ...record,
      timestamp: Date.now(),
    };
    this.records.push(fullRecord);
    if (this.records.length > this.MAX_RECORDS) {
      this.records.shift();
    }
  }

  public getMetricsSummary() {
    const total = this.records.length;
    if (total === 0) {
      return {
        activeRequests: this.activeRequests,
        totalRequests: 0,
        avgLatencyMs: 0,
        fastestLatencyMs: 0,
        slowestLatencyMs: 0,
        aiAvgLatencyMs: 0,
        cacheHitRate: '0.0%',
        errorRate: '0.0%',
        fastPathPercentage: '0.0%',
        recentRecords: [],
      };
    }

    const successful = this.records.filter((r) => r.success);
    const errors = total - successful.length;
    const fastPaths = this.records.filter((r) => r.type === 'fast_intent');

    const latencies = this.records.map((r) => r.totalLatencyMs);
    const avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / total);
    const fastestLatencyMs = Math.min(...latencies);
    const slowestLatencyMs = Math.max(...latencies);

    const aiLatencies = this.records.filter((r) => r.aiLatencyMs !== undefined).map((r) => r.aiLatencyMs!);
    const aiAvgLatencyMs = aiLatencies.length > 0 ? Math.round(aiLatencies.reduce((a, b) => a + b, 0) / aiLatencies.length) : 0;

    const totalCacheAccess = this.cacheHits + this.cacheMisses;
    const cacheHitRateVal = totalCacheAccess > 0 ? ((this.cacheHits / totalCacheAccess) * 100).toFixed(1) : '0.0';
    const errorRateVal = ((errors / total) * 100).toFixed(1);
    const fastPathVal = ((fastPaths.length / total) * 100).toFixed(1);

    return {
      activeRequests: this.activeRequests,
      totalRequestsRecorded: total,
      avgLatencyMs,
      fastestLatencyMs,
      slowestLatencyMs,
      aiAvgLatencyMs,
      cacheHitRate: `${cacheHitRateVal}%`,
      errorRate: `${errorRateVal}%`,
      fastPathPercentage: `${fastPathVal}%`,
      recentRecords: this.records.slice(-15).reverse(),
    };
  }
}

export const globalPerformanceTracker = new PerformanceTracker();
