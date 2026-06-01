import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Layers, Play, Workflow } from "lucide-react";
import { VegvisirLogo } from "@/components/VegvisirLogo";

export const metadata: Metadata = {
  title: "About — Galdr",
  description: "What Galdr is, and how staves and grimoires fit together.",
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="page-hero" aria-labelledby="about-title">
        <div className="container page-hero-inner">
          <div className="page-hero-copy">
            <p className="page-hero-tag">About Galdr</p>
            <h1 id="about-title" className="page-hero-title">
              An open registry for
              <br />
              agent skills.
            </h1>
            <p className="page-hero-sub">
              An agent is only as good as the instructions behind it. Galdr is
              where people write those instructions down and share them. One
              skill is a <strong>stave</strong>. A stack of staves is a{" "}
              <strong>grimoire</strong>. That&apos;s the whole idea.
            </p>
            <div className="about-wip" role="note">
              <span className="about-wip-dot" aria-hidden />
              <p>
                <strong>Work in progress.</strong> These ideas are still
                settling — expect the model and its best practices to change.
              </p>
            </div>
          </div>
          <div className="page-hero-emblem" aria-hidden>
            <VegvisirLogo size={220} />
          </div>
        </div>
      </section>

      <section className="container home-section" aria-labelledby="why-title">
        <div className="section-head">
          <span className="about-eyebrow">The problem</span>
          <h2 id="why-title" className="section-title">
            Why Galdr exists
          </h2>
        </div>
        <p className="about-lede">
          Good agent instructions get written once and then lost: buried in a
          notes app, a private repo, a chat thread. The next person rebuilds the
          same thing from scratch. Galdr is the shared place to put that work —
          find a stave someone already got right, and build on it instead of
          reinventing it.
        </p>
      </section>

      <section className="container home-section" aria-labelledby="concepts-title">
        <div className="section-head">
          <span className="about-eyebrow">The model</span>
          <h2 id="concepts-title" className="section-title">
            The core ideas
          </h2>
        </div>
        <p className="about-lede">
          Three ideas, and how they nest: a stave is one skill, a grimoire is a
          stack of them, and orchestration is what makes a grimoire run itself.
        </p>
        <div className="concept-grid">
          <article className="concept-card" data-kind="stave">
            <div className="concept-head">
              <span className="concept-icon">
                <FileText size={18} aria-hidden />
              </span>
              <span className="concept-badge">Stave</span>
            </div>
            <h3 className="concept-name">A single skill</h3>
            <p className="concept-body">
              One stave, one job. It&apos;s a folder, not just a file: a README,
              an AGENTS.md or SKILLS.md, and whatever else the task needs. Staves
              are versioned and forkable, so the good ones are easy to build on.
            </p>
            <p className="concept-meta">
              A stave never drives other staves. That&apos;s a grimoire&apos;s
              job.
            </p>
            <Link href="/registry" className="section-link">
              Browse staves →
            </Link>
          </article>

          <article className="concept-card" data-kind="grimoire">
            <div className="concept-head">
              <span className="concept-icon">
                <Layers size={18} aria-hidden />
              </span>
              <span className="concept-badge">Grimoire</span>
            </div>
            <h3 className="concept-name">A stack of staves</h3>
            <p className="concept-body">
              A grimoire puts staves in a deliberate order. It tracks each stave
              by family, not by snapshot, so it can follow the latest version or
              pin a known-good one when you need the output to stay put.
            </p>
            <p className="concept-meta">
              Run it in order as-is, or layer orchestration on top.
            </p>
            <Link href="/registry?type=grimoires" className="section-link">
              Browse grimoires →
            </Link>
          </article>

          <article className="concept-card" data-kind="orchestration">
            <div className="concept-head">
              <span className="concept-icon">
                <Workflow size={18} aria-hidden />
              </span>
              <span className="concept-badge">Orchestration</span>
            </div>
            <h3 className="concept-name">A grimoire that runs</h3>
            <p className="concept-body">
              Orchestration is optional, and it belongs to grimoires, not staves.
              A plain grimoire just runs its staves in order. An orchestrated one
              adds a document at the head — a file, a stave, or a folder pointed
              to by an AGENTS.md — that tells a model how to drive the whole run.
            </p>
            <p className="concept-meta">
              Optional. Most grimoires are fine without it.
            </p>
          </article>
        </div>
        <figure className="model-figure">
          <div
            className="model-grimoire"
            role="img"
            aria-label="A grimoire holds staves that run in order, plus an optional head document that lets a model drive them."
          >
            <span className="model-chip model-chip-grimoire">Grimoire</span>
            <div className="model-rows">
              <div className="model-row model-row-head">
                <Play size={11} aria-hidden />
                <span>Head document</span>
                <span className="model-opt">optional · orchestration</span>
              </div>
              <div className="model-row model-row-stave">
                <span className="model-dot" aria-hidden /> Stave
              </div>
              <div className="model-row model-row-stave">
                <span className="model-dot" aria-hidden /> Stave
              </div>
              <div className="model-row model-row-stave">
                <span className="model-dot" aria-hidden /> Stave
              </div>
            </div>
          </div>
          <figcaption className="model-caption">
            A <strong>stave</strong> is one skill. A <strong>grimoire</strong>{" "}
            is a set of staves run in order. Give it a head document and
            it&apos;s{" "}
            <strong>orchestrated</strong> — a model drives the run. Each one runs
            on its own.
          </figcaption>
        </figure>
      </section>

      <section className="container home-section" aria-labelledby="open-title">
        <div className="section-head">
          <span className="about-eyebrow">The format</span>
          <h2 id="open-title" className="section-title">
            Portable and open
          </h2>
        </div>
        <p className="about-lede">
          A stave is just markdown and files — nothing proprietary. Any agent
          that reads instructions can use one, so what you publish here
          isn&apos;t tied to a single vendor or runtime.
        </p>
        <figure className="stave-sample">
          <figcaption className="stave-sample-bar">
            <span className="stave-sample-dot" />
            <span className="stave-sample-dot" />
            <span className="stave-sample-dot" />
            <span className="stave-sample-name">stave.md</span>
          </figcaption>
          <pre className="stave-sample-body">
            <span className="tok-h">{"# Stave: Code Reviewer"}</span>
            {"\n\n"}
            <span className="tok-h2">{"## Role"}</span>
            {"\nYou are a meticulous reviewer focused on\nsecurity and performance.\n\n"}
            <span className="tok-h2">{"## Instructions"}</span>
            {"\n1. Flag SQL injection vectors\n2. Check for N+1 queries\n3. Verify error handling"}
          </pre>
        </figure>
        <ul className="about-points">
          <li>
            <strong>Plain files.</strong> A README, an AGENTS.md, whatever the
            task needs. If you can read it, so can your agent.
          </li>
          <li>
            <strong>Open registry.</strong> Everything published is public to
            search, read, and download.
          </li>
          <li>
            <strong>Licensed and forkable.</strong> Every stave carries a
            license — fork one, improve it, and publish your version with credit
            intact.
          </li>
          <li>
            <strong>Yours to take.</strong> Download any stave or grimoire and
            run it wherever you want. No lock-in.
          </li>
        </ul>
      </section>

      <section className="container home-section" aria-labelledby="orchestration-title">
        <div className="section-head">
          <span className="about-eyebrow">The pattern</span>
          <h2 id="orchestration-title" className="section-title">
            How orchestration works
          </h2>
        </div>
        <p className="about-lede">
          Orchestration is opt-in. Without it, a grimoire is just a list you work
          through in order. With it, you compose small staves into one workflow
          without hard-coding that workflow into any single stave.
        </p>
        <ol className="flow-steps">
          <li className="flow-step">
            <span className="flow-num">1</span>
            <div className="flow-text">
              <h3 className="flow-title">Write a focused stave</h3>
              <p>
                Keep each stave to one job and package it with its own README and
                AGENTS.md so it stands on its own.
              </p>
            </div>
          </li>
          <li className="flow-step">
            <span className="flow-num">2</span>
            <div className="flow-text">
              <h3 className="flow-title">Stack them in order</h3>
              <p>
                Add staves to a grimoire in the order they should run. Pin
                versions when you need the result to be repeatable.
              </p>
            </div>
          </li>
          <li className="flow-step">
            <span className="flow-num">3</span>
            <div className="flow-text">
              <h3 className="flow-title">Add a head document</h3>
              <p>
                Put one orchestration document at the top — a file, a stave, or a
                folder referenced by an AGENTS.md. It says how the pieces fit and
                in what order.
              </p>
            </div>
          </li>
          <li className="flow-step">
            <span className="flow-num">4</span>
            <div className="flow-text">
              <h3 className="flow-title">Hand it to a model</h3>
              <p>
                A model reads the head document and works through the staves in
                order. One grimoire, one run.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="container home-section" aria-labelledby="use-title">
        <div className="section-head">
          <span className="about-eyebrow">The loop</span>
          <h2 id="use-title" className="section-title">
            How you use it
          </h2>
        </div>
        <p className="about-lede">
          The loop is simple. Draft a stave in the Loom, publish it to the
          registry, and it&apos;s immediately something other people can find,
          run, and build on.
        </p>
        <ul className="about-points">
          <li>
            <strong>The Loom.</strong> Galdr&apos;s editor. Write a stave,
            organize its files, and check it before you publish.
          </li>
          <li>
            <strong>The registry.</strong> Where published staves and grimoires
            live. Search by tag, sort, and download.
          </li>
          <li>
            <strong>Your library.</strong> Save the staves and grimoires you
            rely on so they&apos;re one click away.
          </li>
          <li>
            <strong>Fork and version.</strong> Start from someone else&apos;s
            stave, change what you need, and publish your own version.
          </li>
        </ul>
      </section>

      <section className="container home-section" aria-labelledby="saga-title">
        <div className="section-head">
          <span className="about-eyebrow">Your presence</span>
          <h2 id="saga-title" className="section-title">
            And your saga
          </h2>
        </div>
        <p className="about-lede">
          Everything you publish lands on your <strong>saga</strong> — your
          public page on Galdr, where people find your work and follow what you
          build. Anyone can read it; only you can add to it.
        </p>
        <div className="about-cta-row">
          <Link href="/loom" className="btn btn-primary">
            Open the Loom
          </Link>
          <Link href="/registry" className="btn">
            Browse the registry
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
          <span>An open registry of skills for AI agents.</span>
        </div>
      </footer>
    </div>
  );
}
