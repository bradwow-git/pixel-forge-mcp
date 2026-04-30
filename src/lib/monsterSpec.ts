import { z } from "zod";

export const monsterStatsOverrideSchema = z
  .object({
    hp: z.number().int().positive().optional(),
    attack: z.number().int().nonnegative().optional(),
    defense: z.number().int().nonnegative().optional(),
    speed: z.number().int().nonnegative().optional(),
    xp: z.number().int().nonnegative().optional(),
    credits: z.number().int().nonnegative().optional()
  })
  .strict();

export const monsterSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string().min(1).optional(),
  tier: z.number().int().positive(),
  sourcePath: z.string().min(1),
  palette: z.string().min(1),
  size: z.number().int().min(1),
  stats: monsterStatsOverrideSchema.optional(),
  abilities: z.array(z.string().min(1)).optional(),
  drops: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional()
});

export const createMonsterPackInputSchema = {
  packName: z.string().min(1),
  category: z.string().min(1),
  family: z.string().min(1),
  monsters: z.array(monsterSpecSchema).min(1),
  manifestPath: z.string().min(1)
};

export type MonsterStatsOverride = z.infer<typeof monsterStatsOverrideSchema>;
export type MonsterSpec = z.infer<typeof monsterSpecSchema>;
export type CreateMonsterPackInput = z.infer<
  z.ZodObject<typeof createMonsterPackInputSchema>
>;
