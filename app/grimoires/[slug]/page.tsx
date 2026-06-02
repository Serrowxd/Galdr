import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  GrimoireDetailClient,
  type GrimoireDetailProps,
} from "@/components/grimoires/GrimoireDetailClient";
import type { EntryDTO } from "@/components/grimoires/GrimoireEntryRow";
import {
  GRIMOIRE_TABS,
  defaultGrimoireTab,
  type GrimoireTabId,
} from "@/lib/grimoireTabs";
import { getDbOptional } from "@/db";
import {
  getGrimoireBySlug,
  getGrimoireForkCount,
  getGrimoireVoteTotals,
  getUserGrimoireVote,
  getVersionsByFamily,
  incrementGrimoireViews,
  isGrimoireSaved,
  ORCHESTRATION_TAG,
  resolveGrimoireEntries,
} from "@/lib/grimoires";
import { getUserProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Synthesises a starter `orchestration.md` from the resolved entries. Stand-in
 * until grimoires gain a real file store; keeps the orchestration file truthful
 * (it mirrors the actual run order) without inventing content.
 */
function buildOrchestrationDoc(title: string, entries: EntryDTO[]): string {
  const steps = entries
    .map((e, i) => {
      const name = e.stave?.title ?? "Unavailable stave";
      const optional = e.isOptional ? " _(optional)_" : "";
      const note = e.annotation ? ` — ${e.annotation}` : "";
      return `${i + 1}. **${name}**${optional}${note}`;
    })
    .join("\n");

  return [
    `# ${title} — Orchestration`,
    "",
    "These staves run as a coordinated workflow. They execute in the order below; optional steps may be skipped before download or run.",
    "",
    steps || "_No staves yet._",
    "",
    "> Generated starting point. A future release will let curators author the orchestration graph directly.",
  ].join("\n");
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDbOptional();
  if (!db) return { title: "Grimoire | Galdr" };
  const grimoire = await getGrimoireBySlug(db, slug);
  if (!grimoire) return { title: "Grimoire | Galdr" };
  if (grimoire.status === "draft") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== grimoire.authorId) return { title: "Grimoire | Galdr" };
  }
  return {
    title: `${grimoire.title} | Galdr`,
    description: grimoire.shortDescription ?? undefined,
  };
}

export default async function GrimoireDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const db = getDbOptional();
  if (!db) notFound();

  const grimoire = await getGrimoireBySlug(db, slug);
  if (!grimoire) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthor = user?.id === grimoire.authorId;

  // Drafts are owner-only.
  if (grimoire.status === "draft" && !isAuthor) notFound();

  const [resolved, author, forkCount, versions] = await Promise.all([
    resolveGrimoireEntries(db, grimoire.id),
    getUserProfileByUserId(db, grimoire.authorId),
    getGrimoireForkCount(db, grimoire.familyId),
    getVersionsByFamily(db, grimoire.familyId),
  ]);

  // Best-effort view bump for published grimoires.
  if (grimoire.status === "published") {
    void incrementGrimoireViews(db, grimoire.id);
  }

  const entries: EntryDTO[] = resolved.map((r) => {
    if (r.resolved.status === "ok") {
      const s = r.resolved.stave;
      return {
        id: r.entry.id,
        isOptional: r.entry.isOptional,
        annotation: r.entry.annotation,
        pinned: Boolean(r.entry.pinnedStaveId),
        status: "ok",
        stave: {
          title: s.title,
          slug: s.slug,
          version: s.version,
          description: s.description,
          tags: s.tags,
          authorUsername: r.resolved.author?.username ?? null,
        },
      };
    }
    return {
      id: r.entry.id,
      isOptional: r.entry.isOptional,
      annotation: r.entry.annotation,
      pinned: Boolean(r.entry.pinnedStaveId),
      status: "unavailable",
      reason: r.resolved.reason,
    };
  });

  const sourcesCount = new Set(
    resolved
      .filter((r) => r.resolved.status === "ok")
      .map((r) => (r.resolved.status === "ok" ? r.resolved.stave.authorId : "")),
  ).size;

  const totals = await getGrimoireVoteTotals(db, grimoire.id);
  let initialUserVote: 1 | -1 | 0 = 0;
  let initialSaved = false;
  if (user) {
    initialUserVote = await getUserGrimoireVote(db, grimoire.id, user.id);
    initialSaved = await isGrimoireSaved(db, grimoire.id, user.id);
  }

  const authorName = author?.username ?? "Unknown scribe";
  const sagaHref = author?.username ? `/saga/${author.username.toLowerCase()}` : "/";

  const isOrchestration = grimoire.tags.includes(ORCHESTRATION_TAG);
  // The grimoire's `details` markdown is its README — the human entry point we
  // land on by default when present, mirroring a stave's packaged README.md.
  const readme = grimoire.details && grimoire.details.trim() ? grimoire.details : null;
  const hasReadme = readme != null;

  // Orchestration document. There's no grimoire file store yet, so we synthesise
  // a run-order starting point from the resolved entries; a future release will
  // let curators author the orchestration graph directly (then this reads from
  // the stored orchestration.md instead).
  const orchestrationDoc = isOrchestration
    ? buildOrchestrationDoc(grimoire.title, entries)
    : null;

  // README-first default landing; honour a valid `?tab=` deep-link otherwise.
  const requested = tab as GrimoireTabId | undefined;
  const isValidTab =
    requested != null &&
    GRIMOIRE_TABS.includes(requested) &&
    !(requested === "readme" && !hasReadme) &&
    !(requested === "orchestration" && !isOrchestration);
  const initialTab: GrimoireTabId = isValidTab
    ? requested
    : defaultGrimoireTab(hasReadme);

  const detailProps: GrimoireDetailProps = {
    id: grimoire.id,
    slug: grimoire.slug,
    title: grimoire.title,
    shortDescription: grimoire.shortDescription,
    readme,
    orchestrationDoc,
    tags: grimoire.tags,
    license: grimoire.license,
    version: grimoire.version,
    isOrchestration,
    authorName,
    authorAvatarUrl: author?.avatarUrl ?? null,
    sagaHref,
    isAuthor,
    isSignedIn: Boolean(user),
    status: grimoire.status === "published" ? "published" : "draft",
    initialTab,
    entries,
    versions,
    sourcesCount,
    forkCount,
    downloadsCount: grimoire.downloadsCount,
    createdAt: grimoire.createdAt ? new Date(grimoire.createdAt).toISOString() : null,
    updatedAt: grimoire.updatedAt ? new Date(grimoire.updatedAt).toISOString() : null,
    publishedAt: grimoire.publishedAt
      ? new Date(grimoire.publishedAt).toISOString()
      : null,
    initialUpvotes: totals.upvotes,
    initialDownvotes: totals.downvotes,
    initialUserVote,
    initialSaved,
  };

  return (
    <section className="container stave-detail-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/registry">Registry</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <Link href={sagaHref}>{authorName}</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>{grimoire.slug}</span>
      </nav>

      <GrimoireDetailClient {...detailProps} />
    </section>
  );
}
