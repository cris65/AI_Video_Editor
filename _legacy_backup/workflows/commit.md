---
description: Stages files, generates a WOLF-format message, commits, and pushes to origin.
---

Analyze the codebase changes using git diff.
1. Read the current version from package.json.
2. Generate a strict Conventional Commit message prefixed with the version bracket, exactly like this format: `[vX.X.X] type(scope): description`.
3. Autonomously execute the entire release chain in ONE shell command:
   `git add . && git commit -m "<your_generated_message>" && git push origin develop`
CRITICAL: Do NOT run manual tests before this command. Let the automated Husky Git Hooks handle the testing during the commit/push phase. Report the final outcome.
