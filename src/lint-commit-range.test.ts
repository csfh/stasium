import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import {
  GITHUB_WEB_COMMITTER_EMAIL,
  commitMessageForLint,
  isGitHubWebCommit,
  lintCommitMessage,
  parseCommitRangeArgs,
} from "../scripts/lint-commit-range";

const require = createRequire(import.meta.url);
const { isGeneratedPrBodyCommit } = require("../commitlint.config.cjs") as {
  isGeneratedPrBodyCommit: (message: string) => boolean;
};

const SQUASH_SUBJECT = "docs: replace formal code of conduct with community notice (#198)";

const CURSOR_AGENT_SQUASH_BODY = `${SQUASH_SUBJECT}

<!-- CURSOR_AGENT_PR_BODY_BEGIN -->
This replaces the formal code of conduct with a short community notice.

<!-- CURSOR_AGENT_PR_BODY_END -->

<div><a
href="https://cursor.com/agents/bc-6cfb1133-2392-4f74-8301-8366b433fd5c?cursor_ref=pr_footer&cursor_cta=open_in_web"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://cursor.com/assets/images/open-in-web-dark.png"><source
media="(prefers-color-scheme: light)"
srcset="https://cursor.com/assets/images/open-in-web-light.png"><img
alt="Open in Web" width="114" height="28"
src="https://cursor.com/assets/images/open-in-web-dark.png"></picture></a>&nbsp;<a
href="https://cursor.com/background-agent?bcId=bc-6cfb1133-2392-4f74-8301-8366b433fd5c&cursor_ref=pr_footer&cursor_cta=open_in_cursor"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://cursor.com/assets/images/open-in-cursor-dark.png"><source
media="(prefers-color-scheme: light)"
srcset="https://cursor.com/assets/images/open-in-cursor-light.png"><img
alt="Open in Cursor" width="131" height="28"
src="https://cursor.com/assets/images/open-in-cursor-dark.png"></picture></a>&nbsp;</div>

Co-authored-by: Cursor Agent <cursoragent@cursor.com>
`;

describe("commitMessageForLint", () => {
  test("keeps developer commit messages intact", () => {
    const message = "fix: avoid duplicate startup\n\nExplain the change in wrapped lines.\n";
    expect(commitMessageForLint(message, "git@christofferhallas.com")).toBe(message);
    expect(isGitHubWebCommit("git@christofferhallas.com")).toBe(false);
  });

  test("lints only the subject of GitHub squash and merge commits", () => {
    expect(isGitHubWebCommit(GITHUB_WEB_COMMITTER_EMAIL)).toBe(true);
    expect(commitMessageForLint(CURSOR_AGENT_SQUASH_BODY, GITHUB_WEB_COMMITTER_EMAIL)).toBe(
      SQUASH_SUBJECT,
    );
  });
});

describe("parseCommitRangeArgs", () => {
  test("reads --from and --to", () => {
    expect(parseCommitRangeArgs(["--from", "abc", "--to", "def"])).toEqual({
      from: "abc",
      to: "def",
    });
  });

  test("rejects missing range flags", () => {
    expect(parseCommitRangeArgs([])).toEqual({
      error: "Usage: bun scripts/lint-commit-range.ts --from <sha> --to <sha>",
    });
  });
});

describe("generated PR body ignore", () => {
  test("ignores Cursor agent squash-merge bodies", () => {
    expect(isGeneratedPrBodyCommit(CURSOR_AGENT_SQUASH_BODY)).toBe(true);
  });

  test("does not ignore ordinary conventional commits", () => {
    expect(isGeneratedPrBodyCommit("fix: avoid duplicate startup\n\nWrapped body.\n")).toBe(false);
  });
});

describe("commitlint on generated merge bodies", () => {
  test("accepts the current main squash-merge message", async () => {
    expect(await lintCommitMessage(CURSOR_AGENT_SQUASH_BODY)).toBe(0);
  });

  test("still rejects a developer body line over 100 characters", async () => {
    const longLine = "x".repeat(120);
    const message = `fix: keep body line limits\n\n${longLine}\n`;
    expect(await lintCommitMessage(message)).toBe(1);
  });
});
