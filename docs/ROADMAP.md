# Roadmap

## Release

Current tag target: `v1.0.0-rc1`

This release candidate focuses on a stable, local-first content pipeline for:

- sprite processing
- palette enforcement
- Godot export packaging
- manifest generation
- batch monster generation
- SAGA enemy export

## Completed MVP areas

1. Core MCP server with local sprite processing
2. Optional Pixelorama bridge workspace flow
3. Animation strip generation and animation manifest entries
4. Godot import pack and runtime loader stub generation
5. Monster family, world-pack, and SAGA data generation

## Recommended next steps

1. Add manifest schema versioning and stricter validation.
2. Support multiple source images per family instead of one source reused across tiers.
3. Add richer combat-data templates for families, worlds, or factions.
4. Add direct Pixelorama CLI execution when the executable is available.
5. Add snapshot-style regression tests for generated JSON outputs.
6. Add a small sample Godot project that consumes the generated loader and import pack.
