import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  getPixeloramaBridgeStatus,
  readPixeloramaWorkspaceMetadata
} from "../lib/pixeloramaBridge.js";
import { runLocalCommand } from "../lib/processRunner.js";
import {
  ensureParentDirectory,
  getProjectRoot,
  pathExists,
  resolveProjectPath
} from "../lib/paths.js";

export const exportFromPixeloramaInputSchema = {
  projectPath: z.string().min(1),
  outputPath: z.string().min(1)
};

type ExportFromPixeloramaInput = z.infer<
  z.ZodObject<typeof exportFromPixeloramaInputSchema>
>;

async function isGeneratedBridgeProject(projectFilePath: string): Promise<boolean> {
  try {
    const raw = await readFile(projectFilePath, "utf8");
    const parsed = JSON.parse(raw) as { format?: string };
    return parsed.format === "pixel-forge-bridge";
  } catch {
    return false;
  }
}

async function attemptPixeloramaCliExport(
  executablePath: string,
  sourcePath: string,
  outputFilePath: string
): Promise<{ exported: boolean; warning?: string }> {
  const relativeSourcePath = path.relative(getProjectRoot(), sourcePath) || sourcePath;
  const relativeOutputPath = path.relative(getProjectRoot(), outputFilePath) || outputFilePath;

  try {
    await runLocalCommand(
      executablePath,
      [
        "--headless",
        "--quit",
        "--",
        "--export",
        "--output",
        relativeOutputPath,
        relativeSourcePath
      ],
      {
        cwd: getProjectRoot(),
        timeoutMs: 15000
      }
    );

    if (await pathExists(outputFilePath)) {
      return { exported: true };
    }

    return {
      exported: false,
      warning:
        "Pixelorama CLI completed without producing the requested export file."
    };
  } catch (error) {
    return {
      exported: false,
      warning: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function exportFromPixelorama(input: ExportFromPixeloramaInput) {
  const projectFilePath = resolveProjectPath(input.projectPath);
  const outputFilePath = resolveProjectPath(input.outputPath);

  if (!(await pathExists(projectFilePath))) {
    throw new Error(`Pixelorama project not found: ${input.projectPath}`);
  }

  const bridgeStatus = await getPixeloramaBridgeStatus();

  if (!bridgeStatus.enabled || !bridgeStatus.executableConfigured || !bridgeStatus.executableFound) {
    return {
      exported: false,
      outputPath: outputFilePath,
      method: "none" as const,
      bridge: bridgeStatus
    };
  }

  const metadata = await readPixeloramaWorkspaceMetadata(input.projectPath);
  const stagedSpritePath = resolveProjectPath(metadata.stagedSpritePath);
  const bridgeWarnings = [...bridgeStatus.warnings];

  if (!(await pathExists(stagedSpritePath))) {
    throw new Error(`Staged Pixelorama sprite not found: ${metadata.stagedSpritePath}`);
  }

  const projectIsPlaceholder = await isGeneratedBridgeProject(projectFilePath);

  if (projectIsPlaceholder) {
    bridgeWarnings.push(
      "The workspace project is a Pixel Forge placeholder file, so CLI export is using the staged source image instead of the .pxo project."
    );
  }

  const cliSourcePath = projectIsPlaceholder ? stagedSpritePath : projectFilePath;
  const cliAttempt = await attemptPixeloramaCliExport(
    bridgeStatus.executablePath as string,
    cliSourcePath,
    outputFilePath
  );

  if (cliAttempt.exported) {
    return {
      exported: true,
      outputPath: outputFilePath,
      sourceSpritePath: metadata.stagedSpritePath,
      method: "pixelorama-cli" as const,
      bridge: {
        ...bridgeStatus,
        warnings: bridgeWarnings
      }
    };
  }

  bridgeWarnings.push(
    `Pixelorama CLI export did not complete successfully${
      cliAttempt.warning ? `: ${cliAttempt.warning}` : "."
    }`
  );
  bridgeWarnings.push(
    "Falling back to a direct copy of the staged bridge sprite. This preserves a safe local export, but it is not a true Pixelorama-rendered export."
  );

  await ensureParentDirectory(outputFilePath);
  await copyFile(stagedSpritePath, outputFilePath);

  return {
    exported: true,
    outputPath: outputFilePath,
    sourceSpritePath: metadata.stagedSpritePath,
    method: "fallback-copy" as const,
    bridge: {
      ...bridgeStatus,
      warnings: bridgeWarnings
    }
  };
}
