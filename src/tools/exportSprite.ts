import { copyFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getGodotProjectRoot } from "../lib/config.js";
import {
  ensureDirectory,
  pathExists,
  resolveProjectPath
} from "../lib/paths.js";

export const exportSpriteInputSchema = {
  sourcePath: z.string().min(1),
  godotOutputDir: z.string().min(1),
  fileName: z.string().min(1)
};

type ExportSpriteInput = z.infer<z.ZodObject<typeof exportSpriteInputSchema>>;

export async function exportSprite(input: ExportSpriteInput) {
  const sourcePath = resolveProjectPath(input.sourcePath);

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Source image not found: ${input.sourcePath}`);
  }

  if (!input.godotOutputDir.startsWith("res://")) {
    throw new Error('godotOutputDir must start with "res://".');
  }

  const godotRoot = await getGodotProjectRoot();
  const relativeGodotDir = input.godotOutputDir.replace(/^res:\/\//, "");
  const localOutputDir = path.join(godotRoot, relativeGodotDir);
  const localOutputPath = path.join(localOutputDir, input.fileName);
  const godotResourcePath = `res://${path.posix.join(
    relativeGodotDir.replace(/\\/g, "/"),
    input.fileName
  )}`;

  await ensureDirectory(localOutputDir);
  await copyFile(sourcePath, localOutputPath);

  return {
    sourcePath: input.sourcePath,
    exportedPath: localOutputPath,
    spritePath: godotResourcePath
  };
}
