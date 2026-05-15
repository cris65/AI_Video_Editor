---
description: Synchronizes and translates missing i18n localization keys based on the English (EN) master file.
---

Initiate the Localization Synchronization Protocol. We must align all application localizations using `en.ts` as the Source of Truth.

CRITICAL INVIOLABLE RULES:
1. DO NOT process the `.ts` files manually through your context window using `multi_replace`. It will corrupt the AST.
2. You MUST strictly use the existing Node.js script via the local npm command.

MISSION: Translate missing keys and inject them safely using the system tools.

Execution Steps to Plan:
1. **Dry Run Extraction:** Execute `npm run sync-locales -- --dry-run` (or the equivalent argument to trigger the diff logic) to output the JSON mapping of missing keys.
2. **Translation Payload:** Read the dry-run output and autonomously translate the missing English values into the respective target languages. Generate a temporary file (e.g., `frontend/src/lib/locales/scripts/payload.json`) containing this localized mapping.
3. **Native Injection:** Execute `npm run sync-locales -- --inject payload.json` (or the correct path) to let the Node script rebuild the AST safely.
4. **Cleanup:** Delete the temporary `payload.json` file.

OUTPUT FORMAT: Generate your `implementation_plan.md` listing the exact CLI steps you will run and a preview of the translations. Halt and wait for `/execute`.