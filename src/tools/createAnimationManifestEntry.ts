import { z } from "zod";
import { upsertManifestEntry } from "../lib/manifest.js";

export const createAnimationManifestEntryInputSchema = {
  manifestPath: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  family: z.string().min(1),
  tier: z.number().int(),
  spritePath: z.string().min(1),
  frameWidth: z.number().int().min(1),
  frameHeight: z.number().int().min(1),
  frameCount: z.number().int().min(1),
  fps: z.number().positive(),
  loop: z.boolean(),
  animation: z.string().min(1),
  stripDirection: z.enum(["horizontal", "vertical"]).optional().default("horizontal")
};

type CreateAnimationManifestEntryInput = z.infer<
  z.ZodObject<typeof createAnimationManifestEntryInputSchema>
>;

type AnimationManifestEntry = {
  id: string;
  name: string;
  category: string;
  family: string;
  tier: number;
  spritePath: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  animation: string;
  stripDirection: "horizontal" | "vertical";
};

export async function createAnimationManifestEntry(
  input: CreateAnimationManifestEntryInput
) {
  const nextEntry: AnimationManifestEntry = {
    id: input.id,
    name: input.name,
    category: input.category,
    family: input.family,
    tier: input.tier,
    spritePath: input.spritePath,
    frameWidth: input.frameWidth,
    frameHeight: input.frameHeight,
    frameCount: input.frameCount,
    fps: input.fps,
    loop: input.loop,
    animation: input.animation,
    stripDirection: input.stripDirection ?? "horizontal"
  };

  return upsertManifestEntry(input.manifestPath, nextEntry);
}
