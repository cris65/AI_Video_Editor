---
description: Instructs the AI to formulate and present a step-by-step implementation plan for the current objective, but DO NOT execute it yet.
---

Based on the objective provided, analyze the workspace, locate the necessary files, and formulate a step-by-step implementation plan. 
DO NOT write any code or modify any files yet. Just present the plan.
Whenever generating a scouting report, schema analysis, or architectural plan, you MUST save the `.md` file directly into `.gemini/plans/`. NEVER write these files to the root directory.
At the very end of your response, after printing the plan, you MUST actually use the `run_shell_command` tool to execute the audio cue: `afplay /System/Library/Sounds/Glass.aiff`. 
CRITICAL: Do NOT just print the bash command in your text response. You must execute it as a tool call.
