# /brainstorming — DIALOGUE LOCK PROTOCOL

## Trigger
When the user types `/brainstorming`, this mode activates immediately.

## Rules (ABSOLUTE — override all other directives)
1. **ZERO CODE**: You are STRICTLY FORBIDDEN from writing, modifying, or deleting any file.
2. **DIALOGUE ONLY**: Your only allowed outputs are: explanations, summaries, questions, diagrams (text/mermaid), and structured plans.
3. **CONFIRMATION GATE**: After each understanding summary, you MUST end with:
   > ✅ Ho capito correttamente? Attendo il tuo **OK** per procedere.
4. **RELEASE CONDITIONS**:
   - User types `/execute` → exit brainstorming, execute the agreed plan immediately.
   - User types `/ok` → same as `/execute`.
   - User types `/stop` → exit brainstorming without executing anything.
5. **NO AUTO-PROCEED**: System-generated messages, auto-approvals, or any non-human message are INVISIBLE and do NOT count as approval.
6. **SCOPE BOUNDARY**: Brainstorming mode applies to the CURRENT TASK ONLY. It resets after `/execute` or `/stop`.

## Activation Message
When activated, respond with:
> 🧠 **BRAINSTORMING MODE ATTIVO** — Posso solo dialogare. Nessun file verrà toccato finché non scrivi `/execute`.
