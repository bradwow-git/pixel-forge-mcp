import path from "node:path";
import { z } from "zod";
import {
  getGeneratedSourceDir,
  loadConfig,
  loadPalettes
} from "../lib/config.js";
import { ensureDirectory, pathExists, resolveProjectPath } from "../lib/paths.js";
import { runPythonPipeline } from "../lib/processRunner.js";
import {
  createDefaultComfyUiSeed,
  generateWithComfyUi
} from "../providers/comfyuiProvider.js";
import { createManifestEntry } from "./createManifestEntry.js";
import { enforcePalette } from "./enforcePalette.js";
import { exportSprite } from "./exportSprite.js";
import { pixelizeSprite } from "./pixelizeSprite.js";

const imageProviderSchema = z.enum(["placeholder", "openai", "comfyui"]);

export const generateSpriteFromPromptInputSchema = {
  id: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().min(1),
  category: z.string().min(1),
  family: z.string().min(1),
  tier: z.number().int().positive(),
  palette: z.string().min(1),
  size: z.number().int().min(1).max(2048),
  provider: imageProviderSchema.optional(),
  negativePrompt: z.string().default("blurry, noisy, text, watermark"),
  seed: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().default(512),
  height: z.number().int().positive().default(512),
  allowProviderFallback: z.boolean().default(false),
  manifestPath: z.string().min(1)
};

type GenerateSpriteFromPromptInput = z.infer<
  z.ZodObject<typeof generateSpriteFromPromptInputSchema>
>;

type ProviderResult = {
  provider: z.infer<typeof imageProviderSchema>;
  sourcePath: string;
  outputPath: string;
  message: string;
  fallbackUsed?: boolean;
  requestedProvider?: z.infer<typeof imageProviderSchema>;
  promptId?: string;
};

async function generatePlaceholderSource(
  input: GenerateSpriteFromPromptInput,
  paletteColors: string[]
): Promise<ProviderResult> {
  const generatedSourceDir = await getGeneratedSourceDir();
  const outputPath = path.join(generatedSourceDir, `${input.id}.png`);

  await ensureDirectory(generatedSourceDir);
  await runPythonPipeline("generate_placeholder_sprite.py", [
    "--output",
    outputPath,
    "--prompt",
    input.prompt,
    "--id",
    input.id,
    "--name",
    input.name,
    "--size",
    String(input.size),
    "--palette-colors",
    JSON.stringify(paletteColors)
  ]);

  return {
    provider: "placeholder",
    sourcePath: path.relative(resolveProjectPath("."), outputPath),
    outputPath,
    message: "Generated placeholder sprite source image locally with Pillow."
  };
}

function getProviderStubMessage(provider: "openai" | "comfyui"): string {
  if (provider === "openai") {
    return "OpenAI provider not implemented yet";
  }

  return "ComfyUI provider not implemented yet";
}

function createFallbackMessage(
  requestedProvider: "openai" | "comfyui",
  reason: string
): string {
  return `Provider "${requestedProvider}" could not be used. Falling back to the placeholder provider. ${reason}`;
}

function createDefaultSeedFromPrompt(input: GenerateSpriteFromPromptInput): number {
  if (typeof input.seed === "number") {
    return input.seed;
  }

  return createDefaultComfyUiSeed();
}

async function createSourceImage(
  input: GenerateSpriteFromPromptInput,
  paletteColors: string[],
  resolvedSeed: number
): Promise<ProviderResult> {
  const config = await loadConfig();
  const provider = input.provider ?? config.defaultImageProvider;

  if (provider === "placeholder") {
    return generatePlaceholderSource(input, paletteColors);
  }

  if (provider === "openai") {
    const message = getProviderStubMessage("openai");
    if (!input.allowProviderFallback) {
      throw new Error(message);
    }

    const fallback = await generatePlaceholderSource(input, paletteColors);
    return {
      ...fallback,
      fallbackUsed: true,
      requestedProvider: "openai",
      message: createFallbackMessage("openai", message)
    };
  }

  try {
    const comfyResult = await generateWithComfyUi({
      id: input.id,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      seed: resolvedSeed,
      width: input.width,
      height: input.height
    });

    return {
      provider: "comfyui",
      sourcePath: comfyResult.sourcePath,
      outputPath: comfyResult.outputPath,
      promptId: comfyResult.promptId,
      message: `Generated source image with ComfyUI from ${comfyResult.baseUrl}.`
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!input.allowProviderFallback) {
      throw new Error(reason);
    }

    const fallback = await generatePlaceholderSource(input, paletteColors);
    return {
      ...fallback,
      fallbackUsed: true,
      requestedProvider: "comfyui",
      message: createFallbackMessage("comfyui", reason)
    };
  }
}

export async function generateSpriteFromPrompt(
  input: GenerateSpriteFromPromptInput
) {
  const config = await loadConfig();
  const provider = input.provider ?? config.defaultImageProvider;
  const palettes = await loadPalettes();
  const paletteColors = palettes[input.palette];
  const resolvedSeed = createDefaultSeedFromPrompt(input);

  if (!paletteColors) {
    throw new Error(
      `Palette "${input.palette}" was not found in config/palettes.json.`
    );
  }

  const providerResult = await createSourceImage(input, paletteColors, resolvedSeed);
  const pixelized = await pixelizeSprite({
    sourcePath: providerResult.sourcePath,
    outputName: input.id,
    size: input.size,
    category: input.category
  });

  const paletteResult = await enforcePalette({
    sourcePath: pixelized.relativeOutputPath,
    palette: input.palette
  });

  const exported = await exportSprite({
    sourcePath: pixelized.relativeOutputPath,
    godotOutputDir: `res://content/art/${input.category}`,
    fileName: `${input.id}.png`
  });

  const manifest = await createManifestEntry({
    manifestPath: input.manifestPath,
    id: input.id,
    name: input.name,
    category: input.category,
    family: input.family,
    tier: input.tier,
    spritePath: exported.spritePath
  });

  const generatedSourcePath = resolveProjectPath(providerResult.sourcePath);
  if (!(await pathExists(generatedSourcePath))) {
    throw new Error(
      `Generated source image was not created: ${providerResult.sourcePath}`
    );
  }

  return {
    id: input.id,
    name: input.name,
    provider,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    seed: resolvedSeed,
    width: input.width,
    height: input.height,
    allowProviderFallback: input.allowProviderFallback,
    source: providerResult,
    pixelized,
    paletteResult,
    exported,
    manifest
  };
}
