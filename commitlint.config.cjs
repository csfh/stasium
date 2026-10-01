const GENERATED_PR_BODY_MARKERS = [
  "<!-- CURSOR_AGENT_PR_BODY",
  "cursor.com/agents/",
  "cursor.com/background-agent",
];

function isGeneratedPrBodyCommit(message) {
  return GENERATED_PR_BODY_MARKERS.some((marker) => message.includes(marker));
}

module.exports = {
  extends: ["@commitlint/config-conventional"],
  // GitHub squash-merge copies the PR body into the commit. Agent PRs include
  // HTML footers and long URLs that are not conventional-commit bodies.
  ignores: [isGeneratedPrBodyCommit],
};

module.exports.isGeneratedPrBodyCommit = isGeneratedPrBodyCommit;
module.exports.GENERATED_PR_BODY_MARKERS = GENERATED_PR_BODY_MARKERS;
