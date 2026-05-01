import { auth } from "@clerk/nextjs/server";
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
import { getStaveById } from "@/lib/staves";
import { getStavePackageFiles } from "@/lib/stavePackages";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const stave = getStaveById(id);
  if (!stave) return { title: "Stave | Galdr" };
  return {
    title: `${stave.title} | Galdr`,
    description: stave.description,
  };
}

export default async function StaveDetailPage({ params }: PageProps) {
  const { id } = await params;
  const stave = getStaveById(id);
  if (!stave) notFound();

  const packageFiles = getStavePackageFiles(id) ?? [];
  const grimoireHref = `/grimoire/${stave.scribeSlug}`;

  const { userId } = await auth();
  const db = getDbOptional();

  let initialTotals = {
    upvotes: 0,
    downvotes: 0,
    commentsCount: 0,
  };
  let initialUserVote: 1 | -1 | 0 = 0;
  let initialSaved = false;
  let initialComments: {
    id: string;
    authorLabel: string;
    body: string;
    createdAt: string;
  }[] = [];

  if (db) {
    const votes = await getVoteTotals(db, id);
    const cCount = await getCommentCount(db, id);
    initialTotals = {
      upvotes: votes.upvotes,
      downvotes: votes.downvotes,
      commentsCount: cCount,
    };
    if (userId) {
      initialUserVote = await getUserVote(db, id, userId);
      initialSaved = await isStaveSaved(db, id, userId);
    }
    const rows = await listCommentsForStave(db, id);
    initialComments = rows.map((r) => ({
      id: r.id,
      authorLabel: r.authorLabel,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  return (
    <section className="container page-block panel-stack">
      <nav className="muted stave-breadcrumb" aria-label="Breadcrumb">
        <Link href="/registry">Registry</Link>
        <span aria-hidden> / </span>
        <span>{stave.title}</span>
      </nav>

      <StaveDetailClient
        stave={stave}
        packageFiles={packageFiles}
        grimoireHref={grimoireHref}
        initialTotals={initialTotals}
        initialUserVote={initialUserVote}
        initialSaved={initialSaved}
        initialComments={initialComments}
      />
    </section>
  );
}
