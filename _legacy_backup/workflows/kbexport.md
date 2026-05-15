---
description: Exports the Knowledge Base (.gemini/*.md and GEMINI.md) to the Desktop.
---

Execute this shell command immediately to export our Knowledge Base to the WOLF_EXPORTS folder inside the project root:
```bash
rm -rf WOLF_EXPORTS && mkdir -p WOLF_EXPORTS && cp .gemini/*.md WOLF_EXPORTS/ && cp GEMINI.md WOLF_EXPORTS/ && echo '✅ WOLF_KB Export Completed!'
```

(Note: if your terminal is inside the `frontend/` folder, adapt the path to `rm -rf ../WOLF_EXPORTS && mkdir -p ../WOLF_EXPORTS && cp ../.gemini/*.md ../WOLF_EXPORTS/ && cp ../GEMINI.md ../WOLF_EXPORTS/`).
Do not modify any codebase files. Confirm the export and close the operation.
