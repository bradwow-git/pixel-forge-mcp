import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getProjectRoot, resolveProjectPath } from "./paths.js";

const spriteForgeConfigSchema = z.object({
  outputRoot: z.string().min(1),
  manifestCollectionKey: z.string().min(1),
  godotProjectRoot: z.string().min(1),
  pythonCommand: z.string().min(1),
  pythonVenvPath: z.string().min(1).default(".venv"),
  defaultImageProvider: z.enum(["placeholder", "openai", "comfyui"]).default("placeholder"),
  generatedSourceDir: z.string().min(1).default("examples/source/generated"),
  comfyuiBaseUrl: z.string().min(1).default("http://127.0.0.1:8188"),
  comfyuiWorkflowPath: z.string().min(1).default("config/comfyui/text_to_image_workflow.json"),
  comfyuiOutputDir: z.string().min(1).default("ComfyUI/output"),
  comfyuiTimeoutMs: z.number().int().positive().default(120000),
  enablePixeloramaBridge: z.boolean().default(false),
  pixeloramaExecutablePath: z.string().min(1).nullable().optional(),
  pixeloramaProjectTemplatePath: z.string().min(1).nullable().optional()
});

const palettesSchema = z.record(z.array(z.string().regex(/^#?[0-9a-fA-F]{6}$/)).min(1));

export type SpriteForgeConfig = z.infer<typeof spriteForgeConfigSchema>;
export type PaletteMap = z.infer<typeof palettesSchema>;

let cachedConfig: SpriteForgeConfig | null = null;
let cachedPalettes: PaletteMap | null = null;

export async function loadConfig(): Promise<SpriteForgeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(getProjectRoot(), "config", "sprite-forge.config.json");
  const raw = await readFile(configPath, "utf8");
  cachedConfig = spriteForgeConfigSchema.parse(JSON.parse(raw));
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
  cachedPalettes = null;
}

export async function loadPalettes(): Promise<PaletteMap> {
  if (cachedPalettes) {
    return cachedPalettes;
  }

  const palettesPath = path.join(getProjectRoot(), "config", "palettes.json");
  const raw = await readFile(palettesPath, "utf8");
  cachedPalettes = palettesSchema.parse(JSON.parse(raw));
  return cachedPalettes;
}

export async function getOutputRoot(): Promise<string> {
  const config = await loadConfig();
  return resolveProjectPath(config.outputRoot);
}

export async function getGodotProjectRoot(): Promise<string> {
  const config = await loadConfig();
  return resolveProjectPath(config.godotProjectRoot);
}

export async function getGeneratedSourceDir(): Promise<string> {
  const config = await loadConfig();
  return resolveProjectPath(config.generatedSourceDir);
}

export async function getPixeloramaTemplatePath(): Promise<string | null> {
  const config = await loadConfig();
  return config.pixeloramaProjectTemplatePath
    ? resolveProjectPath(config.pixeloramaProjectTemplatePath)
    : null;
}
