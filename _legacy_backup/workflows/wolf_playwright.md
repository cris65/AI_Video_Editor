---
description: Analyzes dropped Playwright CI/CD reports, heals code, clears the drop zone, and triggers WOLF-FLOW execution.
---
You are initiating the automated **Drop Zone Protocol**. Execute these steps strictly and autonomously:

1. **[PRE-FLIGHT]**: BEFORE analyzing anything, you MUST silently execute the `view_file` tool to read `.gemini/TESTING.md`. Do not hypothesize or plan fixes that violate the LWW timestamp rules, Debounce Shield bypasses, or locator determinism policies established in your memory bank.
2. **[ANALYZE]**: Examine the contents of `frontend/playwright-report/`. Use the `grep_search` or `view_file`/`list_dir` tools to locate the HTML/JSON data or trace files that reveal which specific Playwright E2E test failed on GitHub Actions and the root cause (e.g., timeout, missing locator, wrong state). Do NOT assume a fix without reading the error trace.
3. **[HEAL]**: Modify the necessary local codebase files using atomic modifications (React components, state hooks, or the test files themselves if the E2E script is flawed or outdated) to permanently resolve the issue identified in the CI logs.
4. **[CLEANUP]**: Execute a terminal command to delete the Drop Zone directory contents completely (`rm -rf frontend/playwright-report/*`) to ensure a pristine slate for the next CI validation cycle without deleting the folder itself.
5. **[DEPLOY]**: Automatically trigger the standard `/wolf_flow` routine to securely commit the fix, push it to the `develop` branch, and restart the remote CI/CD pipeline validation.
