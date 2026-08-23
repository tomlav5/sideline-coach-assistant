---
description: Update docs/BACKLOG.md — mark items done, add new findings, keep statuses accurate. Use when the user asks to update the backlog or when completed work maps to an existing item.
allowed-tools: Read Edit Grep Glob
---

## Current backlog

!`cat docs/BACKLOG.md`

## Recent commits

!`git log --oneline -10`

## Instructions

Update `docs/BACKLOG.md` according to this request: $ARGUMENTS

Rules:
- Never delete an item. Mark it `DONE <date>` or `DEFERRED` and keep it in place.
- When marking something done, add the PR number and one line on what was actually
  changed — enough that someone reading it in three months understands the outcome.
- New items get the next free number in their section and follow the existing format,
  including a `Blocks:` or `Blocked by:` line where there's a real dependency.
- If a request is ambiguous about which item it refers to, ask rather than guessing.
- Change nothing outside docs/BACKLOG.md.