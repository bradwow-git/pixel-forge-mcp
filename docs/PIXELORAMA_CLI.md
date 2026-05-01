# Pixelorama CLI Notes

This note captures what `pixel-forge-mcp` currently knows about Pixelorama command-line automation.

## Sources checked

- Pixelorama CLI manual: https://pixelorama.org/user_manual/cli/
- Pixelorama releases: https://github.com/Orama-Interactive/Pixelorama/releases

## Confirmed documentation

Pixelorama documents a desktop CLI that supports export-related user options, including:

- `--export`
- `--spritesheet`
- `--output`
- `--scale`
- `--frames`
- `--direction`
- `--json`

The documented command shape is:

`Pixelorama [SYSTEM OPTIONS] -- [USER OPTIONS] [FILES]...`

Useful documented system options include:

- `--headless`
- `--quit`

The official docs were last updated on April 23, 2026 when this was checked. Pixelorama release notes also mention recent CLI improvements, including output file paths in `v1.1` and relative path support in `v1.1.5`.

## Local Windows findings

When checked on this machine on April 30, 2026:

- `Pixelorama.exe --help` did not print visible console output
- `Pixelorama.exe --version` did not print visible console output
- `Pixelorama.exe -- --help` also did not print visible console output
- the lack of console output appears to be a Windows GUI-build behavior rather than proof that the CLI does not exist

Because of that, `pixel-forge-mcp` treats the official docs as the source of truth for CLI syntax and then verifies success by checking whether the requested export file was actually created.

## What the bridge currently automates

`export_from_pixelorama` now attempts a real Pixelorama CLI export first.

Current behavior:

1. Check whether Pixelorama bridge is enabled and the executable exists.
2. Read bridge metadata from the generated workspace.
3. Attempt CLI export with Pixelorama.
4. Verify success by checking whether the requested output file was written.
5. Fall back to a safe direct copy of the staged bridge sprite only if CLI export does not produce a file.

## Important limitation

The generated `.pxo` file in MVP is still a Pixel Forge placeholder unless you provide a real Pixelorama project template.

That means:

- workspace staging is real
- executable detection is real
- CLI export attempts are real
- but when the workspace uses the placeholder bridge project, Pixel Forge currently exports the staged source image through the CLI attempt path instead of authoring a full native Pixelorama project structure

If CLI export still does not produce an output file, Pixel Forge falls back to copying the staged sprite and reports a warning that this was not a true Pixelorama-rendered export.

## Practical interpretation

Today, the bridge is good for:

- staging a sprite into a Pixelorama workspace
- letting a user open and edit that staged asset manually
- attempting a documented CLI export when Pixelorama is installed
- preserving a safe local output even when CLI export is not confirmed

It does not yet guarantee:

- native `.pxo` project authoring from scratch
- full round-trip automated editing inside Pixelorama
- reliable CLI export from placeholder bridge projects without a real Pixelorama-authored project file
