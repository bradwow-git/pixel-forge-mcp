import { z } from "zod";
import { ensureParentDirectory, pathExists, resolveProjectPath } from "../lib/paths.js";
import { runPythonPipeline } from "../lib/processRunner.js";

export const createAnimationStripInputSchema = {
  framePaths: z.array(z.string().min(1)).min(1),
  outputPath: z.string().min(1),
  frameWidth: z.number().int().min(1),
  frameHeight: z.number().int().min(1),
  direction: z.enum(["horizontal", "vertical"])
};

type CreateAnimationStripInput = z.infer<
  z.ZodObject<typeof createAnimationStripInputSchema>
>;

export async function createAnimationStrip(input: CreateAnimationStripInput) {
  const resolvedFramePaths = input.framePaths.map((framePath) => resolveProjectPath(framePath));
  const outputPath = resolveProjectPath(input.outputPath);

  for (let index = 0; index < resolvedFramePaths.length; index += 1) {
    if (!(await pathExists(resolvedFramePaths[index]!))) {
      throw new Error(`Animation frame not found: ${input.framePaths[index]}`);
    }
  }

  await ensureParentDirectory(outputPath);

  await runPythonPipeline("stitch_strip.py", [
    "--output",
    outputPath,
    "--frame-width",
    String(input.frameWidth),
    "--frame-height",
    String(input.frameHeight),
    "--direction",
    input.direction,
    "--frames",
    ...resolvedFramePaths
  ]);

  return {
    outputPath,
    frameCount: input.framePaths.length,
    frameWidth: input.frameWidth,
    frameHeight: input.frameHeight,
    direction: input.direction,
    framePaths: input.framePaths
  };
}
