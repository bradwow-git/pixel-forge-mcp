import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { readManifestEntries } from "../lib/manifest.js";
import {
  createMonsterPackInputSchema,
  MonsterSpec
} from "../lib/monsterSpec.js";
import { ensureParentDirectory, resolveProjectPath } from "../lib/paths.js";

export const createSagaEnemyDataInputSchema = {
  monsterSpecPath: z.string().min(1),
  spriteManifestPath: z.string().min(1),
  outputPath: z.string().min(1)
};

type CreateSagaEnemyDataInput = z.infer<
  z.ZodObject<typeof createSagaEnemyDataInputSchema>
>;

type SpriteManifestEntry = {
  id: string;
  spritePath?: string;
};

type SagaEnemyStats = {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  credits: number;
};

type SagaEnemyEntry = {
  id: string;
  name: string;
  family: string;
  tier: number;
  spriteId: string;
  spritePath: string;
  stats: SagaEnemyStats;
  abilities: string[];
  drops: string[];
  tags: string[];
};

function buildDefaultStats(tier: number): SagaEnemyStats {
  return {
    hp: 20 + tier * 10,
    attack: 4 + tier * 2,
    defense: 2 + tier,
    speed: 3 + tier,
    xp: 5 + tier * 3,
    credits: 2 + tier * 2
  };
}

export async function buildSagaEnemyEntries(
  parsedSpec: z.infer<z.ZodObject<typeof createMonsterPackInputSchema>>,
  spriteManifestPath: string
) {
  const { entries: spriteEntries } = await readManifestEntries<SpriteManifestEntry>(
    spriteManifestPath
  );
  const spriteEntriesById = new Map(spriteEntries.map((entry) => [entry.id, entry]));

  const enemies: SagaEnemyEntry[] = [];

  for (const monster of parsedSpec.monsters as MonsterSpec[]) {
    if (monster.tier <= 0) {
      throw new Error(`Monster "${monster.id}" must have a positive tier.`);
    }

    const family = monster.family ?? parsedSpec.family;
    if (!family) {
      throw new Error(`Monster "${monster.id}" is missing family information.`);
    }

    const spriteEntry = spriteEntriesById.get(monster.id);
    if (!spriteEntry) {
      throw new Error(`Monster "${monster.id}" was not found in the sprite manifest.`);
    }

    if (!spriteEntry.spritePath) {
      throw new Error(`Sprite manifest entry "${monster.id}" is missing spritePath.`);
    }

    const stats: SagaEnemyStats = {
      ...buildDefaultStats(monster.tier),
      ...(monster.stats ?? {})
    };

    enemies.push({
      id: monster.id,
      name: monster.name,
      family,
      tier: monster.tier,
      spriteId: monster.id,
      spritePath: spriteEntry.spritePath,
      stats,
      abilities: monster.abilities ?? [],
      drops: monster.drops ?? [],
      tags: monster.tags ?? []
    });
  }

  return enemies;
}

export async function createSagaEnemyData(input: CreateSagaEnemyDataInput) {
  const specDocument = JSON.parse(
    await (await import("node:fs/promises")).readFile(resolveProjectPath(input.monsterSpecPath), "utf8")
  );
  const parsedSpec = z.object(createMonsterPackInputSchema).parse(specDocument);
  const enemies = await buildSagaEnemyEntries(parsedSpec, input.spriteManifestPath);

  const outputPath = resolveProjectPath(input.outputPath);
  await ensureParentDirectory(outputPath);
  await writeFile(outputPath, `${JSON.stringify({ enemies }, null, 2)}\n`, "utf8");

  return {
    outputPath,
    count: enemies.length,
    enemies
  };
}
