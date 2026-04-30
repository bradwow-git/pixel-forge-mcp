import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { loadPalettes } from "../lib/config.js";
import { createMonsterPackInputSchema } from "../lib/monsterSpec.js";
import {
  ensureParentDirectory,
  pathExists,
  resolveProjectPath
} from "../lib/paths.js";
import { createMonsterPack } from "./createMonsterPack.js";

const familyTierSchema = z.object({
  tier: z.number().int().positive(),
  id: z.string().min(1),
  name: z.string().min(1),
  palette: z.string().min(1)
});

export const createFamilyTierLadderInputSchema = {
  family: z.string().min(1),
  category: z.string().min(1),
  packName: z.string().min(1),
  sourcePath: z.string().min(1),
  manifestPath: z.string().min(1),
  tiers: z.array(familyTierSchema).min(1),
  size: z.number().int().min(1),
  runMonsterPack: z.boolean().optional()
};

type CreateFamilyTierLadderInput = z.infer<
  z.ZodObject<typeof createFamilyTierLadderInputSchema>
>;

function validateUniqueIdsAndTiers(tiers: Array<z.infer<typeof familyTierSchema>>) {
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const tierEntry of tiers) {
    if (seenIds.has(tierEntry.id)) {
      duplicateIds.add(tierEntry.id);
    }
    seenIds.add(tierEntry.id);
  }

  if (duplicateIds.size > 0) {
    throw new Error(
      `Family tier ladder ids must be unique. Duplicates: ${Array.from(duplicateIds).join(", ")}`
    );
  }
}

export async function createFamilyTierLadder(input: CreateFamilyTierLadderInput) {
  validateUniqueIdsAndTiers(input.tiers);

  const palettes = await loadPalettes();
  const resolvedSourcePath = resolveProjectPath(input.sourcePath);
  if (!(await pathExists(resolvedSourcePath))) {
    throw new Error(`Family ladder source file not found: ${input.sourcePath}`);
  }

  for (const tierEntry of input.tiers) {
    if (!palettes[tierEntry.palette]) {
      throw new Error(`Palette "${tierEntry.palette}" was not found in config/palettes.json.`);
    }
  }

  const generatedSpec = z.object(createMonsterPackInputSchema).parse({
    packName: input.packName,
    category: input.category,
    family: input.family,
    manifestPath: input.manifestPath,
    monsters: input.tiers.map((tierEntry) => ({
      id: tierEntry.id,
      name: tierEntry.name,
      tier: tierEntry.tier,
      sourcePath: input.sourcePath,
      palette: tierEntry.palette,
      size: input.size
    }))
  });

  const outputPath = resolveProjectPath(
    `examples/specs/generated/${input.packName}.json`
  );
  await ensureParentDirectory(outputPath);
  await writeFile(outputPath, `${JSON.stringify(generatedSpec, null, 2)}\n`, "utf8");

  const result: {
    outputPath: string;
    packName: string;
    family: string;
    category: string;
    monsterCount: number;
    generatedSpec: typeof generatedSpec;
    monsterPackResult?: Awaited<ReturnType<typeof createMonsterPack>>;
  } = {
    outputPath,
    packName: input.packName,
    family: input.family,
    category: input.category,
    monsterCount: generatedSpec.monsters.length,
    generatedSpec
  };

  if (input.runMonsterPack) {
    result.monsterPackResult = await createMonsterPack(generatedSpec);
  }

  return result;
}
