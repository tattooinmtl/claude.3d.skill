---
name: meshy-3d
description: "Create 3D models, textures, images, rigs and animations with Meshy, and check whether a model is printable. Use when the user asks for a 3D model, a mesh, a GLB or FBX, a texture, a rigged or animated character, a printable file, a 3MF, or wants a Meshy model prepared for printing. For pushing a finished model into Blender or Unity, use meshy-dcc-handoff."
license: MIT
---

# Meshy 3D

Meshy is reached through the `meshy` MCP server, which publishes 28 tools.
This skill was written against the server's actual source, so the tool names,
the parameter names and the credit costs below are the real ones - not a
summary of a summary.

## The shape of a generation

Every generation call is asynchronous. It returns a **task id**, not a model.
Any plan that expects a file straight out of a create call is wrong.

1. **Create** - `meshy_text_to_3d`, `meshy_image_to_3d`, `meshy_multi_image_to_3d`.
2. **Wait** - `meshy_get_task_status` with that task id. `wait=true` (the
   default) blocks until the task finishes; `wait=false` polls once.
   Text-to-3D takes 2-3 minutes, so do not poll in a tight loop.
3. **Download** - `meshy_download_model` writes the result under
   `meshy_output/` (project folders with history), or wherever `save_to`
   points.

`meshy_get_task_status` reports the task's **real** `task_type`, which is not
always the type of the tool you called - a refined preview and its source are
different types. Pass the reported type to the download and cancel tools.

## Before you spend anything

`meshy_check_balance` is free and tells you the credit balance for the key in
use. Most calls below cost credits and some cost ten of them, so check first
rather than discovering it from a 402.

**Meshy's own agent instructions name only 25 of its 28 tools.** They never
mention `meshy_check_balance`, `meshy_list_usage` or `meshy_cancel_task`.
All three are registered and all three work. That is why this skill names
them: the balance check belongs *before* an expensive call, and a stuck
generation has to be cancellable.

`meshy_list_usage` breaks the spend down per task, but only works on a Studio
or Enterprise team key. A single key gets a 403 - use `meshy_check_balance`
instead.

## Text to 3D is two steps, and the second one costs money

`meshy_text_to_3d` produces an **untextured preview**. Texturing it is
`meshy_text_to_3d_refine`, a separate call, 10 credits (15 at 8K).

**Get the user's approval before you refine.** The preview exists so the
user can judge the shape. Refining something they will not keep spends their
credits on a model they discard.

`meshy_image_to_3d` is different: it is textured by default, so there is no
refine step. Same for `meshy_multi_image_to_3d`.

## What things cost

| Cost | Tools |
|---|---|
| Free | `meshy_check_balance`, `meshy_list_usage`, `meshy_list_animations`, `meshy_analyze_printability`, `meshy_send_to_slicer`, `meshy_list_tasks`, `meshy_list_models`, `meshy_get_task_status` |
| 1 | `meshy_convert`, `meshy_resize` |
| 3 | `meshy_animate` (per action), `meshy_text_to_motion` (with swift) |
| 5 | `meshy_remesh`, `meshy_rig`, `meshy_uv_unwrap` |
| 10 | `meshy_retexture`, `meshy_text_to_3d_refine`, `meshy_repair_printability`, `meshy_process_multicolor`, `meshy_auto_split`, `meshy_text_to_motion` (prime) |
| variable | `meshy_image_to_image` - 3 to 12 depending on the model |

Before an expensive call, say what it will cost and get the go-ahead. After
it, the task's own consumed credits are the truth - not the estimate.

## The full tool list

Every tool, its parameters and what it actually does:
[references/tools.md](references/tools.md).

## Pairs that are easy to confuse

- `meshy_remesh` changes polygon count or topology. `meshy_convert` changes
  file format. `meshy_resize` changes real-world size. Three tools, three
  prices.
- `meshy_list_tasks` lists tasks of any status. `meshy_list_models` lists
  finished 3D models only.
- `meshy_rig` auto-rigs a humanoid, and the walking and running animations
  come with it for free. `meshy_animate` needs a `rig_task_id` - rig first.
- `meshy_text_to_motion` is a skeleton motion, not a model.
- `meshy_animate` takes exactly one of `action_id`, `action_ids` or
  `motion_task_id`. `meshy_resize` takes exactly one of `resize_height`,
  `resize_longest_side` or `auto_size`.
- `meshy_uv_unwrap` makes a clean, non-overlapping UV layout. Do it before
  texturing in Blender, Substance Painter or Unreal.
- `meshy_text_to_image` generates a 2D image - useful when the user should
  approve a design before you spend on a 3D model.

## Printing

`meshy_analyze_printability` is the authoritative answer to "is this
printable?". It is free and it checks watertightness, non-manifold edges,
holes, degenerate faces and volume - plus thin walls when you give it a
printer type or a print size.

`meshy_repair_printability` fixes all of that, but it costs 10 credits and
**removes the texture**. Retexture afterwards if the texture matters.

For a print workflow, call `meshy_send_to_slicer` at the **start** and keep
the result. At the end, replace `{file}` in a `launch_command` with the
downloaded file's path and run it. A launch command is not proof the model
imported - the slicer has to open it.

`meshy_auto_split` cuts a model into separately printable parts when it is
too big for the bed, when the parts need different materials, or when it
should be assembled. It costs 10 credits and does not keep the texture.

`meshy_process_multicolor` turns a textured model into a multi-colour 3MF
that opens ready to print. Also 10 credits.

## Getting the result somewhere

`meshy_download_model` puts the file on disk. To put it in front of the user
in Blender or Unity, use the **meshy-dcc-handoff** skill.

## Credentials

The key lives in `mcp/.env` as `MESHY_API_KEY` and is read when the server
starts. The server checks it on the first tool call, not at startup, so a
missing key shows up as a 401 on the first generating call rather than as a
failed connection. The API needs a Meshy **Pro plan or above**.
