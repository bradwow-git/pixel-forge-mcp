import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { loadPalettes } from "../lib/config.js";
import { createMonsterPackInputSchema } from "../lib/monsterSpec.js";
import {
  ensureParentDirectory,
  pathExists,
  resolveProjectPath
} from "../lib/paths.js";
import { createMonsterPack } from "./createMonsterPack.js";
import { buildSagaEnemyEntries } from "./createSagaEnemyData.js";

const worldFamilyTierSchema = z.object({
  tier: z.number().int().positive(),
  id: z.string().min(1),
  name: z.string().min(1),
  palette: z.string().min(1)
});

const worldFamilySchema = z.object({
  family: z.string().min(1),
  sourcePath: z.string().min(1),
  tiers: z.array(worldFamilyTierSchema).min(1)
});

export const createWorldMonsterPackInputSchema = {
  worldId: z.string().min(1),
  worldName: z.string().min(1),
  category: z.string().min(1),
  families: z.array(worldFamilySchema).min(1),
  size: z.number().int().min(1),
  manifestPath: z.string().min(1),
  runMonsterPack: z.boolean().optional(),
  runSagaEnemyExport: z.boolean().optional()
};

type CreateWorldMonsterPackInput = z.infer<
  z.ZodObject<typeof createWorldMonsterPackInputSchema>
>;

export async function createWorldMonsterPack(input: CreateWorldMonsterPackInput) {
  const palettes = await loadPalettes();
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const familySpec of input.families) {
    const resolvedSourcePath = resolveProjectPath(familySpec.sourcePath);
    if (!(await pathExists(resolvedSourcePath))) {
      throw new Error(`World family source file not found: ${familySpec.sourcePath}`);
    }

    for (const tierEntry of familySpec.tiers) {
      if (seenIds.has(tierEntry.id)) {
        duplicateIds.add(tierEntry.id);
      }
      seenIds.add(tierEntry.id);

      if (!palettes[tierEntry.palette]) {
        throw new Error(`Palette "${tierEntry.palette}" was not found in config/palettes.json.`);
      }
    }
  }

  if (duplicateIds.size > 0) {
    throw new Error(
      `World monster ids must be unique across families. Duplicates: ${Array.from(duplicateIds).join(", ")}`
    );
  }

  const familySpecs = input.families.map((familySpec) => ({
    family: familySpec.family,
    monsters: familySpec.tiers.map((tierEntry) => ({
      id: tierEntry.id,
      name: tierEntry.name,
      family: familySpec.family,
      tier: tierEntry.tier,
      sourcePath: familySpec.sourcePath,
      palette: tierEntry.palette,
      size: input.size
    }))
  }));

  const combinedSpec = z.object(createMonsterPackInputSchema).parse({
    packName: `${input.worldId}_monsters`,
    category: input.category,
    family: `${input.worldId}_mixed`,
    manifestPath: input.manifestPath,
    monsters: familySpecs.flatMap((familySpec) => familySpec.monsters)
  });

  const specOutputPath = resolveProjectPath(
    `examples/specs/generated/worlds/${input.worldId}_monsters.json`
  );
  await ensureParentDirectory(specOutputPath);
  await writeFile(specOutputPath, `${JSON.stringify(combinedSpec, null, 2)}\n`, "utf8");

  let monsterPackResult: Awaited<ReturnType<typeof createMonsterPack>> | undefined;
  if (input.runMonsterPack) {
    monsterPackResult = await createMonsterPack(combinedSpec);
  }

  let sagaOutputPath: string | undefined;
  let sagaEnemyResult:
    | {
        outputPath: string;
        count: number;
        enemies: Awaited<ReturnType<typeof buildSagaEnemyEntries>>;
      }
    | undefined;

  if (input.runSagaEnemyExport) {
    const enemies = await buildSagaEnemyEntries(combinedSpec, input.manifestPath);
    sagaOutputPath = resolveProjectPath(`examples/saga/worlds/${input.worldId}_enemies.json`);
    await ensureParentDirectory(sagaOutputPath);
    await writeFile(sagaOutputPath, `${JSON.stringify({ enemies }, null, 2)}\n`, "utf8");
    sagaEnemyResult = {
      outputPath: sagaOutputPath,
      count: enemies.length,
      enemies
    };
  }

  return {
    worldId: input.worldId,
    worldName: input.worldName,
    category: input.category,
    familyCount: input.families.length,
    monsterCount: combinedSpec.monsters.length,
    familySpecs,
    combinedSpec,
    specOutputPath,
    monsterPackResult,
    sagaOutputPath,
    sagaEnemyResult
  };
}
