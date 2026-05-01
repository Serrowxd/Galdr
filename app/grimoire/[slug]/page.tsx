import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StaveCard } from "@/components/StaveCard";
import {
  grimoireSlugFromUsername,
  normalizeGrimoirePathSlug,
} from "@/lib/grimoireSlug";
import type { Stave } from "@/lib/mockData";
import {
  getDistinctScribeSlugs,
  getStavesByScribeSlug,
} from "@/lib/staves";

type PageProps = { params: Promise<{ slug: string }> };

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export async function generateStaticParams() {
  return getDistinctScribeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normalizeGrimoirePathSlug(raw);
  if (!slug.length) return { title: "Grimoire | Galdr" };

  const rows = getStavesByScribeSlug(slug);
  if (rows.length) {
    const name = rows[0].scribe;
    return {
      title: `${name} · Grimoire | Galdr`,
      description: `Staves authored by ${name}.`,
    };
  }

  const { userId } = await auth();
  if (!userId) return { title: "Grimoire | Galdr" };

  const user = await currentUser();
  const ownerSlug =
    typeof user?.username === "string"
      ? grimoireSlugFromUsername(user.username)
      : null;

  if (ownerSlug === slug && user?.username?.trim()) {
    const label = user.username.trim();
    return {
      title: `${label} · Grimoire | Galdr`,
      description: `Staves authored by ${label}.`,
    };
  }

  return { title: "Grimoire | Galdr" };
}

export default async function GrimoireSlugPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = normalizeGrimoirePathSlug(raw);
  if (!slug.length) notFound();

  const authored = getStavesByScribeSlug(slug);

  if (authored.length > 0) {
    return <FilledGrimoire authored={authored} />;
  }

  const { userId } = await auth();
  if (!userId) notFound();

  const user = await currentUser();
  if (!user) notFound();

  const ownerSlug =
    typeof user.username === "string"
      ? grimoireSlugFromUsername(user.username)
      : null;

  if (ownerSlug !== slug) notFound();

  return <EmptyOwnerGrimoire user={user} />;
}

function FilledGrimoire({ authored }: { authored: Stave[] }) {
  const name = authored[0].scribe;
  const totalInvocations = authored.reduce((acc, s) => acc + s.invocations, 0);
  const avgSuccess = Math.round(
    authored.reduce((acc, s) => acc + s.successRate, 0) / authored.length,
  );
  const bindingsUsed = authored.reduce((acc, s) => acc + s.bindings, 0);

  return (
    <section className="container page-block panel-stack">
      <article className="profile-head">
        <div className="avatar" aria-hidden="true">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="section-title">{name}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Scribe · {authored.length} staves in registry
          </p>
        </div>
      </article>

      <section className="stats-grid">
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Total Staves
          </p>
          <p className="stat-value">{authored.length}</p>
        </article>
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Total Invocations
          </p>
          <p className="stat-value">{totalInvocations.toLocaleString()}</p>
        </article>
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Avg Success Rate
          </p>
          <p className="stat-value success">{avgSuccess}%</p>
        </article>
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Bindings Used
          </p>
          <p className="stat-value">{bindingsUsed}</p>
        </article>
      </section>

      <section className="panel-stack">
        <h2 className="section-title" style={{ fontSize: "1rem" }}>
          Authored Staves
        </h2>
        <div className="stave-grid">
          {authored.map((stave) => (
            <StaveCard key={stave.id} stave={stave} />
          ))}
        </div>
      </section>

      <p className="muted" style={{ marginTop: "1rem" }}>
        <Link href="/registry">← Back to Registry</Link>
      </p>
    </section>
  );
}

function EmptyOwnerGrimoire({ user }: { user: ClerkUser }) {
  const displayName =
    user.username?.trim() ||
    user.firstName?.trim() ||
    "Scribe";

  const t = displayName.trim();
  const initials =
    t.length >= 2
      ? t.slice(0, 2).toUpperCase()
      : t.length === 1
        ? (t + t).toUpperCase()
        : "?";

  const imageUrl = user.imageUrl;

  return (
    <section className="container page-block panel-stack">
      <article className="profile-head">
        {imageUrl ? (
          <Image
            className="grimoire-owner-avatar"
            src={imageUrl}
            alt=""
            width={64}
            height={64}
            unoptimized
          />
        ) : (
          <div className="avatar" aria-hidden="true">
            {initials}
          </div>
        )}
        <div>
          <h1 className="section-title">{displayName}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Your grimoire · 0 staves in registry
          </p>
        </div>
      </article>

      <section className="stats-grid">
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Total Staves
          </p>
          <p className="stat-value">0</p>
        </article>
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Total Invocations
          </p>
          <p className="stat-value">0</p>
        </article>
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Avg Success Rate
          </p>
          <p className="stat-value success">—</p>
        </article>
        <article className="card">
          <p className="muted" style={{ margin: 0 }}>
            Bindings Used
          </p>
          <p className="stat-value">0</p>
        </article>
      </section>

      <section className="panel-stack">
        <h2 className="section-title" style={{ fontSize: "1rem" }}>
          Authored Staves
        </h2>
        <div className="library-empty-state">
          <h2>No staves yet</h2>
          <p>
            Nothing tied to your username appears in the demo registry. Browse
            existing work or draft something new in the Loom.
          </p>
          <p style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
            <Link href="/registry" className="btn-ghost-sm">
              Browse registry
            </Link>
            <Link href="/loom" className="btn-ghost-sm">
              Open the Loom
            </Link>
          </p>
        </div>
      </section>

      <p className="muted" style={{ marginTop: "1rem" }}>
        <Link href="/registry">← Back to Registry</Link>
      </p>
    </section>
  );
}
