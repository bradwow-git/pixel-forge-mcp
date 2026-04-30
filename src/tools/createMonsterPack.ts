import { z } from "zod";
import { loadPalettes } from "../lib/config.js";
import { readManifestEntries } from "../lib/manifest.js";
import {
  createMonsterPackInputSchema,
  MonsterSpec
} from "../lib/monsterSpec.js";
import { pathExists, resolveProjectPath } from "../lib/paths.js";
import { createManifestEntry } from "./createManifestEntry.js";
import { enforcePalette } from "./enforcePalette.js";
import { exportSprite } from "./exportSprite.js";
import { pixelizeSprite } from "./pixelizeSprite.js";

type CreateMonsterPackInput = z.infer<z.ZodObject<typeof createMonsterPackInputSchema>>;

function validateUniqueIds(monsters: MonsterSpec[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const monster of monsters) {
    if (seen.has(monster.id)) {
      duplicates.add(monster.id);
    }
    seen.add(monster.id);
  }

  if (duplicates.size > 0) {
    throw new Error(
      `Batch monster ids must be unique. Duplicates: ${Array.from(duplicates).join(", ")}`
    );
  }
}

export async function createMonsterPack(input: CreateMonsterPackInput) {
  validateUniqueIds(input.monsters);

  const palettes = await loadPalettes();
  const existingEntries = await readManifestEntries<{ id: string }>(input.manifestPath).catch(
    () => ({
      manifestPath: resolveProjectPath(input.manifestPath),
      entries: []
    })
  );
  const existingIds = new Set(existingEntries.entries.map((entry) => entry.id));

  const results: Array<{
    id: string;
    name: string;
    status: "created" | "updated" | "failed";
    error?: string;
    pixelized?: unknown;
    paletteResult?: unknown;
    exported?: unknown;
    manifest?: unknown;
  }> = [];

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const monster of input.monsters) {
    try {
      const resolvedSourcePath = resolveProjectPath(monster.sourcePath);
      if (!(await pathExists(resolvedSourcePath))) {
        throw new Error(`Monster source file not found: ${monster.sourcePath}`);
      }

      if (!palettes[monster.palette]) {
        throw new Error(`Palette "${monster.palette}" was not found in config/palettes.json.`);
      }

      const pixelized = await pixelizeSprite({
        sourcePath: monster.sourcePath,
        outputName: monster.id,
        size: monster.size,
        category: input.category
      });

      const paletteResult = await enforcePalette({
        sourcePath: pixelized.relativeOutputPath,
        palette: monster.palette
      });

      const exported = await exportSprite({
        sourcePath: pixelized.relativeOutputPath,
        godotOutputDir: `res://content/art/${input.category}`,
        fileName: `${monster.id}.png`
      });

      const manifest = await createManifestEntry({
        manifestPath: input.manifestPath,
        id: monster.id,
        name: monster.name,
        category: input.category,
        family: monster.family ?? input.family,
        tier: monster.tier,
        spritePath: exported.spritePath
      });

      const status = existingIds.has(monster.id) ? "updated" : "created";
      if (status === "created") {
        createdCount += 1;
        existingIds.add(monster.id);
      } else {
        updatedCount += 1;
      }

      results.push({
        id: monster.id,
        name: monster.name,
        status,
        pixelized,
        paletteResult,
        exported,
        manifest
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        id: monster.id,
        name: monster.name,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    packName: input.packName,
    category: input.category,
    family: input.family,
    createdCount,
    updatedCount,
    failedCount,
    results
  };
}
