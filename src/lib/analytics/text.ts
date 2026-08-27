/**
 * Text analytics primitives: tokenization, keyword extraction, entity and
 * hashtag handling, and n-gram topic candidates. Pure functions — deterministic
 * and unit-testable, used by the analytics engine on the server.
 */

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he her here hers herself him himself his how i i'm if in into is isn't it its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she should shouldn't so some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn't we were weren't what when where which while who whom why with won't would wouldn't you your yours yourself yourselves just get got like new one two also will can't im dont via amp really much many make makes made going go get really thing things way ways lot`
    .split(/\s+/)
    .filter(Boolean),
);

export function normalizeText(input: string): string {
  return input
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase();
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .replace(/[^a-z0-9'#@\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length > 1);
}

export function contentWords(input: string): string[] {
  return tokenize(input).filter(
    (t) => !STOPWORDS.has(t) && !t.startsWith("#") && !t.startsWith("@") && !/^\d+$/.test(t),
  );
}

export function extractHashtags(input: string): string[] {
  return Array.from(new Set((input.match(/#[\p{L}\p{N}_]{2,40}/gu) ?? []).map((h) => h.toLowerCase())));
}

export function extractMentions(input: string): string[] {
  return Array.from(new Set((input.match(/@[\p{L}\p{N}_.]{2,40}/gu) ?? []).map((m) => m.toLowerCase())));
}

/**
 * Capitalised multi-word sequences are treated as candidate named entities.
 * Deliberately conservative: this is evidence for an analyst, not a claim.
 */
export function extractEntities(input: string): string[] {
  const matches = input.match(/\b([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,3})\b/g) ?? [];
  const seen = new Map<string, number>();
  for (const raw of matches) {
    const value = raw.trim();
    if (value.length < 3) continue;
    if (STOPWORDS.has(value.toLowerCase())) continue;
    seen.set(value, (seen.get(value) ?? 0) + 1);
  }
  return Array.from(seen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([value]) => value);
}

export interface KeywordScore {
  term: string;
  count: number;
  documents: number;
  score: number;
}

/**
 * TF-IDF-ish keyword ranking across a document set. Terms appearing in almost
 * every document are damped so generic channel vocabulary does not dominate.
 */
export function rankKeywords(documents: string[], limit = 25): KeywordScore[] {
  const termCount = new Map<string, number>();
  const docFreq = new Map<string, number>();

  for (const doc of documents) {
    const words = contentWords(doc);
    const unique = new Set(words);
    for (const w of words) termCount.set(w, (termCount.get(w) ?? 0) + 1);
    for (const w of unique) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
  }

  const n = Math.max(documents.length, 1);
  return Array.from(termCount.entries())
    .filter(([term, count]) => count >= 2 && term.length > 2)
    .map(([term, count]) => {
      const df = docFreq.get(term) ?? 1;
      const idf = Math.log((n + 1) / (df + 0.5));
      return { term, count, documents: df, score: count * Math.max(idf, 0.05) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface TopicCandidate {
  label: string;
  keywords: string[];
  postIds: string[];
}

/**
 * Lightweight narrative clustering: seed clusters on the strongest keywords,
 * then attach every document sharing enough vocabulary with the seed. This is a
 * co-occurrence clustering pass, not an LLM guess — every cluster carries the
 * exact post ids that produced it so the UI can show evidence.
 */
export function clusterTopics(
  docs: { id: string; text: string }[],
  options: { maxTopics?: number; minPosts?: number } = {},
): TopicCandidate[] {
  const maxTopics = options.maxTopics ?? 10;
  const minPosts = options.minPosts ?? 2;

  const tokenized = docs.map((d) => ({ id: d.id, terms: new Set(contentWords(d.text)) }));
  const seeds = rankKeywords(
    docs.map((d) => d.text),
    60,
  );

  const topics: TopicCandidate[] = [];
  const claimed = new Map<string, number>();

  for (const seed of seeds) {
    if (topics.length >= maxTopics) break;
    const members = tokenized.filter((d) => d.terms.has(seed.term));
    if (members.length < minPosts) continue;

    // A seed whose documents are already fully explained by an existing topic
    // is a duplicate narrative, not a new one.
    const fresh = members.filter((m) => (claimed.get(m.id) ?? 0) === 0);
    if (fresh.length < Math.max(1, Math.ceil(members.length * 0.34))) continue;

    const cooccurrence = new Map<string, number>();
    for (const m of members) {
      for (const t of m.terms) {
        if (t === seed.term) continue;
        cooccurrence.set(t, (cooccurrence.get(t) ?? 0) + 1);
      }
    }
    const related = Array.from(cooccurrence.entries())
      .filter(([, c]) => c >= Math.max(2, members.length * 0.4))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);

    for (const m of members) claimed.set(m.id, (claimed.get(m.id) ?? 0) + 1);

    topics.push({
      label: seed.term,
      keywords: [seed.term, ...related],
      postIds: members.map((m) => m.id),
    });
  }

  return topics;
}

const LANGUAGE_HINTS: { code: string; pattern: RegExp }[] = [
  { code: "es", pattern: /\b(el|la|los|las|para|que|con|una|más)\b/g },
  { code: "fr", pattern: /\b(le|la|les|des|une|pour|avec|est|dans)\b/g },
  { code: "de", pattern: /\b(der|die|das|und|nicht|mit|ist|auch)\b/g },
  { code: "pt", pattern: /\b(uma|para|com|não|mais|você|são)\b/g },
  { code: "en", pattern: /\b(the|and|with|that|this|from|have|will)\b/g },
];

export function detectLanguage(input: string): string | null {
  const text = normalizeText(input);
  if (text.trim().length < 12) return null;
  let best: { code: string; hits: number } | null = null;
  for (const hint of LANGUAGE_HINTS) {
    const hits = (text.match(hint.pattern) ?? []).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { code: hint.code, hits };
  }
  return best && best.hits >= 2 ? best.code : null;
}
