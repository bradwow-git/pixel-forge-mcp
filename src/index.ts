import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createAnimationManifestEntry,
  createAnimationManifestEntryInputSchema
} from "./tools/createAnimationManifestEntry.js";
import {
  createAnimationStrip,
  createAnimationStripInputSchema
} from "./tools/createAnimationStrip.js";
import {
  createFamilyTierLadder,
  createFamilyTierLadderInputSchema
} from "./tools/createFamilyTierLadder.js";
import {
  createGodotImportPack,
  createGodotImportPackInputSchema
} from "./tools/createGodotImportPack.js";
import {
  createGodotMonsterScenes,
  createGodotMonsterScenesInputSchema
} from "./tools/createGodotMonsterScenes.js";
import {
  createGodotSpriteFrames,
  createGodotSpriteFramesInputSchema
} from "./tools/createGodotSpriteFrames.js";
import {
  createGodotEditorPlugin,
  createGodotEditorPluginInputSchema
} from "./tools/createGodotEditorPlugin.js";
import {
  createGodotLoaderStub,
  createGodotLoaderStubInputSchema
} from "./tools/createGodotLoaderStub.js";
import { createMonsterPackInputSchema } from "./lib/monsterSpec.js";
import { createMonsterPack } from "./tools/createMonsterPack.js";
import {
  createSagaEnemyData,
  createSagaEnemyDataInputSchema
} from "./tools/createSagaEnemyData.js";
import {
  createWorldMonsterPack,
  createWorldMonsterPackInputSchema
} from "./tools/createWorldMonsterPack.js";
import {
  createManifestEntry,
  createManifestEntryInputSchema
} from "./tools/createManifestEntry.js";
import {
  createPixeloramaProject,
  createPixeloramaProjectInputSchema
} from "./tools/createPixeloramaProject.js";
import {
  enforcePalette,
  enforcePaletteInputSchema
} from "./tools/enforcePalette.js";
import {
  exportFromPixelorama,
  exportFromPixeloramaInputSchema
} from "./tools/exportFromPixelorama.js";
import { exportSprite, exportSpriteInputSchema } from "./tools/exportSprite.js";
import {
  pixelizeSprite,
  pixelizeSpriteInputSchema
} from "./tools/pixelizeSprite.js";

const server = new McpServer(
  {
    name: "pixel-forge-mcp",
    version: "1.0.0-rc1"
  },
  {
    instructions:
      "This server runs a local-only sprite pipeline. Use pixelize_sprite first, then enforce_palette, then export_sprite, then create_manifest_entry when you need Godot metadata. Pixelorama bridge actions are optional and should not block the core pipeline when disabled or missing configuration."
  }
);

server.tool(
  "pixelize_sprite",
  "Resize a source image into a sprite-sized PNG in the configured local output area.",
  pixelizeSpriteInputSchema,
  async (input) => {
    const result = await pixelizeSprite(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "enforce_palette",
  "Map a PNG to a named palette from config/palettes.json using local Pillow processing.",
  enforcePaletteInputSchema,
  async (input) => {
    const result = await enforcePalette(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "export_sprite",
  "Copy a local sprite PNG into a Godot-friendly res:// destination resolved from project config.",
  exportSpriteInputSchema,
  async (input) => {
    const result = await exportSprite(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_manifest_entry",
  "Create or update a sprite manifest entry by id without duplicating existing records.",
  createManifestEntryInputSchema,
  async (input) => {
    const result = await createManifestEntry(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_animation_strip",
  "Stitch ordered sprite frames into a horizontal or vertical animation strip.",
  createAnimationStripInputSchema,
  async (input) => {
    const result = await createAnimationStrip(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_animation_manifest_entry",
  "Create or update a Godot-friendly animation manifest entry with frame metadata.",
  createAnimationManifestEntryInputSchema,
  async (input) => {
    const result = await createAnimationManifestEntry(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_godot_import_pack",
  "Create a portable Godot import pack from sprite manifest entries, including static and animation metadata.",
  createGodotImportPackInputSchema,
  async (input) => {
    const result = await createGodotImportPack(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_godot_loader_stub",
  "Generate a Godot 4-compatible helper script that loads sprite_manifest.json and exposes sprite metadata by id.",
  createGodotLoaderStubInputSchema,
  async (input) => {
    const result = await createGodotLoaderStub(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_godot_editor_plugin",
  "Generate a Godot 4 editor plugin dock for browsing Pixel Forge sprite manifests inside the editor.",
  createGodotEditorPluginInputSchema,
  async (input) => {
    const result = await createGodotEditorPlugin(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_godot_monster_scenes",
  "Generate Godot 4 monster scenes from sprite manifest entries, using Sprite2D for static sprites and AnimatedSprite2D for animation entries.",
  createGodotMonsterScenesInputSchema,
  async (input) => {
    const result = await createGodotMonsterScenes(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_godot_spriteframes",
  "Generate Godot 4 SpriteFrames resources from animation strip manifest entries for AnimatedSprite2D scenes.",
  createGodotSpriteFramesInputSchema,
  async (input) => {
    const result = await createGodotSpriteFrames(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_family_tier_ladder",
  "Generate a compact family tier ladder spec and optionally run the monster-pack pipeline immediately.",
  createFamilyTierLadderInputSchema,
  async (input) => {
    const result = await createFamilyTierLadder(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_world_monster_pack",
  "Generate a world-level monster pack from multiple family ladders and optionally run monster-pack and SAGA export flows.",
  createWorldMonsterPackInputSchema,
  async (input) => {
    const result = await createWorldMonsterPack(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_monster_pack",
  "Process a batch monster spec through pixelize, palette, Godot export, and manifest upsert with per-monster failure reporting.",
  createMonsterPackInputSchema,
  async (input) => {
    const result = await createMonsterPack(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_saga_enemy_data",
  "Generate SAGA and Godot-ready enemy data by combining a monster pack spec with the sprite manifest.",
  createSagaEnemyDataInputSchema,
  async (input) => {
    const result = await createSagaEnemyData(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "create_pixelorama_project",
  "Create an optional Pixelorama-friendly workspace for a sprite without making Pixelorama required for the core pipeline.",
  createPixeloramaProjectInputSchema,
  async (input) => {
    const result = await createPixeloramaProject(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "export_from_pixelorama",
  "Export from an optional Pixelorama bridge workspace. Returns clear warnings instead of crashing when Pixelorama is disabled or not configured.",
  exportFromPixeloramaInputSchema,
  async (input) => {
    const result = await exportFromPixelorama(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
