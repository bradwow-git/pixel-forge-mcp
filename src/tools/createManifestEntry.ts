import { z } from "zod";
import { upsertManifestEntry } from "../lib/manifest.js";

export const createManifestEntryInputSchema = {
  manifestPath: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  family: z.string().min(1),
  tier: z.number().int(),
  spritePath: z.string().min(1)
};

type CreateManifestEntryInput = z.infer<
  z.ZodObject<typeof createManifestEntryInputSchema>
>;

type ManifestEntry = {
  id: string;
  name: string;
  category: string;
  family: string;
  tier: number;
  spritePath: string;
};

export async function createManifestEntry(input: CreateManifestEntryInput) {
  const nextEntry: ManifestEntry = {
    id: input.id,
    name: input.name,
    category: input.category,
    family: input.family,
    tier: input.tier,
    spritePath: input.spritePath
  };

  return upsertManifestEntry(input.manifestPath, nextEntry);
}
