# pixel-forge-mcp

`pixel-forge-mcp` is a local MCP server for a Godot RPG or roguelike asset pipeline. It turns source images into palette-constrained sprite outputs, writes manifest data, generates batch monster content, and prepares Godot- and SAGA-friendly export artifacts.

Release candidate: `v1.0.0-rc1`

## Quick start

```bash
npm install
npm run setup:py
npm run test:all
```

To start the MCP server locally:

```bash
npm run dev
```

## MVP feature list

- Local MCP server over stdio
- Python + Pillow sprite pixelizing and palette enforcement
- Sprite export into a local Godot mirror
- Static and animation manifest entry generation
- Optional Pixelorama bridge workspace creation
- Godot import-pack generation
- Godot 4 loader stub generation
- Godot 4 editor plugin generation
- Godot 4 monster scene generation
- Godot 4 SpriteFrames resource generation
- Batch monster pack generation
- Family tier ladder generation
- World monster pack generation
- SAGA enemy-data export

## Requirements

- Node.js 18.18 or newer
- Python 3.10 or newer
- No admin permissions required

## Python environment setup

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Windows Command Prompt:

```bat
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Or let the project do that setup:

```bash
npm run setup:py
```

## Common commands

```bash
npm run build
npm run dev
npm run test:all
npm run test:pipeline
npm run test:godot-plugin
npm run test:spriteframes
npm run test:spriteframes-direction
npm run test:godot-scenes
npm run test:monster-pack
npm run test:world-pack
```

## Full validation

`npm run test:all` runs:

- `build`
- `test:pipeline`
- `test:pixelorama-bridge`
- `test:animation`
- `test:godot-pack`
- `test:godot-loader`
- `test:godot-plugin`
- `test:spriteframes`
- `test:spriteframes-direction`
- `test:godot-scenes`
- `test:monster-pack`
- `test:saga-enemies`
- `test:family-ladder`
- `test:world-pack`

## Current limitations

- Pixelorama support is optional and currently stops at bridge/workspace generation rather than full CLI automation.
- Example outputs under `examples/` are reused by tests, so sequential validation is preferred over ad hoc parallel test runs.
- World-level pack generation shares the main example output folders instead of isolating per-world output roots.
- Generated manifests and example assets are intended for local workflow validation, not as canonical shipping content.

## Tool overview

Core sprite pipeline:

- `pixelize_sprite`
- `enforce_palette`
- `export_sprite`
- `create_manifest_entry`

Higher-level generation:

- `create_animation_strip`
- `create_animation_manifest_entry`
- `create_pixelorama_project`
- `export_from_pixelorama`
- `create_godot_import_pack`
- `create_godot_loader_stub`
- `create_godot_editor_plugin`
- `create_godot_spriteframes`
- `create_godot_monster_scenes`
- `create_monster_pack`
- `create_saga_enemy_data`
- `create_family_tier_ladder`
- `create_world_monster_pack`

## Godot editor plugin example

Generate a Godot 4 editor dock plugin into an import-pack folder:

```json
{
  "outputDir": "examples/godot-import-pack",
  "pluginName": "pixel_forge",
  "displayName": "Pixel Forge",
  "manifestPath": "res://content/sprite_manifest.json"
}
```

This writes:

- `examples/godot-import-pack/addons/pixel_forge/plugin.cfg`
- `examples/godot-import-pack/addons/pixel_forge/pixel_forge_plugin.gd`
- `examples/godot-import-pack/addons/pixel_forge/pixel_forge_dock.gd`
- `examples/godot-import-pack/addons/pixel_forge/pixel_forge_dock.tscn`
- `examples/godot-import-pack/addons/pixel_forge/README_PIXEL_FORGE_PLUGIN.md`

The generated dock now includes:

- `Refresh Manifest`
- `Install Content Pack`
- a status label for success and warning feedback

## Godot monster scenes example

Generate Godot 4 monster scenes from the portable import-pack manifest:

```json
{
  "manifestPath": "examples/godot-import-pack/content/sprite_manifest.json",
  "outputDir": "examples/godot-import-pack",
  "sceneRootDir": "content/scenes/monsters",
  "baseScriptPath": "res://content/scripts/MonsterActor.gd"
}
```

This writes:

- `examples/godot-import-pack/content/scenes/monsters/<id>.tscn`
- `examples/godot-import-pack/content/scripts/MonsterActor.gd`
- `examples/godot-import-pack/content/scenes/monsters/README_MONSTER_SCENES.md`

## Godot SpriteFrames example

Generate Godot 4 `SpriteFrames` resources from animation manifest entries:

```json
{
  "manifestPath": "examples/godot-import-pack/content/sprite_manifest.json",
  "outputDir": "examples/godot-import-pack",
  "spriteFramesDir": "content/resources/spriteframes"
}
```

This writes:

- `examples/godot-import-pack/content/resources/spriteframes/<id>.tres`
- `examples/godot-import-pack/content/resources/spriteframes/README_SPRITEFRAMES.md`

Current limitation:

- SpriteFrames generation supports `stripDirection: "horizontal" | "vertical"`.
- If `stripDirection` is omitted, Pixel Forge defaults it to `horizontal`.

Animation manifest note:

- `stripDirection: "horizontal"` means `x = frameIndex * frameWidth`, `y = 0`
- `stripDirection: "vertical"` means `x = 0`, `y = frameIndex * frameHeight`

## Generated example artifacts

Most files under these paths are generated locally by tool runs or tests:

- `examples/output/`
- `examples/godot-project/content/art/`
- `examples/godot-import-pack/`
- `examples/pixelorama/`
- `examples/specs/generated/`
- `examples/saga/worlds/`

The repo ignores those generated artifact areas where appropriate so the local workflow stays clean.

## Recommended next steps

1. Add schema versioning for manifests, specs, and exported gameplay JSON.
2. Add isolated output roots for each test to avoid shared artifact coupling.
3. Add a sample Godot scene that consumes the generated loader and import pack.
4. Add direct Pixelorama CLI integration when a reliable local automation path is available.

## Docs

- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/CODEX_HANDOFF.md`
- `docs/PIXELORAMA_CLI.md`
