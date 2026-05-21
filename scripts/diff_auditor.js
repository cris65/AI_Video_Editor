import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MAX_HEALING_ATTEMPTS = 3;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("🚨 WOLF-ALERT: GEMINI_API_KEY is missing. Project Guardian cannot audit the diff.");
    process.exit(1);
}

const SYSTEM_PROMPT = `You are "Project Guardian", an elite semantic diff auditor.
Your job is to analyze the 'git diff --cached' and the current feature context.
You must distinguish between "Intentional Refactoring" (modifications required by the feature) and "Unintentional Regressions" (accidentally deleted functions, logic, or exports).

Respond EXCLUSIVELY with a JSON object. No markdown wrapping outside the JSON, no conversational text.
Format:
{
  "regression_detected": boolean,
  "severity": "low" | "medium" | "high",
  "reason": "Description of what was lost",
  "can_self_heal": boolean,
  "fix_instructions": "Precise instructions to restore the missing logic",
  "self_heal_patches": [
    {
      "file": "relative/path/to/file.ts",
      "find": "Exact string to find and replace. MUST include at least 2 lines of context before and after the change to guarantee uniqueness.",
      "replace": "Exact string to insert, replacing the 'find' block."
    }
  ]
}`;

async function callGemini(diff, context) {
    // Utilizziamo il modello Pro per una maggiore capacità di comprensione semantica
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;
    const payload = {
        system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
            role: "user",
            parts: [{ text: `--- CONTEXT (FEATURES.md) ---\n${context}\n\n--- GIT DIFF ---\n${diff}` }]
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${error}`);
    }

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;
    
    // Cleanup markdown backticks if present
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    return JSON.parse(text);
}

async function runAuditLoop() {
    let context = "";
    try {
        context = fs.readFileSync(".gemini/FEATURES.md", "utf-8");
    } catch (e) {
        console.warn("⚠️  .gemini/FEATURES.md not found. Proceeding without feature context.");
    }

    for (let attempt = 1; attempt <= MAX_HEALING_ATTEMPTS; attempt++) {
        const diff = execSync('git diff --cached --unified=3').toString();
        
        if (!diff || !diff.trim()) {
            console.log("✅ WOLF AUDITOR: Staging area is empty or diff is clean.");
            process.exit(0);
        }

        // Controlla se ci sono rimozioni (escludendo le intestazioni del diff)
        const hasDeletions = diff.split('\\n').some(line => line.startsWith('-') && !line.startsWith('---'));
        if (!hasDeletions) {
            console.log("✅ WOLF AUDITOR: No deletions detected. Proceeding.");
            process.exit(0);
        }

        console.log(`🐺 WOLF AUDITOR: Deletions detected. Analyzing diff semantics (Attempt ${attempt})...`);
        
        let result;
        try {
            result = await callGemini(diff, context);
        } catch (e) {
            console.error("🚨 WOLF-ALERT: Failed to parse LLM response.", e);
            process.exit(1);
        }

        if (!result.regression_detected) {
            console.log("✅ WOLF AUDITOR: Intentional refactoring confirmed. No regressions.");
            process.exit(0);
        }

        console.error(`🚨 WOLF-ALERT: Semantic Regression Detected! (Severity: ${result.severity})`);
        console.error(`   Reason: ${result.reason}`);

        if (result.can_self_heal && result.self_heal_patches && result.self_heal_patches.length > 0) {
            console.log("   🩹 Attempting Auto-Healing...");
            let healSuccess = true;

            for (const patch of result.self_heal_patches) {
                try {
                    const filePath = path.resolve(patch.file);
                    let content = fs.readFileSync(filePath, "utf-8");
                    
                    // La stringa 'find' deve combaciare perfettamente, inclusi gli spazi e ritorni a capo
                    if (!content.includes(patch.find)) {
                        console.error(`   ❌ Failed to find the exact block in ${patch.file} for patching. Context mismatch.`);
                        healSuccess = false;
                        break;
                    }

                    content = content.replace(patch.find, patch.replace);
                    fs.writeFileSync(filePath, content, "utf-8");
                    execSync(`git add "${patch.file}"`);
                    console.log(`   ✅ Patched and staged: ${patch.file}`);
                } catch (e) {
                    console.error(`   ❌ Failed to patch ${patch.file}:`, e.message);
                    healSuccess = false;
                    break;
                }
            }

            if (healSuccess) {
                console.log("   🔄 Auto-Healing applied. Re-auditing the new diff...\\n");
                continue; // Riesegue il loop
            } else {
                console.error("🚨 WOLF-ALERT: Auto-Healing failed due to patch mismatch. Human intervention required.");
                process.exit(1);
            }
        } else {
            console.error("🚨 WOLF-ALERT: Cannot self-heal or no patches provided. Human intervention required.");
            if (result.fix_instructions) console.error(`   Suggested Fix: ${result.fix_instructions}`);
            process.exit(1);
        }
    }

    console.error(`🚨 WOLF-ALERT: Max healing attempts (${MAX_HEALING_ATTEMPTS}) reached. Regression persists.`);
    process.exit(1);
}

runAuditLoop().catch(e => {
    console.error("🚨 WOLF-ALERT: Fatal Error in diff_auditor.js", e);
    process.exit(1);
});
