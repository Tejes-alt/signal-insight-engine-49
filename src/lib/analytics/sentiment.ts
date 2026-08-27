/**
 * Deterministic lexicon sentiment with negation, intensifier and emoji
 * handling. Runs on every ingested record so sentiment is always available and
 * always reproducible; the AI analyst interprets these numbers, it never
 * produces them.
 */

import { normalizeText, tokenize } from "./text";

const POSITIVE: Record<string, number> = {
  amazing: 2.4, awesome: 2.3, excellent: 2.4, outstanding: 2.4, brilliant: 2.2, fantastic: 2.3,
  great: 1.8, good: 1.4, love: 2.1, loved: 2.0, loves: 1.9, best: 1.9, perfect: 2.2, wonderful: 2.2,
  happy: 1.7, excited: 1.8, exciting: 1.8, impressive: 1.9, incredible: 2.1, helpful: 1.6,
  useful: 1.4, clear: 1.0, strong: 1.2, growth: 1.1, win: 1.5, winning: 1.5, success: 1.7,
  successful: 1.7, improved: 1.5, improvement: 1.4, thanks: 1.3, thank: 1.3, recommend: 1.7,
  beautiful: 1.8, smart: 1.4, powerful: 1.5, innovative: 1.6, promising: 1.4, optimistic: 1.8,
  breakthrough: 2.0, solid: 1.2, reliable: 1.4, efficient: 1.4, inspiring: 1.9, hopeful: 1.6,
  support: 1.0, supported: 1.0, congrats: 1.9, congratulations: 1.9, enjoyed: 1.6, enjoy: 1.5,
};

const NEGATIVE: Record<string, number> = {
  terrible: -2.4, awful: -2.3, horrible: -2.4, worst: -2.4, hate: -2.3, hated: -2.2, bad: -1.6,
  poor: -1.6, disappointing: -1.9, disappointed: -1.9, useless: -2.0, broken: -1.8, fail: -1.8,
  failed: -1.9, failure: -2.0, bug: -1.2, bugs: -1.2, scam: -2.4, fake: -1.9, misleading: -1.9,
  dangerous: -2.0, risk: -1.0, risky: -1.3, concern: -1.1, concerned: -1.3, concerning: -1.5,
  worried: -1.6, worry: -1.5, angry: -2.0, furious: -2.3, outrage: -2.3, outrageous: -2.2,
  problem: -1.3, problems: -1.4, issue: -1.0, issues: -1.1, crisis: -2.1, collapse: -2.1,
  decline: -1.4, declining: -1.5, wrong: -1.5, confusing: -1.4, confused: -1.2, boring: -1.5,
  waste: -1.9, overrated: -1.6, unacceptable: -2.2, disaster: -2.3, lawsuit: -1.7, banned: -1.7,
  threat: -1.8, warning: -1.2, fear: -1.7, fears: -1.7, criticism: -1.5, criticized: -1.6,
};

const INTENSIFIERS: Record<string, number> = {
  very: 1.4, really: 1.35, extremely: 1.7, incredibly: 1.6, absolutely: 1.6, totally: 1.4,
  hugely: 1.5, massively: 1.6, so: 1.25, super: 1.4, quite: 1.15, slightly: 0.6, somewhat: 0.7,
  barely: 0.5, "kind of": 0.7,
};

const NEGATORS = new Set(["not", "no", "never", "none", "cannot", "cant", "can't", "dont", "don't", "isnt", "isn't", "wasnt", "wasn't", "without", "hardly", "neither", "nor"]);

const EMOJI_SCORES: { pattern: RegExp; score: number }[] = [
  { pattern: /[\u{1F600}-\u{1F60F}\u{1F970}\u{1F929}\u{2764}\u{1F495}\u{1F44F}\u{1F525}\u{1F389}]/gu, score: 1.5 },
  { pattern: /[\u{1F620}-\u{1F62D}\u{1F621}\u{1F494}\u{1F44E}\u{1F92C}]/gu, score: -1.7 },
];

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentResult {
  /** Normalized to [-1, 1]. */
  score: number;
  label: SentimentLabel;
  /** How much signal the text actually carried, in [0, 1]. */
  confidence: number;
  matched: { term: string; weight: number }[];
}

export const SENTIMENT_METHOD = "lexicon-v1";

export function analyzeSentiment(input: string | null | undefined): SentimentResult {
  const text = (input ?? "").trim();
  if (!text) return { score: 0, label: "neutral", confidence: 0, matched: [] };

  const tokens = tokenize(text);
  const matched: { term: string; weight: number }[] = [];
  let total = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const base = POSITIVE[token] ?? NEGATIVE[token];
    if (base === undefined) continue;

    let weight = base;
    const prev = tokens[i - 1];
    const prev2 = tokens[i - 2];
    if (prev && INTENSIFIERS[prev] !== undefined) weight *= INTENSIFIERS[prev]!;
    if ((prev && NEGATORS.has(prev)) || (prev2 && NEGATORS.has(prev2))) weight *= -0.85;

    total += weight;
    matched.push({ term: token, weight: Number(weight.toFixed(2)) });
  }

  const normalized = normalizeText(text);
  for (const emoji of EMOJI_SCORES) {
    const hits = (normalized.match(emoji.pattern) ?? []).length;
    if (hits > 0) {
      total += emoji.score * Math.min(hits, 3);
      matched.push({ term: hits > 1 ? `emoji ×${hits}` : "emoji", weight: emoji.score });
    }
  }

  // Squash so long texts do not automatically become extreme.
  const score = Math.tanh(total / 3.2);
  const density = matched.length / Math.max(tokens.length, 1);
  const confidence = Math.min(
    1,
    Math.max(0, 0.25 * Math.min(matched.length, 4) + Math.min(density * 2.5, 0.4)),
  );

  const label: SentimentLabel = score > 0.12 ? "positive" : score < -0.12 ? "negative" : "neutral";
  return { score: Number(score.toFixed(4)), label, confidence: Number(confidence.toFixed(3)), matched: matched.slice(0, 8) };
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  averageScore: number;
  /** Standard deviation of scores — how divided the conversation is. */
  volatility: number;
  averageConfidence: number;
}

export function summarizeSentiment(
  results: { score: number; label: SentimentLabel; confidence: number }[],
): SentimentDistribution {
  const total = results.length;
  if (total === 0) {
    return { positive: 0, neutral: 0, negative: 0, total: 0, averageScore: 0, volatility: 0, averageConfidence: 0 };
  }
  const counts = { positive: 0, neutral: 0, negative: 0 };
  let sum = 0;
  let confSum = 0;
  for (const r of results) {
    counts[r.label] += 1;
    sum += r.score;
    confSum += r.confidence;
  }
  const mean = sum / total;
  const variance = results.reduce((acc, r) => acc + (r.score - mean) ** 2, 0) / total;
  return {
    ...counts,
    total,
    averageScore: Number(mean.toFixed(4)),
    volatility: Number(Math.sqrt(variance).toFixed(4)),
    averageConfidence: Number((confSum / total).toFixed(3)),
  };
}
