---
description: "Executes the full autonomous WOLF-FLOW release: bump, audit types, commit, push code, push DB migrations, export KB."
---

You are initiating the final WOLF-FLOW Release Cycle. Execute these steps strictly and autonomously:

1. PRE-FLIGHT KNOWLEDGE AUDIT (MANDATORY): Run `git diff HEAD` (or inspect changed files) to analyze the actual codebase changes made during this session. Cross-reference these changes against the `.gemini/` Knowledge Base (`SOTA.md`, `EVOLUTION.md`, `SCHEMA.md`, `FEATURES.md`).
2. KNOWLEDGE INJECTION: Update ALL necessary `.gemini/*.md` documentation to accurately reflect the current codebase state.
3. VALIDATION (CRITICAL): Run `npm run wolf:audit` to natively verify types and 'any' usage. If this fails, you MUST fix the errors before proceeding.
4. BUMP: Run `npm version patch --no-git-tag-version` (unless I explicitly asked for minor/major).
5. MESSAGE: Read the new version and the git diff. Generate a strict Conventional Commit message format: `[vX.X.X] type(scope): description`.
6. EXECUTE: Run this exact chained command in the shell:
   `git add . && git commit -m "<your_generated_message>" && mkdir -p ./WOLF_EXPORTS && cp .gemini/*.md ./WOLF_EXPORTS/ && cp GEMINI.md ./WOLF_EXPORTS/ && echo '✅ WOLF_EXPORTS Export Completed!' && afplay /System/Library/Sounds/Glass.aiff`
7. AUTONOMOUS HEALING (CRITICAL): If the shell command fails because Husky pre-commit hooks (Linter, TS, or E2E tests) blocked the commit, DO NOT STOP. According to GEMINI.md Section 7, you have a budget of 3 consecutive attempts. Read the terminal error, fix the exact file, and autonomously re-run step 6. 

Report the final outcome only when the cycle is fully closed or if the 3 healing attempts are exhausted.
