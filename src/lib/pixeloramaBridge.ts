import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import {
  ensureDirectory,
  ensureParentDirectory,
  pathExists,
  resolveProjectPath
} from "./paths.js";

export interface PixeloramaBridgeStatus {
  enabled: boolean;
  executableConfigured: boolean;
  executableFound: boolean;
  executablePath: string | null;
  warnings: string[];
}

export interface PixeloramaWorkspaceMetadata {
  projectName: string;
  category: string;
  size: number;
  sourceSpritePath: string;
  stagedSpritePath: string;
  createdAt: string;
}

const pixeloramaWorkspaceRoot = resolveProjectPath(path.join("examples", "pixelorama"));

export function getPixeloramaWorkspaceRoot(): string {
  return pixeloramaWorkspaceRoot;
}

export async function getPixeloramaBridgeStatus(): Promise<PixeloramaBridgeStatus> {
  const config = await loadConfig();
  const executablePath = config.pixeloramaExecutablePath
    ? resolveProjectPath(config.pixeloramaExecutablePath)
    : null;
  const executableFound = executablePath ? await pathExists(executablePath) : false;
  const warnings: string[] = [];

  if (!config.enablePixeloramaBridge) {
    warnings.push(
      "Pixelorama bridge is disabled in config/sprite-forge.config.json. Enable enablePixeloramaBridge to use Pixelorama bridge actions."
    );
  } else if (!executablePath) {
    warnings.push(
      "Pixelorama bridge is enabled, but pixeloramaExecutablePath is not configured."
    );
  } else if (!executableFound) {
    warnings.push(`Pixelorama executable was not found: ${config.pixeloramaExecutablePath}`);
  }

  return {
    enabled: config.enablePixeloramaBridge,
    executableConfigured: Boolean(config.pixeloramaExecutablePath),
    executableFound,
    executablePath,
    warnings
  };
}

export function getPixeloramaWorkspacePaths(category: string, projectName: string) {
  const workspaceDir = path.join(getPixeloramaWorkspaceRoot(), category, projectName);
  return {
    workspaceDir,
    projectFilePath: path.join(workspaceDir, `${projectName}.pxo`),
    stagedSpritePath: path.join(workspaceDir, `${projectName}.png`),
    exportDir: path.join(workspaceDir, "exports"),
    metadataPath: path.join(workspaceDir, "bridge-metadata.json")
  };
}

export async function writePixeloramaProjectFile(
  projectFilePath: string,
  metadata: PixeloramaWorkspaceMetadata
): Promise<"template" | "generated"> {
  const config = await loadConfig();
  const templatePath = config.pixeloramaProjectTemplatePath
    ? resolveProjectPath(config.pixeloramaProjectTemplatePath)
    : null;

  if (templatePath && (await pathExists(templatePath))) {
    await copyFile(templatePath, projectFilePath);
    return "template";
  }

  const projectDocument = {
    format: "pixel-forge-bridge",
    note: "Placeholder Pixelorama bridge project file for MVP 0.2.",
    metadata
  };

  await writeFile(projectFilePath, `${JSON.stringify(projectDocument, null, 2)}\n`, "utf8");
  return "generated";
}

export async function readPixeloramaWorkspaceMetadata(
  projectPath: string
): Promise<PixeloramaWorkspaceMetadata> {
  const projectFilePath = resolveProjectPath(projectPath);
  const metadataPath = path.join(path.dirname(projectFilePath), "bridge-metadata.json");

  if (!(await pathExists(metadataPath))) {
    throw new Error(
      `Pixelorama bridge metadata not found for project: ${projectPath}`
    );
  }

  const raw = await readFile(metadataPath, "utf8");
  return JSON.parse(raw) as PixeloramaWorkspaceMetadata;
}

export async function stagePixeloramaWorkspaceSprite(
  sourcePath: string,
  stagedSpritePath: string
): Promise<void> {
  await ensureParentDirectory(stagedSpritePath);
  await copyFile(sourcePath, stagedSpritePath);
}

export async function ensurePixeloramaWorkspaceDirs(paths: {
  workspaceDir: string;
  exportDir: string;
}): Promise<void> {
  await ensureDirectory(paths.workspaceDir);
  await ensureDirectory(paths.exportDir);
}
