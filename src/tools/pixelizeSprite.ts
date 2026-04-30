import path from "node:path";
import { z } from "zod";
import { getOutputRoot } from "../lib/config.js";
import {
  ensureParentDirectory,
  pathExists,
  resolveProjectPath
} from "../lib/paths.js";
import { runPythonPipeline } from "../lib/processRunner.js";

export const pixelizeSpriteInputSchema = {
  sourcePath: z.string().min(1),
  outputName: z.string().min(1),
  size: z.number().int().min(1).max(2048),
  category: z.string().min(1)
};

type PixelizeSpriteInput = z.infer<z.ZodObject<typeof pixelizeSpriteInputSchema>>;

export async function pixelizeSprite(input: PixelizeSpriteInput) {
  const sourcePath = resolveProjectPath(input.sourcePath);
  const outputRoot = await getOutputRoot();
  const outputPath = path.join(outputRoot, input.category, `${input.outputName}.png`);

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Source image not found: ${input.sourcePath}`);
  }

  await ensureParentDirectory(outputPath);

  await runPythonPipeline("pixelize.py", [
    "--input",
    sourcePath,
    "--output",
    outputPath,
    "--size",
    String(input.size)
  ]);

  return {
    sourcePath: input.sourcePath,
    outputPath,
    relativeOutputPath: path.relative(resolveProjectPath("."), outputPath),
    category: input.category,
    size: input.size
  };
}
