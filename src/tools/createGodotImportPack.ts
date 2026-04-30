import { copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getGodotProjectRoot } from "../lib/config.js";
import { readManifestEntries } from "../lib/manifest.js";
import {
  ensureDirectory,
  ensureParentDirectory,
  pathExists,
  resolveProjectPath
} from "../lib/paths.js";

export const createGodotImportPackInputSchema = {
  manifestPath: z.string().min(1),
  outputDir: z.string().min(1)
};

type CreateGodotImportPackInput = z.infer<
  z.ZodObject<typeof createGodotImportPackInputSchema>
>;

type SpriteManifestEntry = {
  id: string;
  name?: string;
  category?: string;
  family?: string;
  tier?: number;
  spritePath?: string;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  fps?: number;
  loop?: boolean;
  animation?: string;
};

function getImportReadme(): string {
  return `# Godot Import Pack

This folder is a portable export pack created by \`pixel-forge-mcp\`.

## Import steps

1. Copy the \`content/\` folder into your Godot project.
2. The expected destination inside Godot is \`res://content/\`.
3. Imported sprite metadata is stored in \`content/sprite_manifest.json\`.

## Animation metadata

Animation entries may include:

- \`frameWidth\`
- \`frameHeight\`
- \`frameCount\`
- \`fps\`
- \`loop\`
- \`animation\`

These fields are intended to map cleanly into future \`AnimatedSprite2D\` or \`SpriteFrames\` setup in Godot.
`;
}

async function resolveLocalSpriteSource(spritePath: string): Promise<string> {
  if (spritePath.startsWith("res://")) {
    const godotProjectRoot = await getGodotProjectRoot();
    const relativeSpritePath = spritePath.replace(/^res:\/\//, "").replace(/\//g, path.sep);
    return path.join(godotProjectRoot, relativeSpritePath);
  }

  return resolveProjectPath(spritePath);
}

export async function createGodotImportPack(input: CreateGodotImportPackInput) {
  const { entries } = await readManifestEntries<SpriteManifestEntry>(input.manifestPath);
  const outputDir = resolveProjectPath(input.outputDir);
  const contentDir = path.join(outputDir, "content");
  const artRootDir = path.join(contentDir, "art");
  const manifestOutputPath = path.join(contentDir, "sprite_manifest.json");
  const readmeOutputPath = path.join(outputDir, "README_IMPORT.md");

  await ensureDirectory(artRootDir);

  const exportedEntries: SpriteManifestEntry[] = [];

  for (const entry of entries) {
    if (!entry.id) {
      throw new Error("Manifest entry is missing required field: id");
    }

    if (!entry.category) {
      throw new Error(`Manifest entry "${entry.id}" is missing required field: category`);
    }

    if (!entry.spritePath) {
      throw new Error(`Manifest entry "${entry.id}" is missing required field: spritePath`);
    }

    const sourceSpritePath = await resolveLocalSpriteSource(entry.spritePath);

    if (!(await pathExists(sourceSpritePath))) {
      throw new Error(
        `Referenced sprite file not found for manifest entry "${entry.id}": ${entry.spritePath}`
      );
    }

    const fileName = path.basename(entry.spritePath);
    const destinationDir = path.join(artRootDir, entry.category);
    const destinationPath = path.join(destinationDir, fileName);
    const nextSpritePath = `res://content/art/${entry.category}/${fileName}`;

    await ensureDirectory(destinationDir);
    await copyFile(sourceSpritePath, destinationPath);

    exportedEntries.push({
      ...entry,
      spritePath: nextSpritePath
    });
  }

  await ensureParentDirectory(manifestOutputPath);
  await writeFile(
    manifestOutputPath,
    `${JSON.stringify({ sprites: exportedEntries }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(readmeOutputPath, getImportReadme(), "utf8");

  return {
    outputDir,
    spriteCount: exportedEntries.length,
    manifestOutputPath,
    readmeOutputPath,
    copiedSpritesRoot: artRootDir
  };
}
