import { copyFile } from "node:fs/promises";
import { z } from "zod";
import {
  getPixeloramaBridgeStatus,
  readPixeloramaWorkspaceMetadata
} from "../lib/pixeloramaBridge.js";
import {
  ensureParentDirectory,
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
      bridge: bridgeStatus
    };
  }

  const metadata = await readPixeloramaWorkspaceMetadata(input.projectPath);
  const stagedSpritePath = resolveProjectPath(metadata.stagedSpritePath);

  if (!(await pathExists(stagedSpritePath))) {
    throw new Error(`Staged Pixelorama sprite not found: ${metadata.stagedSpritePath}`);
  }

  await ensureParentDirectory(outputFilePath);
  await copyFile(stagedSpritePath, outputFilePath);

  return {
    exported: true,
    outputPath: outputFilePath,
    sourceSpritePath: metadata.stagedSpritePath,
    bridge: {
      ...bridgeStatus,
      warnings: [
        ...bridgeStatus.warnings,
        "Pixelorama CLI automation is not implemented in MVP 0.2, so the staged bridge sprite was copied to the requested output path."
      ]
    }
  };
}
