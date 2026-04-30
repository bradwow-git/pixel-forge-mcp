import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "..", "..");

export function getProjectRoot(): string {
  return projectRoot;
}

export function resolveProjectPath(targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return path.normalize(targetPath);
  }

  return path.resolve(projectRoot, targetPath);
}

export async function ensureDirectory(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}
