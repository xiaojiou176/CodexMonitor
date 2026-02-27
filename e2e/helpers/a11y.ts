import type { Page } from "@playwright/test";

const AXE_SCRIPT_URL_CANDIDATES = [
  "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
  "https://unpkg.com/axe-core@4.10.2/axe.min.js",
] as const;

export type A11yNodeSummary = {
  target: string;
  htmlSnippet: string;
  failureSummary: string;
};

export type A11yViolationSummary = {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  nodes: A11yNodeSummary[];
};

export type A11yAuditSummary = {
  violations: A11yViolationSummary[];
  inapplicableCount: number;
  incompleteCount: number;
  passesCount: number;
};

async function hasAxe(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const maybeAxe = (window as unknown as { axe?: { run?: unknown } }).axe;
    return typeof maybeAxe?.run === "function";
  });
}

export async function ensureAxeOnPage(page: Page): Promise<void> {
  if (await hasAxe(page)) {
    return;
  }

  let lastError: unknown;
  for (const scriptUrl of AXE_SCRIPT_URL_CANDIDATES) {
    const injected = await page.addScriptTag({ url: scriptUrl }).then(
      () => true,
      (error: unknown) => {
        lastError = error;
        return false;
      },
    );
    if (!injected) {
      continue;
    }
    if (await hasAxe(page)) {
      return;
    }
  }

  throw new Error(
    `Unable to load axe-core script into page. Last error: ${String(lastError ?? "unknown")}`,
  );
}

function compactText(input: string | null | undefined, maxLength = 220): string {
  const normalized = (input ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function formatViolations(violations: A11yViolationSummary[]): string {
  if (violations.length === 0) {
    return "No accessibility violations found.";
  }

  return violations
    .map((violation, violationIndex) => {
      const header = `${violationIndex + 1}. [${violation.id}] impact=${violation.impact} | ${violation.help}`;
      const nodeLines = violation.nodes.map((node, nodeIndex) => {
        const selector = node.target || "<unknown-target>";
        const failure = node.failureSummary || "No failure summary from axe.";
        return `   ${nodeIndex + 1}) target: ${selector} | html: ${node.htmlSnippet} | summary: ${failure}`;
      });
      return [header, ...nodeLines].join("\n");
    })
    .join("\n");
}

export async function runA11yAudit(page: Page): Promise<A11yAuditSummary> {
  await ensureAxeOnPage(page);

  const rawResults = await page.evaluate(async () => {
    const maybeAxe = (window as unknown as {
      axe: {
        run: (context: Document, options: Record<string, unknown>) => Promise<{
          violations: Array<{
            id: string;
            impact: string | null;
            help: string;
            helpUrl: string;
            nodes: Array<{
              target: string[];
              html: string;
              failureSummary: string | null;
            }>;
          }>;
          inapplicable: unknown[];
          incomplete: unknown[];
          passes: unknown[];
        }>;
      };
    }).axe;

    return maybeAxe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
      resultTypes: ["violations", "incomplete", "inapplicable", "passes"],
    });
  });

  const violations = rawResults.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    help: compactText(violation.help, 120),
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: compactText(node.target.join(" "), 180),
      htmlSnippet: compactText(node.html, 200),
      failureSummary: compactText(node.failureSummary, 220),
    })),
  }));

  return {
    violations,
    inapplicableCount: rawResults.inapplicable.length,
    incompleteCount: rawResults.incomplete.length,
    passesCount: rawResults.passes.length,
  };
}
