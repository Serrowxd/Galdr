import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StaveDetailClient } from "@/components/StaveDetailClient";
import { getDbOptional } from "@/db";
import {
  getCommentCount,
  getUserVote,
  isStaveSaved,
  getVoteTotals,
  listCommentsForStave,
} from "@/lib/staveEngagement";
import { getUserProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import {
  getStaveAttribution,
  getStaveBySlug,
  getVersionsByFamily,
} from "@/lib/staves";
import { getStaveFiles } from "@/lib/stavePackages";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDbOptional();
  if (!db) return { title: "Stave | Galdr" };
  const stave = await getStaveBySlug(db, slug);
  if (!stave) return { title: "Stave | Galdr" };

  // Don't leak a draft/private stave's title or description to non-owners.
  if (stave.status === "draft" || stave.private) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== stave.authorId) return { title: "Stave | Galdr" };
  }

  return {
    title: `${stave.title} | Galdr`,
    description: stave.description ?? undefined,
  };
}

export default async function StaveDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const db = getDbOptional();
  if (!db) notFound();

  const stave = await getStaveBySlug(db, slug);
  if (!stave) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthor = user?.id === stave.authorId;

  // Drafts and private (unlisted) staves are owner-only — hide their
  // existence from everyone else.
  if ((stave.status === "draft" || stave.private) && !isAuthor) notFound();

  const status = stave.status === "published" ? "published" : "draft";

  const [versions, author, packageFiles] = await Promise.all([
    getVersionsByFamily(db, stave.familyId),
    getUserProfileByUserId(db, stave.authorId),
    getStaveFiles(db, stave.id),
  ]);

  const forkedFrom = stave.forkedFrom
    ? await getStaveAttribution(db, stave.forkedFrom)
    : null;

  const authorName = author?.username ?? "Unknown scribe";
  const sagaHref = author?.username
    ? `/saga/${author.username.toLowerCase()}`
    : "/";

  const votes = await getVoteTotals(db, stave.id);
  const cCount = await getCommentCount(db, stave.id);
  const initialTotals = {
    upvotes: votes.upvotes,
    downvotes: votes.downvotes,
    commentsCount: cCount,
  };

  let initialUserVote: 1 | -1 | 0 = 0;
  let initialSaved = false;
  if (user) {
    initialUserVote = await getUserVote(db, stave.id, user.id);
    initialSaved = await isStaveSaved(db, stave.id, user.id);
  }

  const rows = await listCommentsForStave(db, stave.id);
  const initialComments = rows.map((r) => ({
    id: r.id,
    authorLabel: r.authorLabel,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <section className="container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Registry</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>{stave.title}</span>
      </nav>

      <StaveDetailClient
        stave={stave}
        authorName={authorName}
        sagaHref={sagaHref}
        isAuthor={isAuthor}
        status={status}
        versions={versions}
        forkedFrom={forkedFrom}
        packageFiles={packageFiles}
        initialTotals={initialTotals}
        initialUserVote={initialUserVote}
        initialSaved={initialSaved}
        initialComments={initialComments}
      />
    </section>
  );
}
