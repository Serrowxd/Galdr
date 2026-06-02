export type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};

/**
 * Parse h2 (##) and h3 (###) headings from markdown.
 * Slugifies each text for the `id`; disambiguates collisions with -2, -3, etc.
 */
export function extractHeadings(markdown: string): Heading[] {
  const lines = markdown.split("\n");
  const headings: Heading[] = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = !h3 && line.match(/^##\s+(.+)/);
    const match = h3 ?? h2;
    if (!match) continue;

    const level: 2 | 3 = h3 ? 3 : 2;
    const text = match[1].trim();
    const base = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;

    headings.push({ id, text, level });
  }

  return headings;
}
