/**
 * Time-series primitives for the trend and anomaly engines.
 * Pure functions: bucketing, baselines, velocity/acceleration, momentum,
 * robust z-scores, burst and change-point detection.
 */

export interface Bucket {
  start: number; // epoch ms
  end: number;
  value: number;
}

export function bucketize(
  timestamps: number[],
  options: { from: number; to: number; bucketMs: number; weights?: number[] },
): Bucket[] {
  const { from, to, bucketMs } = options;
  const count = Math.max(1, Math.ceil((to - from) / bucketMs));
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => ({
    start: from + i * bucketMs,
    end: from + (i + 1) * bucketMs,
    value: 0,
  }));
  timestamps.forEach((ts, idx) => {
    if (ts < from || ts > to) return;
    const i = Math.min(count - 1, Math.floor((ts - from) / bucketMs));
    buckets[i]!.value += options.weights ? (options.weights[idx] ?? 0) : 1;
  });
  return buckets;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median absolute deviation — robust to the spikes we are trying to detect. */
export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return mean(slice);
  });
}

export interface TrendMetrics {
  current: number;
  baseline: number;
  /** Change per bucket, from a least-squares fit over the recent window. */
  velocity: number;
  /** Change of velocity — is the movement speeding up or slowing down. */
  acceleration: number;
  /** Percentage change of the recent window vs the baseline window. */
  growthPct: number | null;
  /** 0-100 composite of growth, velocity and consistency. */
  momentum: number;
  /** Robust deviation from baseline in MAD-sigma units. */
  deviation: number;
  confidence: number;
  direction: "rising" | "falling" | "flat";
}

function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i]! - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Splits the series into a baseline history and a recent window, then derives
 * the full trend picture. `recentBuckets` is how many trailing buckets count as
 * "now".
 */
export function computeTrend(series: number[], recentBuckets = 3): TrendMetrics {
  if (series.length === 0) {
    return { current: 0, baseline: 0, velocity: 0, acceleration: 0, growthPct: null, momentum: 0, deviation: 0, confidence: 0, direction: "flat" };
  }
  const k = Math.min(recentBuckets, series.length);
  const recent = series.slice(-k);
  const history = series.slice(0, Math.max(0, series.length - k));

  const current = mean(recent);
  const baseline = history.length > 0 ? mean(history) : current;

  const velocity = slope(recent);
  const priorVelocity = history.length >= 2 ? slope(history.slice(-Math.max(2, k))) : 0;
  const acceleration = velocity - priorVelocity;

  const growthPct = baseline > 0 ? ((current - baseline) / baseline) * 100 : current > 0 ? null : 0;

  const spread = mad(history.length > 1 ? history : series) * 1.4826;
  const deviation = spread > 0 ? (current - baseline) / spread : current > baseline ? 3 : 0;

  const growthComponent = growthPct === null ? 60 : Math.max(-100, Math.min(200, growthPct)) / 2;
  const velocityComponent = Math.max(-25, Math.min(25, velocity * 8));
  const consistency = recent.filter((v) => v > baseline).length / Math.max(k, 1);
  const momentum = Math.max(
    0,
    Math.min(100, 50 + growthComponent * 0.35 + velocityComponent + (consistency - 0.5) * 30),
  );

  const sampleWeight = Math.min(1, series.reduce((a, b) => a + b, 0) / 20);
  const historyWeight = Math.min(1, history.length / 6);
  const confidence = Number((0.25 + 0.45 * sampleWeight + 0.3 * historyWeight).toFixed(3));

  const direction = deviation > 0.6 ? "rising" : deviation < -0.6 ? "falling" : "flat";

  return {
    current: Number(current.toFixed(3)),
    baseline: Number(baseline.toFixed(3)),
    velocity: Number(velocity.toFixed(3)),
    acceleration: Number(acceleration.toFixed(3)),
    growthPct: growthPct === null ? null : Number(growthPct.toFixed(1)),
    momentum: Number(momentum.toFixed(1)),
    deviation: Number(deviation.toFixed(2)),
    confidence,
    direction,
  };
}

export interface DetectedAnomaly {
  index: number;
  value: number;
  baseline: number;
  deviation: number;
  kind: "spike" | "drop";
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Robust point-anomaly detection using median + MAD, which does not get
 * dragged around by the outlier it is meant to find.
 */
export function detectAnomalies(series: number[], threshold = 3): DetectedAnomaly[] {
  if (series.length < 5) return [];
  const out: DetectedAnomaly[] = [];
  for (let i = 2; i < series.length; i++) {
    const history = series.slice(0, i);
    const base = median(history);
    const spread = mad(history) * 1.4826 || Math.max(0.5, base * 0.35);
    const value = series[i]!;
    const deviation = (value - base) / spread;
    if (Math.abs(deviation) < threshold) continue;
    const abs = Math.abs(deviation);
    out.push({
      index: i,
      value,
      baseline: Number(base.toFixed(2)),
      deviation: Number(deviation.toFixed(2)),
      kind: deviation > 0 ? "spike" : "drop",
      severity: abs >= 8 ? "critical" : abs >= 5 ? "high" : abs >= 3.8 ? "medium" : "low",
    });
  }
  return out;
}

/** CUSUM-style change-point detection: where did the regime shift? */
export function detectChangePoints(series: number[], sensitivity = 1.5): number[] {
  if (series.length < 8) return [];
  const m = mean(series);
  const s = stdev(series) || 1;
  let pos = 0;
  let neg = 0;
  const points: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const z = (series[i]! - m) / s;
    pos = Math.max(0, pos + z - 0.5);
    neg = Math.min(0, neg + z + 0.5);
    if (pos > sensitivity * 3 || neg < -sensitivity * 3) {
      points.push(i);
      pos = 0;
      neg = 0;
    }
  }
  return points;
}
