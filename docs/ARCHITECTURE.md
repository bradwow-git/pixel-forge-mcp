# Architecture

## Overview

`pixel-forge-mcp` is a local MCP server that coordinates a file-based asset pipeline for Godot and SAGA-style content generation.

The system is intentionally split into three layers:

1. MCP tool layer in `src/index.ts`
2. TypeScript orchestration and file helpers in `src/tools/` and `src/lib/`
3. Python image-processing scripts in `pipeline/`

## Main flow

The core sprite path is:

1. `pixelize_sprite`
2. `enforce_palette`
3. `export_sprite`
4. `create_manifest_entry`

Higher-level tools build on that:

- `create_monster_pack` batches the core sprite path
- `create_family_tier_ladder` generates batch specs
- `create_world_monster_pack` merges family ladders and can trigger downstream generation
- `create_saga_enemy_data` converts pack specs plus sprite manifests into gameplay data
- `create_godot_import_pack` and `create_godot_loader_stub` prepare Godot-facing outputs

## Important directories

- `src/index.ts`: MCP server and tool registration
- `src/tools/`: tool implementations and orchestration
- `src/lib/`: shared config, path, manifest, and schema helpers
- `pipeline/`: Pillow-based image operations
- `config/`: runtime configuration and palettes
- `examples/`: sample source files plus generated local outputs
- `docs/`: release, architecture, and handoff notes

## Data contracts

The main reusable contracts are:

- sprite manifest entries
- monster-pack specs
- animation manifest entries
- SAGA enemy export objects

Shared schema definitions live in:

- `src/lib/monsterSpec.ts`
- `src/lib/manifest.ts`

## Design notes

- Local-first: no cloud dependency is required for the release candidate flow.
- Composable tools: later tools reuse earlier ones instead of reimplementing logic.
- Graceful optionality: Pixelorama features warn instead of breaking the core pipeline.
- Explainable outputs: generated JSON is plain and intended to be easy to inspect or modify.
