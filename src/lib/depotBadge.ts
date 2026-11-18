/**
 * Self-drawn badges for depot providers: a monogram in the provider's well-known
 * colour. No trademarked logo artwork is used.
 */
export interface DepotBadgeStyle {
  text: string;
  bg: string;
  fg: string;
  /** draw a thin ring, for very dark or very light badges that would vanish on the page */
  ring?: boolean;
}

const KNOWN: [RegExp, DepotBadgeStyle][] = [
  [/trade ?republic/i, { text: 'TR', bg: '#111111', fg: '#ffffff', ring: true }],
  [/\bing\b|ing-?diba/i, { text: 'ING', bg: '#ff6200', fg: '#ffffff' }],
  [/sparkasse/i, { text: 'S', bg: '#e60000', fg: '#ffffff' }],
  [/flexgold/i, { text: 'FG', bg: '#c9a227', fg: '#1d1606' }],
  [/scalable/i, { text: 'SC', bg: '#1a1a1a', fg: '#ffffff', ring: true }],
  [/\bdkb\b/i, { text: 'DKB', bg: '#148dea', fg: '#ffffff' }],
  [/comdirect/i, { text: 'cd', bg: '#fff500', fg: '#1a1a1a', ring: true }],
  [/consors/i, { text: 'CB', bg: '#0085c7', fg: '#ffffff' }],
  [/volksbank|raiffeisen|\bvr\b/i, { text: 'VR', bg: '#0066b3', fg: '#ffffff' }],
  [/commerzbank/i, { text: 'CO', bg: '#ffcc00', fg: '#1a1a1a' }],
  [/deutsche bank/i, { text: 'DB', bg: '#0018a8', fg: '#ffffff' }],
  [/postbank/i, { text: 'PB', bg: '#ffcc00', fg: '#1a1a1a' }],
  [/\bn26\b/i, { text: 'N26', bg: '#36a18b', fg: '#ffffff' }],
];

/** Calm fallback colours for providers without a known style (white text has ≥ 4.5:1 on each). */
const FALLBACK = ['#3b5bdb', '#0b7a5c', '#8a3fb8', '#b5452e', '#2a6f97', '#7a5c00'];

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function depotBadge(name: string): DepotBadgeStyle {
  const hit = KNOWN.find(([re]) => re.test(name));
  if (hit) return hit[1];
  let hash = 0;
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return { text: initials(name), bg: FALLBACK[hash % FALLBACK.length], fg: '#ffffff' };
}
