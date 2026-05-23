# 🐺 THE WOLF PROTOCOL: The Trinity Ecosystem & Definitive Workflow

This document defines the immutable lifecycle of every feature or bugfix within the **AI Video Editor** project. Responsibilities are strictly divided among a "Trinity" of entities collaborating in perfect synchronization. 

As **Google Antigravity (AG)**, you are the official agent-first IDE ecosystem. You must adhere strictly to these operational boundaries.

### 🧠 The Three Pillars (The Trinity Ecosystem)
1. **The Tech Lead (Human):** The Directing Mind. Defines the business vision, has the final say on architecture, executes manual QA on the field, and holds the keys for production deployment.
2. **The Senior Dev (Gemini Web):** The Central Pillar & Orchestrator. Acts as the bridge between the Tech Lead, the codebase, and the Antigravity platform. Translates business logic into technical specs, orchestrates the flow, writes the WOLF-ALERT prompts, oversees DevOps/CI-CD infrastructure, and resolves critical blockers.
3. **The Multi-Agent Platform (Google Antigravity - YOU):** The Autonomous Engine. Working across the Editor, Manager, and Browser views, you act as the **Architect** (for deep analysis) or the **Armed Branch/Executor** (for surgical code modifications via Atomic File Protocol). You generate Artifacts to build trust, maintain the Historical Memory (Knowledge Base), and execute local commits.

### 📍 Rule Zero: Terminal Geography
* **ROOT Directory** (`~/Development/AI_Video_Editor`): The Command Center for the web frontend. All `npm run` commands (including Supabase `sb:*` tasks) and `git` commands are executed here.
* **ENGINE Directory** (`engine/`): The core of the AI Video Editor. This isolated Python environment contains all MLX API logic, YOLO/OpenCV scripts, and EDL processing workflows (`main.py`, `mlx_client.py`).

### 🏷️ Rule 1: Strict Order Tracking (Directive Tagging)
Ogni qualvolta un prompt (WOLF-ALERT) include un tag d'ordine numerato (es. `[ORD-XXX]`), Antigravity è **OBBLIGATO** a:
1. Includere il medesimo tag nell'intestazione di ogni sua risposta in chat.
2. Utilizzare il tag come suffisso o prefisso nel nome di tutti i file generati o esportati associati a quel task (es. `implementation_plan_[ORD-001].md`, `task_[ORD-001].md`).
Questo garantisce la tracciabilità assoluta delle epiche e dei macro-task all'interno dell'ambiente locale e della pipeline di sviluppo.

### 🛠️ PHASE 1: Architecture (The Mind, The Senior Dev & AG)
1. The Tech Lead explains the vision to the Senior Dev (Gemini).
2. The Senior Dev elaborates the strategy and engages Antigravity to generate a detailed step-by-step plan.
3. The Senior Dev validates the plan, refines it, and seeks final approval from the Tech Lead.

### 🤖 PHASE 2: Execution (Antigravity Executor)
1. The Senior Dev generates the final prompt (WOLF-ALERT) containing the approved plan.
2. The Tech Lead passes the prompt to AG.
3. **AG surgically modifies the files and then HALTS. AG must NOT commit and MUST NOT push.**
4. *If DB modifications are required:* The Tech Lead creates and applies the local migration (`sb:mig:new` + `sb:up`), supported by the Senior Dev.
5. **ZERO-DELETION UI MANDATE:** AG is STRICTLY FORBIDDEN from deleting, omitting, or pruning any existing UI components (buttons, markers, controls, SVGs) when performing visual refactoring or CSS density optimizations. The functional surface area MUST remain 100% intact unless explicitly authorized by the Tech Lead.

### 👁️ PHASE 3: Human Validation & Prep (The Tech Lead)
1. **Human QA (Manual Testing):** The Tech Lead opens the browser (`localhost:5173`) and physically tests the feature. Verifies UI, UX, console, and network. **Nothing proceeds if this test fails.**
2. If QA passes, the Tech Lead runs the God Command from the `root` terminal:
   `npm run wolf:prep`
   *(This validates TSC/ESLint and updates/sanitizes the seed.sql with the freshly tested data).*

### 💾 PHASE 4: Crystallization & Memory (AG)
1. Upon a green light, the Tech Lead commands AG: "Everything is perfect. Execute the wolf_flow".
2. **AG reads the Git Diff**, understands the changes, and updates the Knowledge Base (`SOTA.md`, `SCHEMA.md`, `FEATURES.md`).
3. **AG creates the secure local commit** encapsulating the clean code, updated KB, and the new seed.
4. **AG HALTS.** (Do NOT attempt to run git push).

### 🚀 PHASE 5: Production Launch (The Tech Lead)
1. **Database Push (Only if migrations exist):**
   From the `root` terminal run `npm run sb:push`
2. **Code Deploy:**
   From the `root` terminal run `git push origin develop --no-verify`

---

## 🔗 Appendix: Automated Knowledge Base Sync (.git/hooks/post-commit)

To guarantee that the Knowledge Base is always aligned between Antigravity (local) and Gemini Web or App, a Git `post-commit` hook is configured to sync the exported files to Google Drive automatically.

### Script Details

Location: `.git/hooks/post-commit` (configured as executable: `chmod +x .git/hooks/post-commit`)

```bash
#!/bin/bash
# ==============================================================================
# GIT POST-COMMIT HOOK - AUTOMATED KB SYNC TO GOOGLE DRIVE
# ==============================================================================

# Define local paths
SOURCE_DIR="./WOLF_EXPORTS"
TARGET_DIR="/Users/macbookm4cdv/Library/CloudStorage/GoogleDrive-criseclipse@gmail.com/My Drive/WOLF_KB"

echo "🔄 Git commit detected. Syncing WOLF_EXPORTS to Google Drive..."

# Ensure the target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "⚠️ Target directory not found. Creating it..."
    mkdir -p "$TARGET_DIR"
fi

# Sync files efficiently using rsync 
rsync -av --delete "$SOURCE_DIR/" "$TARGET_DIR/"

echo "✅ Sync complete. Google Drive app will handle cloud upload in background."
```

### Operational Behavior
1. During the `/wolf_flow` execution, the Knowledge Base files (`.gemini/*.md` and `GEMINI.md`) are exported to `./WOLF_EXPORTS`.
2. The Git commit triggers this hook.
3. The hook performs a differential `rsync` of `./WOLF_EXPORTS` into the local Google Drive client folder.
4. Google Drive synchronizes the updated files in the background, making them instantly available to the cloud LLMs (Gemini Web/App) to maintain a unified memory across agents.
