---
name: meshy-dcc-handoff
description: "Put a finished Meshy model into a running Blender or Unity project, and drive those applications from Claude. Use when the user wants a generated model to appear in Blender or Unity, wants to edit a scene, render, or check what a live Blender or Unity instance can do. For generating the model in the first place, use meshy-3d."
license: MIT
---

# Meshy DCC handoff

A Meshy model is a file. This skill is about getting that file into a running
Blender or Unity, and about driving those applications from Claude.

The **meshy-3d** skill makes the model. This skill delivers it.

## Two ways in, same four verbs

The Meshy DCC core exposes exactly four operations, and they are the same
whether you reach them through the gateway's MCP tools or through the CLI:

| Verb | What it does |
|---|---|
| `search` | Find a capability by name, or list the whole loaded inventory when there is no query. |
| `describe` | Full metadata for one tool slug: its input schema, properties and required fields. |
| `load_skill` | Load a skill into a live instance, or activate a progressive tool group. |
| `call` | Run one capability, or an ordered batch of up to 25. |

**Through the gateway MCP** (the `meshy-dcc` server, if it is connected):
`search`, `describe`, `load_skill`, `call`.

**Through the CLI** (always available, and it starts the gateway for you):

```sh
meshy-dcc --non-interactive --output json search --query "list objects"
meshy-dcc --non-interactive --output json describe --tool-slug "<slug>"
meshy-dcc --non-interactive --output json load-skill --skill-name "<skill>" --dcc blender
meshy-dcc --non-interactive --output json call --tool-slug "<slug>" --args '<json>'
```

Use the CLI when the gateway MCP is not connected, and when you need
`start-instance`, `wait-ready` or `doctor`.

## An instance only exists while its host runs

This is the thing that trips people up. A Blender adapter does not publish
tools because it is installed. It publishes them because **Blender is open**,
and it stops publishing them when Blender closes.

```sh
meshy-dcc --non-interactive --output json list
```

If that comes back empty, the host application is not running. Nothing else
will work until it is. Say so rather than retrying.

`meshy-dcc wait-ready --dcc-type blender` waits for an instance to finish
coming up, and `meshy-dcc start-instance --dcc-type blender` launches one
when there is no instance yet.

## The order that works

1. **Make the model** (the meshy-3d skill) and download it. Know its path on
   disk.
2. **Find the instance** - `list`, or `search` for a tool. Note the
   `instance_id`.
3. **Find the capability** - `search --query "<what you want>"`. Read the
   `tool_slug` off the hit. Do not compose a slug yourself; the slug carries
   the instance and the skill it belongs to.
4. **Read the schema** - `describe` that slug. It gives the real parameter
   names and which are required. The `has_schema` flag on a search hit tells
   you whether there is one yet.
5. **Load the skill** if the hit says `loaded: false` and its `next_step` says
   `load_skill`. A capability that is not loaded cannot be called.
6. **Call it** - one call, or a batch with `calls` (max 25) when the steps
   are a sequence.

## Blender

Supported from 4.5. The adapter is a Blender **extension**; it registers
itself when Blender opens and deregisters when Blender closes.

The extension carries a lot of skills - `blender-scene`, `blender-render`,
`blender-animation`, `blender-texture-bake`, `blender-uv-ops`,
`blender-scripting` and around forty more. `load_skill` with the skill's
name brings one into the instance; `search` for a capability and read the
`skill_name` off the hit to find which skill owns it.

Blender's tools that touch `bpy` need Blender's **main thread**, so a
headless Blender is enough for the catalogue but not for driving a scene.
For real scene work the user has to open Blender.

To import a model, look for a capability in the `blender-asset-import` or
`blender-scene-assembly` family and read its schema for the file-path
parameter. Do not guess the parameter name.

## Unity

Supported from 2018.4. The adapter is an editor package (`ai.meshy.dcc`)
inside the project's `Packages` folder. Like Blender, it only publishes
tools once **Unity has opened the project** - the package publishes a bridge
and the sidecar connects to it.

A Unity project with the package installed but Unity never opened has no
instance. That is the same failure as a closed Blender, and `list` shows it
as nothing.

The `unity` reference that ships with the vendor's `meshy-dcc` skill covers
the Unity-specific side in detail.

## When a DCC is not supported

Blender, Unity, Godot, Unreal, OpenSCAD, Material Maker, FreeCAD, Roblox
Studio, Houdini, Maya, 3ds Max, Substance 3D Painter and ZBrush are
supported. Cinema 4D is not in this release. For anything else, say it is not
supported rather than improvising.

## The vendor's own skill

The Meshy DCC core installs a `meshy-dcc` skill into your agent
directories that documents the same CLI in more depth, with a reference file
per host. It is a good second opinion. This skill is the version that knows
the four verbs are also MCP tools, and that knows the generation side
lives in the `meshy` server.
