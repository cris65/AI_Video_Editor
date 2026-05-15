---
description: Performs the mandatory Pre-Flight Check by silently reading the structural E2E constraints and testing doctrines from the Knowledge Base before executing or generating any Playwright tests.
---
You are activating the **Pre-Flight Check Protocol**. 

1. **[SILENT INGESTION]**: Before writing a single line of E2E test code, generating new tests, or investigating a CI failure, you MUST silently execute `view_file` on `.gemini/TESTING.md` to ingest the project's living document of testing quirks.
2. **[CONSTRAINT ENFORCEMENT]**: Mentally verify that your proposed implementation or debugging plan explicitly respects the active rules regarding:
   - Optimistic UI Race Conditions (Network Response Await)
   - Debounce Shields (Hard Reload/Hydration over blind polling)
   - Last-Write-Wins (LWW) Collision Chronology
   - Nuclear Wipes vs Graceful Teardowns
   - Locator Determinism (`data-testid`)
3. **[EXECUTION]**: Once aligned, proceed with the user's operational directive. Do not announce the rules; simply apply them.
