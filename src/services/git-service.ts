import { execSync } from "child_process";
import path from "path";

export function getCurrentBranch(cwd: string): string | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
    });
    return branch.trim();
  } catch {
    return null;
  }
}

export function isGitRepository(cwd: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}
