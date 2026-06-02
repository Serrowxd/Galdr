/**
 * Format a vote score for compact display.
 *
 * Examples:
 *   999   → "999"
 *   1000  → "1.0k"
 *   1200  → "1.2k"
 *   9999  → "9.9k"
 *   10000 → "10k"
 *   12345 → "12k"
 *   -1200 → "-1.2k"
 *   1500000 → "1.5M"
 */
export function formatScore(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs < 1000) return n.toString();
  if (abs < 10_000) return sign + (abs / 1000).toFixed(1) + "k";
  if (abs < 1_000_000) return sign + Math.floor(abs / 1000) + "k";
  return sign + (abs / 1_000_000).toFixed(1) + "M";
}
