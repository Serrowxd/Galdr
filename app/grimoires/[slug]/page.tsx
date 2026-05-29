import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  GrimoireDetailClient,
  type GrimoireDetailProps,
} from "@/components/grimoires/GrimoireDetailClient";
import type { EntryDTO } from "@/components/grimoires/GrimoireEntryRow";
import { getDbOptional } from "@/db";
import {
  getGrimoireBySlug,
  getGrimoireForkCount,
  getGrimoireVoteTotals,
  getUserGrimoireVote,
  incrementGrimoireViews,
  isGrimoireSaved,
  ORCHESTRATION_TAG,
  resolveGrimoireEntries,
} from "@/lib/grimoires";
import { getUserProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

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

export default async function GrimoireDetailPage({ params }: PageProps) {
  const { slug } = await params;

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

  const [resolved, author, forkCount] = await Promise.all([
    resolveGrimoireEntries(db, grimoire.id),
    getUserProfileByUserId(db, grimoire.authorId),
    getGrimoireForkCount(db, grimoire.familyId),
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

  const detailProps: GrimoireDetailProps = {
    id: grimoire.id,
    slug: grimoire.slug,
    title: grimoire.title,
    shortDescription: grimoire.shortDescription,
    details: grimoire.details,
    tags: grimoire.tags,
    license: grimoire.license,
    version: grimoire.version,
    isOrchestration: grimoire.tags.includes(ORCHESTRATION_TAG),
    authorName: author?.username ?? "Unknown scribe",
    sagaHref: author?.username ? `/saga/${author.username.toLowerCase()}` : "/",
    isAuthor,
    isSignedIn: Boolean(user),
    status: grimoire.status === "published" ? "published" : "draft",
    entries,
    sourcesCount,
    forkCount,
    downloadsCount: grimoire.downloadsCount,
    lastUpdated: grimoire.updatedAt
      ? new Date(grimoire.updatedAt).toLocaleDateString()
      : null,
    initialUpvotes: totals.upvotes,
    initialDownvotes: totals.downvotes,
    initialUserVote,
    initialSaved,
  };

  return (
    <section className="container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/registry">Registry</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>{grimoire.title}</span>
      </nav>

      <GrimoireDetailClient {...detailProps} />
    </section>
  );
}
