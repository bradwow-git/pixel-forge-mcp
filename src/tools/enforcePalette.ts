import path from "node:path";
import { z } from "zod";
import { loadPalettes } from "../lib/config.js";
import { pathExists, resolveProjectPath } from "../lib/paths.js";
import { runPythonPipeline } from "../lib/processRunner.js";

export const enforcePaletteInputSchema = {
  sourcePath: z.string().min(1),
  palette: z.string().min(1)
};

type EnforcePaletteInput = z.infer<z.ZodObject<typeof enforcePaletteInputSchema>>;

export async function enforcePalette(input: EnforcePaletteInput) {
  const sourcePath = resolveProjectPath(input.sourcePath);
  const palettes = await loadPalettes();
  const paletteColors = palettes[input.palette];

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Source image not found: ${input.sourcePath}`);
  }

  if (!paletteColors) {
    throw new Error(
      `Palette "${input.palette}" was not found in config/palettes.json.`
    );
  }

  await runPythonPipeline("palette.py", [
    "--input",
    sourcePath,
    "--output",
    sourcePath,
    "--palette-name",
    input.palette,
    "--palette-colors",
    JSON.stringify(paletteColors)
  ]);

  return {
    sourcePath: input.sourcePath,
    palette: input.palette,
    colors: paletteColors,
    outputPath: sourcePath,
    outputFileName: path.basename(sourcePath)
  };
}
