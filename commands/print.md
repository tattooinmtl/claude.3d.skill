---
description: Check whether a Meshy model is printable, and fix it if it is not
argument-hint: "<task id or model file, and optionally the printer>"
allowed-tools: mcp__meshy__meshy_check_balance, mcp__meshy__meshy_analyze_printability, mcp__meshy__meshy_repair_printability, mcp__meshy__meshy_auto_split, mcp__meshy__meshy_process_multicolor, mcp__meshy__meshy_send_to_slicer, mcp__meshy__meshy_get_task_status, mcp__meshy__meshy_download_model, mcp__meshy__meshy_list_models, mcp__meshy__meshy_retexture, mcp__meshy__meshy_get_task_status, Bash, Read
---

# Is it printable?

Answer the question properly, then fix it if the answer is no.

## The order

1. **Find the model.** From a task id, `meshy_get_task_status` gives the real
   `task_type`, which the download tool needs. From a name,
   `meshy_list_models` gives the task id.
2. **Analyse it** - `meshy_analyze_printability`. This is **free** and it is
   the authoritative answer. It checks watertightness, non-manifold edges,
   holes, degenerate faces and volume, and adds thin-wall checks when you
   give it a `printer_type` (FDM, SLA/resin, full-colour) or a print size.
3. **Report the verdict** with the specific problems it named - "non-manifold
   edges on the base" is useful, "not printable" is not.
4. **Fix it, if asked** - `meshy_repair_printability` costs 10 credits and
   **removes the texture**. Say that before doing it, and retexture
   afterwards if the texture matters.
5. **Open the slicer** - `meshy_send_to_slicer` at the **start**, and keep
   the result. At the end, replace `{file}` in a `launch_command` with the
   downloaded file's path and run it.

## The other two repair shapes

- `meshy_auto_split` (10 credits) cuts the model into separately printable
  parts - for a model too big for the bed, for parts that need different
  materials, or for an assembly. It does not keep the texture.
- `meshy_process_multicolor` (10 credits) turns a textured model into a
  multi-colour 3MF that opens ready to print.

## Check the balance first

`meshy_check_balance` is free. Both repairs cost 10 credits each, and the
user should know the number before it is spent.

## Do not

- Do not launch a slicer before the model is downloaded - a launch command is
  not proof the model imported.
- Do not say a model is printable without the analysis behind it.
- Do not repair without saying that the texture is going to be stripped.
