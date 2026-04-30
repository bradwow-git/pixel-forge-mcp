import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  ensurePixeloramaWorkspaceDirs,
  getPixeloramaBridgeStatus,
  getPixeloramaWorkspacePaths,
  stagePixeloramaWorkspaceSprite,
  writePixeloramaProjectFile
} from "../lib/pixeloramaBridge.js";
import { pathExists, resolveProjectPath } from "../lib/paths.js";

export const createPixeloramaProjectInputSchema = {
  spritePath: z.string().min(1),
  projectName: z.string().min(1),
  category: z.string().min(1),
  size: z.number().int().min(1).max(2048)
};

type CreatePixeloramaProjectInput = z.infer<
  z.ZodObject<typeof createPixeloramaProjectInputSchema>
>;

export async function createPixeloramaProject(input: CreatePixeloramaProjectInput) {
  const sourceSpritePath = resolveProjectPath(input.spritePath);

  if (!(await pathExists(sourceSpritePath))) {
    throw new Error(`Source sprite not found: ${input.spritePath}`);
  }

  const workspacePaths = getPixeloramaWorkspacePaths(input.category, input.projectName);
  await ensurePixeloramaWorkspaceDirs(workspacePaths);
  await stagePixeloramaWorkspaceSprite(sourceSpritePath, workspacePaths.stagedSpritePath);

  const metadata = {
    projectName: input.projectName,
    category: input.category,
    size: input.size,
    sourceSpritePath: input.spritePath,
    stagedSpritePath: workspacePaths.stagedSpritePath,
    createdAt: new Date().toISOString()
  };

  const projectSource = await writePixeloramaProjectFile(
    workspacePaths.projectFilePath,
    metadata
  );
  await writeFile(
    workspacePaths.metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );

  const bridgeStatus = await getPixeloramaBridgeStatus();

  return {
    workspacePath: workspacePaths.workspaceDir,
    projectPath: workspacePaths.projectFilePath,
    stagedSpritePath: workspacePaths.stagedSpritePath,
    exportDir: workspacePaths.exportDir,
    projectSource,
    bridge: bridgeStatus
  };
}
