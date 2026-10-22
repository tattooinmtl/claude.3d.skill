---
description: Generate a 3D model with Meshy and deliver the file
argument-hint: "<what to model, and where to save it>"
allowed-tools: mcp__meshy__meshy_check_balance, mcp__meshy__meshy_text_to_3d, mcp__meshy__meshy_image_to_3d, mcp__meshy__meshy_multi_image_to_3d, mcp__meshy__meshy_text_to_3d_refine, mcp__meshy__meshy_get_task_status, mcp__meshy__meshy_download_model, mcp__meshy__meshy_list_models, mcp__meshy__meshy_cancel_task, Read, Write, Glob
---

# Generate a 3D model

Turn the request into a delivered model file. Generation is asynchronous, so
this is three calls, not one, and completion means a file on disk - not a
task id in a transcript.

## Before you spend

1. `meshy_check_balance` - free. If the balance will not cover the call,
   say so and stop.
2. If the user gave images, use `meshy_image_to_3d` (or
   `meshy_multi_image_to_3d` for 1-4 views of the same object). It comes back
   **textured**, in one task.
3. If the user gave only text, use `meshy_text_to_3d`. It comes back
   **untextured** - it is a preview.

## The three steps

1. **Create** - the tool above. It returns a task id.
2. **Wait** - `meshy_get_task_status` with that id. The default `wait=true`
   blocks until it finishes; text-to-3d takes 2-3 minutes. Do not poll in a
   loop, and do not submit a second task because the first is slow.
3. **Download** - `meshy_download_model` with the task id. It saves under
   `meshy_output/` unless `save_to` says otherwise. Use the path the user
   asked for.

`meshy_get_task_status` reports the task's real `task_type`. Pass that to the
download tool - it is not always the type of the tool you called.

## Texturing a text-to-3D preview

`meshy_text_to_3d` gives a preview; `meshy_text_to_3d_refine` textures it
for 10 credits. **Ask the user to approve the preview before you refine.**
Refining a model they will not keep spends their credits on nothing.

If they want the model textured without that round trip, `meshy_text_to_image`
then `meshy_image_to_3d` with the image task's id gives a textured model in
one 3D task - and the user gets to see the design first.

## When something goes wrong

- A task is stuck: `meshy_cancel_task` cancels a queued one or deletes a
  finished one. It is free, and the vendor's own instructions never mention
  it.
- You need an earlier model: `meshy_list_models` lists finished models with
  their task ids and formats.
- A 401: the key is missing or wrong. It lives in `mcp/.env` as
  `MESHY_API_KEY`. The API needs a Pro plan or above.

## Deliver

Say where the file is, what format it is, and what it cost. Do not claim a
preview was inspected if it was not, and do not describe a rendered image as
proof that the topology is good.
