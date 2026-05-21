import { chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const gitDir = resolve(".git");
const hooksDir = ".githooks";
const prePushHook = resolve(hooksDir, "pre-push");

function normalizeHooksPath(value) {
  return value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function readLocalHooksPath() {
  try {
    return execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function fail(message) {
  console.error(`git hook setup failed: ${message}`);
  process.exit(1);
}

if (!existsSync(gitDir)) {
  console.log("git hook setup skipped: .git directory not found");
  process.exit(0);
}

if (!existsSync(prePushHook)) {
  fail(".githooks/pre-push does not exist");
}

try {
  chmodSync(prePushHook, 0o755);

  const currentHooksPath = readLocalHooksPath();
  if (normalizeHooksPath(currentHooksPath) === normalizeHooksPath(hooksDir)) {
    console.log("git hooks already installed: pre-push will run pnpm verify:answer");
    process.exit(0);
  }

  execFileSync("git", ["config", "--local", "core.hooksPath", hooksDir], {
    stdio: "inherit",
  });
} catch (error) {
  fail(error instanceof Error ? error.message : "unknown error");
}

console.log("git hooks installed: pre-push will run pnpm verify:answer");
