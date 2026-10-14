---
name: new-module
description: Create a new module (system) folder from the template and register it in docs/PROJECT.md.
disable-model-invocation: true
argument-hint: <module_key> "<Thai name>"
---

Create module `$0` (Thai name: $1).

1. Check the key: lowercase snake_case, short, not already a folder in `docs/modules/`. If invalid, propose a fixed key and ask.
2. Copy `docs/modules/_template/` to `docs/modules/$0/` (all files and subfolders). Replace `<Module name>` in headings with the Thai name.
3. Add or update the module's row in the Modules table of `docs/PROJECT.md`: Phase `P1`, Stage `–`, Status `brief needed`.
4. Do not create any backend or frontend code.
5. Tell the user in Thai, in 3 lines: fill `docs/modules/$0/00-brief.md`, put source documents in `attachments/`, then run `/discovery $0`.
