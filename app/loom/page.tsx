"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Code2,
  Copy,
  Eraser,
  ExternalLink,
  FileText,
  Heading2,
  Lightbulb,
  List,
  PlayCircle,
  ShieldAlert,
  RotateCcw,
  Table,
  TriangleAlert,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  type AIProvider,
  loadGlobalAISettings,
  saveGlobalAISettings,
} from "@/lib/globalSettings";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { loomOutputMock } from "@/lib/mockData";

const initialMarkdown = `# Stave: Code Reviewer

## Role
You are a meticulous code reviewer specializing in security and performance.

## Instructions
1. Analyze the provided code for vulnerabilities
2. Check for N+1 queries and memory leaks
3. Verify error handling coverage
4. Suggest improvements with examples

## Constraints
- Never approve code with SQL injection vectors
- Flag any hardcoded credentials
- Maximum response length: 2000 tokens
`;

const templates = {
  reviewer: initialMarkdown,
  moderation: `# Stave: Forum Moderator

## Role
You are a strict forum moderation stave that focuses on civility and policy.

## Instructions
1. Detect toxicity and personal attacks.
2. Suggest a calm rewrite for borderline content.
3. Classify enforcement action: warn, hide, or lock.

## Constraints
- Preserve user intent where possible.
- Keep explanations under 8 lines.
`,
  release: `# Stave: Release Note Forger

## Role
Generate release notes from commits and issue metadata.

## Inputs
- Commit summaries
- Closed issue IDs
- Breaking change markers

## Output
1. Highlights
2. Fixes
3. Breaking changes
4. Upgrade guidance
`,
};

type CheckReport = {
  score: number;
  errors: string[];
  warnings: string[];
  suggestions: string[];
};

const providerOptions: { value: AIProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
];

function analyzeStave(markdown: string): CheckReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const hasRole = markdown.includes("## Role");
  const hasInstructions = markdown.includes("## Instructions");
  const hasConstraints = markdown.includes("## Constraints");
  const hasOutput = markdown.includes("## Output");

  if (!hasRole) errors.push("Missing required section: ## Role");
  if (!hasInstructions) errors.push("Missing required section: ## Instructions");
  if (!hasConstraints) errors.push("Missing required section: ## Constraints");

  const instructionCount = markdown
    .split("\n")
    .filter((line) => /^\d+\.\s/.test(line.trim())).length;
  if (instructionCount < 3) {
    warnings.push("Instruction list is short; consider adding 3+ explicit directives.");
  }

  const constraintCount = markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .length;
  if (constraintCount < 2) {
    warnings.push("Constraints section could be stronger with 2+ guardrails.");
  }

  if (!hasOutput) {
    suggestions.push("Add an ## Output section to make responses more deterministic.");
  }

  if (!/maximum response length|token/i.test(markdown)) {
    suggestions.push("Specify max response length/tokens for predictable output size.");
  }

  if (!/example|format/i.test(markdown)) {
    suggestions.push("Include a concrete response example or format template.");
  }

  const score = Math.max(
    0,
    100 - errors.length * 26 - warnings.length * 11 - suggestions.length * 6,
  );

  return { score, errors, warnings, suggestions };
}

function buildTerminalLines(report: CheckReport, traceLevel: string): string[] {
  const lines: string[] = [
    `> quality-check profile: ${traceLevel}`,
    "> mode: pseudo-run (no tool execution)",
    "> parsing stave markdown...",
    `> score computed: ${report.score}/100`,
  ];

  if (report.errors.length === 0 && report.warnings.length === 0) {
    lines.push("> no blocking inconsistencies detected");
  }

  report.errors.forEach((item) => lines.push(`ERROR: ${item}`));
  report.warnings.forEach((item) => lines.push(`WARN: ${item}`));
  report.suggestions.forEach((item) => lines.push(`SUGGEST: ${item}`));

  lines.push(...loomOutputMock.split("\n").slice(0, 6));
  lines.push("> quality-check complete");
  return lines;
}

export default function LoomPage() {
  const initialSettings = loadGlobalAISettings();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<
    "terminal" | "report" | "preview"
  >("preview");
  const [traceLevel, setTraceLevel] = useState("standard");
  const [copied, setCopied] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(initialSettings.provider);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [saveToGlobal, setSaveToGlobal] = useState(true);
  const [savedSettingsNotice, setSavedSettingsNotice] = useState("");
  const [report, setReport] = useState<CheckReport>({
    score: 0,
    errors: [],
    warnings: [],
    suggestions: [],
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lineCount = useMemo(() => markdown.split("\n").length, [markdown]);

  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMarkdown((prev) => `${prev}\n${snippet}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue =
      markdown.slice(0, start) + snippet + markdown.slice(end);

    setMarkdown(nextValue);
    queueMicrotask(() => {
      textarea.focus();
      const nextCursor = start + snippet.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const applyTemplate = (templateKey: keyof typeof templates) => {
    setMarkdown(templates[templateKey]);
  };

  const formatMarkdown = () => {
    const formatted = markdown
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n");
    setMarkdown(formatted);
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const handleSaveSettings = () => {
    saveGlobalAISettings({ provider, apiKey });
    setSavedSettingsNotice("Saved");
    setTimeout(() => setSavedSettingsNotice(""), 1400);
  };

  const handleAnalyze = () => {
    const nextReport = analyzeStave(markdown);
    setReport(nextReport);

    if (saveToGlobal) {
      saveGlobalAISettings({ provider, apiKey });
    }

    setOutput("");
    setRunning(true);
    setActiveResultTab("terminal");

    const lines = buildTerminalLines(nextReport, traceLevel);
    let current = 0;
    const timer = setInterval(() => {
      if (current < lines.length) {
        setOutput((prev) =>
          prev ? `${prev}\n${lines[current]}` : lines[current],
        );
        current += 1;
      } else {
        clearInterval(timer);
        setRunning(false);
      }
    }, 85);
  };

  return (
    <section>
      <div className="container page-block" style={{ paddingBottom: "0.8rem" }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h1 className="section-title">The Loom</h1>
          <div className="loom-run-controls">
            <label className="loom-trace-level">
              Trace
              <select
                className="select"
                value={traceLevel}
                onChange={(event) => setTraceLevel(event.target.value)}
                aria-label="Trace level"
              >
                <option value="standard">Standard</option>
                <option value="verbose">Verbose</option>
                <option value="strict">Strict</option>
              </select>
            </label>
            <button
              className="loom-ghost-btn"
              type="button"
              onClick={() => setOutput("")}
              disabled={running && output.length === 0}
            >
              <Trash2 size={13} />
              Clear output
            </button>
            <button className="loom-run-btn" type="button" onClick={handleAnalyze} disabled={running}>
              <PlayCircle size={14} />
              {running ? "Analyzing..." : "Analyze Stave"}
            </button>
          </div>
        </div>
      </div>

      <div className="loom-pane">
        <div className="loom-col">
          <div className="pane-head">Stave Editor ({lineCount} lines)</div>
          <div className="loom-toolbar" role="toolbar" aria-label="Editor tools">
            <div className="loom-tool-group">
              <button
                className="loom-tool-btn"
                type="button"
                onClick={() => insertSnippet("\n## Section\n")}
              >
                <Heading2 size={13} />
                Heading
              </button>
              <button
                className="loom-tool-btn"
                type="button"
                onClick={() => insertSnippet("\n- item one\n- item two\n")}
              >
                <List size={13} />
                List
              </button>
              <button
                className="loom-tool-btn"
                type="button"
                onClick={() => insertSnippet("\n```md\n# Notes\n```\n")}
              >
                <Code2 size={13} />
                Code
              </button>
              <button
                className="loom-tool-btn"
                type="button"
                onClick={() =>
                  insertSnippet(
                    "\n| Field | Value |\n| --- | --- |\n| Risk | High |\n",
                  )
                }
              >
                <Table size={13} />
                Table
              </button>
            </div>

            <div className="loom-tool-group">
              <label className="loom-template-select">
                <span className="loom-template-label">
                  <FileText size={13} />
                  Template
                </span>
                <span className="loom-template-select-wrap">
                  <select
                    className="select loom-template-dropdown"
                    defaultValue=""
                    onChange={(event) => {
                      const value = event.target.value as keyof typeof templates;
                      if (value) {
                        applyTemplate(value);
                        event.target.value = "";
                      }
                    }}
                    aria-label="Apply markdown template"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="reviewer">Code Reviewer</option>
                    <option value="moderation">Forum Moderator</option>
                    <option value="release">Release Notes</option>
                  </select>
                  <span className="loom-template-caret" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>
              <button className="loom-tool-btn" type="button" onClick={formatMarkdown}>
                <Wand2 size={13} />
                Tidy
              </button>
              <button className="loom-tool-btn" type="button" onClick={copyMarkdown}>
                <Copy size={13} />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className="loom-tool-btn"
                type="button"
                onClick={() => setMarkdown(initialMarkdown)}
              >
                <RotateCcw size={13} />
                Reset
              </button>
              <button
                className="loom-tool-btn is-danger"
                type="button"
                onClick={() => setMarkdown("")}
              >
                <Eraser size={13} />
                Clear
              </button>
            </div>
          </div>
          <label style={{ display: "contents" }}>
            <textarea
              ref={textareaRef}
              className="loom-editor"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              aria-label="Markdown editor"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="loom-col">
          <div className="pane-head">Quality Check Results</div>
          <div className="loom-result-tabs" role="tablist" aria-label="Result views">
            <button
              type="button"
              role="tab"
              className={`loom-result-tab ${activeResultTab === "terminal" ? "is-active" : ""}`}
              onClick={() => setActiveResultTab("terminal")}
            >
              Terminal Stream
            </button>
            <button
              type="button"
              role="tab"
              className={`loom-result-tab ${activeResultTab === "report" ? "is-active" : ""}`}
              onClick={() => setActiveResultTab("report")}
            >
              Structured Report
            </button>
            <button
              type="button"
              role="tab"
              className={`loom-result-tab ${activeResultTab === "preview" ? "is-active" : ""}`}
              onClick={() => setActiveResultTab("preview")}
            >
              Markdown Preview
            </button>
          </div>

          {activeResultTab === "terminal" ? (
            output ? (
              <pre className="terminal">
                {output}
                {running ? <span className="cursor-pulse" /> : null}
              </pre>
            ) : (
              <p className="terminal-muted">
                Press <strong style={{ color: "var(--accent)" }}>Analyze Stave</strong> to run a quality check.
              </p>
            )
          ) : null}

          {activeResultTab === "report" ? (
            <section className="loom-report-panel">
              <div className="loom-report-settings">
                <label className="loom-report-field">
                  Provider
                  <select
                    className="select loom-report-control"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as AIProvider)}
                  >
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="loom-report-field">
                  API Key
                  <input
                    className="input loom-report-control"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-..."
                  />
                </label>
              </div>

              <div className="loom-report-actions">
                <label className="loom-save-global">
                  <input
                    type="checkbox"
                    checked={saveToGlobal}
                    onChange={(event) => setSaveToGlobal(event.target.checked)}
                  />
                  Save to global settings
                </label>
                <button
                  type="button"
                  className="loom-ghost-btn"
                  onClick={handleSaveSettings}
                >
                  Save settings
                </button>
                <Link href="/settings" className="loom-settings-link">
                  Open settings <ExternalLink size={12} />
                </Link>
                {savedSettingsNotice ? (
                  <span className="muted">{savedSettingsNotice}</span>
                ) : null}
              </div>

              <div className="loom-report-score">
                <span>Quality Score</span>
                <strong>{report.score}/100</strong>
              </div>

              <div className="loom-report-grid">
                <article>
                  <h3><ShieldAlert size={14} /> Errors ({report.errors.length})</h3>
                  {report.errors.length ? (
                    <ul>{report.errors.map((item) => <li key={item}>{item}</li>)}</ul>
                  ) : (
                    <p>No blocking errors detected.</p>
                  )}
                </article>
                <article>
                  <h3><TriangleAlert size={14} /> Warnings ({report.warnings.length})</h3>
                  {report.warnings.length ? (
                    <ul>{report.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
                  ) : (
                    <p>No warnings.</p>
                  )}
                </article>
                <article>
                  <h3><Lightbulb size={14} /> Suggestions ({report.suggestions.length})</h3>
                  {report.suggestions.length ? (
                    <ul>{report.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>
                  ) : (
                    <p>No suggestions.</p>
                  )}
                </article>
                <article>
                  <h3><BadgeCheck size={14} /> Status</h3>
                  <p>
                    {report.errors.length > 0
                      ? "Needs revision before dependable runs."
                      : "Stave structure is viable for pseudo-run checks."}
                  </p>
                </article>
              </div>
            </section>
          ) : null}

          {activeResultTab === "preview" ? (
            <article className="loom-preview-panel">{renderMarkdownPreview(markdown)}</article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
