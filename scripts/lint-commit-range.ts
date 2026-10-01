import { spawn } from "node:child_process";

export const GITHUB_WEB_COMMITTER_EMAIL = "noreply@github.com";

export function isGitHubWebCommit(committerEmail: string): boolean {
  return committerEmail === GITHUB_WEB_COMMITTER_EMAIL;
}

export function commitMessageForLint(rawMessage: string, committerEmail: string): string {
  if (!isGitHubWebCommit(committerEmail)) {
    return rawMessage;
  }

  return rawMessage.split(/\r?\n/, 1)[0] ?? "";
}

export function parseCommitRangeArgs(
  argv: string[],
): { from: string; to: string } | { error: string } {
  let from: string | undefined;
  let to: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--from" && next) {
      from = next;
      index += 1;
      continue;
    }
    if (arg === "--to" && next) {
      to = next;
      index += 1;
    }
  }

  if (!from || !to) {
    return { error: "Usage: bun scripts/lint-commit-range.ts --from <sha> --to <sha>" };
  }

  return { from, to };
}

export async function lintCommitMessage(message: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["./node_modules/@commitlint/cli/cli.js", "--verbose"], {
      stdio: ["pipe", "inherit", "inherit"],
    });

    const stdin = child.stdin;
    if (!stdin) {
      reject(new Error("commitlint stdin is unavailable"));
      return;
    }

    stdin.write(message);
    if (!message.endsWith("\n")) {
      stdin.write("\n");
    }
    stdin.end();
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function gitText(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return stdout;
}

export async function lintCommitRange(from: string, to: string): Promise<number> {
  const shas = (await gitText(["rev-list", "--reverse", `${from}..${to}`]))
    .trim()
    .split("\n")
    .filter(Boolean);

  if (shas.length === 0) {
    console.log("No commits to lint.");
    return 0;
  }

  for (const sha of shas) {
    const committerEmail = (await gitText(["log", "-1", "--format=%ce", sha])).trim();
    const rawMessage = await gitText(["log", "-1", "--format=%B", sha]);
    const message = commitMessageForLint(rawMessage, committerEmail);

    if (isGitHubWebCommit(committerEmail)) {
      console.log(`Linting subject only for GitHub-generated commit ${sha}`);
    } else {
      console.log(`Linting ${sha}`);
    }

    const code = await lintCommitMessage(message);
    if (code !== 0) {
      return code;
    }
  }

  return 0;
}

async function main(): Promise<void> {
  const parsed = parseCommitRangeArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
  }

  process.exit(await lintCommitRange(parsed.from, parsed.to));
}

if (import.meta.main) {
  void main();
}
