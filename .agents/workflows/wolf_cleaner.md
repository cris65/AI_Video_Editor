---
description: Removes temporary GCLI execution scripts and garbage files from the workspace.
---

Execute this shell command immediately to clean the workspace from temporary AI scripts:
rm -f fix_*.js plan_*.js update_*.js replace_*.js dashboard_*.js debug-check.txt && echo '🧹 WOLF-CLEANER Protocol Executed: Workspace is pristine!'

(Note: if your terminal is inside the `frontend/` folder, adapt the path to `rm -f ../fix_*.js ../plan_*.js ../update_*.js ../replace_*.js ../dashboard_*.js ../debug-check.txt`).
Do not modify any codebase files. Confirm the cleanup and close the operation.
