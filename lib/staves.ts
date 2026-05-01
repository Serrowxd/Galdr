import { staves, type Stave } from "@/lib/mockData";

export function getStaveById(id: string): Stave | undefined {
  return staves.find((s) => s.id === id);
}

export function isValidStaveId(id: string): boolean {
  return staves.some((s) => s.id === id);
}

export function listStaveIds(): string[] {
  return staves.map((s) => s.id);
}

export function getStavesByScribeSlug(slug: string): Stave[] {
  return staves.filter((s) => s.scribeSlug === slug);
}

export function getDistinctScribeSlugs(): string[] {
  return Array.from(new Set(staves.map((s) => s.scribeSlug))).sort();
}
