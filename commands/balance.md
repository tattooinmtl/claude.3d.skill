---
description: Check the Meshy credit balance and what has been spent
argument-hint: "[optional: a task id, to look up one task's credits]"
allowed-tools: mcp__meshy__meshy_check_balance, mcp__meshy__meshy_list_usage, mcp__meshy__meshy_get_task_status
---

# Meshy balance

Report the Meshy credit balance, and - when asked - where the credits went.

## Do this

1. `meshy_check_balance` - free, and it works on any key. Start here.
2. If a task id was given: `meshy_get_task_status` on it, and report the
   task's own `consumed_credits` - that is the real charge, not an estimate.
3. If the key is on a Studio or Enterprise team, `meshy_list_usage` breaks the
   spend down per task, newest first. On any other key it answers 403 - that
   is expected, and `meshy_check_balance` is the answer instead.

## Say plainly

- The balance, in credits.
- What the balance buys, in the terms the user asked about. The server's own
  prices: text-to-3D is 20 credits on meshy-7.1 and 5 on meshy-6-lite,
  texturing a preview is 10, remeshing is 5, rigging is 5, an animation
  action is 3, a conversion is 1.
- If a task is still running, say so and how long it has been running.

## Do not

- Do not start a generation. This command reports, it does not spend.
- Do not guess a price. The costs are in `references/tools.md`, taken from
  the server itself, and the real charge is always the task's own
  `consumed_credits`.
