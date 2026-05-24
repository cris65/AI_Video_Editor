import fs from 'fs';
import path from 'path';

// Resolve the path relative to the current working directory (project root)
const MEMORY_FILE_PATH = path.resolve('.wolf', 'guardian_memory.json');

/**
 * Initializes the logger by ensuring the .wolf directory and the memory JSON file exist.
 */
export function initLogger() {
    const dir = path.dirname(MEMORY_FILE_PATH);
    
    // Ensure the directory exists
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Ensure the JSON file exists and is valid
    if (!fs.existsSync(MEMORY_FILE_PATH)) {
        fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
    } else {
        try {
            const content = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
            if (!content.trim()) {
                fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
            } else {
                JSON.parse(content);
            }
        } catch (e) {
            console.warn("🚨 WOLF-ALERT: guardian_memory.json was corrupted. Re-initializing.");
            fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
        }
    }
}

/**
 * Reads and returns the complete history of violations.
 * @returns {Array<Object>} List of tracked violations
 */
export function getViolationsHistory() {
    initLogger();
    try {
        const content = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error("🚨 WOLF-ALERT: Failed to read violations history.", e);
        return [];
    }
}

/**
 * Appends a new violation to the persistent log.
 * @param {Object} violationData The details of the violation.
 * @param {string} violationData.violation_type Enum string (e.g., "UNAUTHORIZED_DELETION")
 * @param {string} violationData.file_path The exact file(s) involved
 * @param {string} violationData.escalation_level "FAST_GUARDIAN_INTERCEPTED" | "WOLF_GUARDIAN_ESCALATED"
 * @param {string} violationData.action_taken Enum string (e.g., "BLOCKED_COMMIT")
 * @param {string} violationData.agent_diff_snippet The specific chunk of git-diff
 * @param {string} violationData.guardian_rationale AI-generated summary of why it was blocked
 * @returns {Object} The complete entry written to the log, including the timestamp.
 */
export function logViolation(violationData) {
    const history = getViolationsHistory();
    
    const entry = {
        timestamp: new Date().toISOString(),
        violation_type: violationData.violation_type,
        file_path: violationData.file_path,
        escalation_level: violationData.escalation_level,
        action_taken: violationData.action_taken,
        agent_diff_snippet: violationData.agent_diff_snippet,
        guardian_rationale: violationData.guardian_rationale
    };
    
    history.push(entry);
    
    // Write back to the file
    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
    
    return entry;
}
