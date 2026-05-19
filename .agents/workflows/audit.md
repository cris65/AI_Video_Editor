---
description: Instructs the AI to perform a read-only audit of specific logic and generate a Markdown document containing the findings, without printing raw code in the chat.
---

Based on the objective provided:
1. Enter Read-Only Mode: Do NOT modify any existing code.
2. Analyze the workspace and locate the precise code blocks requested.
3. Generate a detailed breakdown and write it to a Markdown file in `.gemini/plans/` (e.g., `audit_report.md`). 
4. CRITICAL: You are strictly forbidden from dumping raw code blocks directly into the chat response. Always provide the code within the generated document.
5. Provide a concise summary in the chat indicating the document has been created.
