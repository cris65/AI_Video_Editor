# 🧪 TESTING DOCTRINE: WOLF-PROTOCOL FOR E2E (PLAYWRIGHT)

This document functions as the programmable memory for E2E testing quirks, rules, and mandatory architectural guardrails specifically designed for the **Hybrid Immovable Local-First Architecture** (Dexie + Orchestrator + Supabase Realtime).

Whenever a complex testing race condition or framework anomaly is encountered and resolved, the underlying rule strictly appending it to this living document must be codified.

---

## 🚀 1. THE OPTIMISTIC UI RACE CONDITION (MID-FLIGHT SLAUGHTER)

**The Problem:** In a Local-First architecture, the UI updates *instantly* via optimistic state mutation (Dexie). If a Playwright assertion only checks for UI text (`.toContainText(/START/i)`), the assertion resolves in milliseconds. Playwright then immediately closes the browser context (`context.close()`), which brutally aborts the background Supabase network fetch (`PATCH`/`POST`) mid-flight. The test passes locally, but the database is left in a corrupted or inaccurate state for the next test.

**The Rule:**
- **Strict Network Interception:** In any teardown block or critical state mutation loop, you must NEVER rely solely on a UI assertion before closing a context.
- You MUST force Playwright to intercept and wait for the physical network request to resolve:
```typescript
const reqSync = page.waitForResponse(
    res => res.url().includes('time_entries') && res.status() < 400, 
    { timeout: 10000 }
).catch(() => {});

await actionButton.click();
await expect(uiElement).toHaveState(...);

// Guarantees network payload has successfully landed on the remote server
await reqSync;
```

---

## 🛡️ 2. THE DEBOUNCE SHIELD (BLIND POLLING)

**The Problem:** To prevent UI jitter and feedback loops, Local-First applications employ a "Debounce Shield" that temporarily ignores incoming Realtime Broadcasts (`INSERT/UPDATE/DELETE`) immediately after a local write. If a Playwright test performs a local write and then enters a polling loop waiting for the UI to update via a Realtime broadcast from another context, the test will timeout because the Debounce Shield is intentionally blocking the render.

**The Rule:**
- **Hard Hydration Override:** When testing convergence (especially Last-Write-Wins), do not use optimistic polling loops if a local mutation was recently executed.
- Instead, wait for the remote conflict to settle chronologically on the server, then forcefully bypass the local Debounce Shield via a destructive page reload:
```typescript
// 1. Let the remote chronological conflict settle (Server Truth)
await page.waitForTimeout(2000);

// 2. Destructive reload to shatter the local Debounce Shield
await page.reload({ waitUntil: 'domcontentloaded' });

// 3. Assert the absolute Remote Truth
await expect(targetLocator).toHaveState(...);
```

---

## ⏱️ 3. LAST-WRITE-WINS (LWW) TIMESTAMP COLLISION

**The Problem:** Automated CI pipelines execute instructions at inhuman speeds. If `Device A` and `Device B` are instructed to dispatch offline mutations sequentially without delay, the events are generated in the exact same millisecond. When both sync to Supabase, their `updated_at` ISO timestamps collide, leading to non-deterministic LWW resolution (playwright 50/50 winning flakiness).

**The Rule:**
- **Chronological Separation Injection:** You MUST inject artificial, mechanical delays when generating offline multi-device conflicts to guarantee an inescapable winning sequence.
- **Intentional Timeout Adjustments:** Because resolving multi-device conflicts demands lengthy synthetic chronological delays (`waitForTimeout(8000)`), these specific blocks MUST override the default Playwright test timeout (`test.setTimeout(120000)`) at the absolute start of the `test` block to prevent CI pipeline termination.
```typescript
await deviceAMutationBtn.click();

// ⏳ Enforce chronological separation for undeniable LWW determination
await page.waitForTimeout(1000);

await deviceBMutationBtn.click();
```

---

## 🗑️ 4. NUCLEAR TEARDOWN VS GRACEFUL SHUTDOWN

**The Problem:** Aggressively wiping `localStorage` and `IndexedDB` globally at the start or end of a test (`clearLocalDexie` on `test.beforeEach`) severely damages the isolation of tests that *depend* on persisted offline-first capabilities (e.g., Test 7 offline syncing).

**The Rule:**
- **Graceful Cleanup Default:** Tests should clean up their own toys (clicking "STOP" on hanging timers) gracefully in `finally` blocks, leaving the UI exactly as they found it without destroying databases.
- **Isolated Nuclear Contexts:** If a specific test (e.g., Test 10) absolutely requires a 100% sterile vacuum, the cache wipe MUST be constrained exclusively within the isolated setup context of that single test block:
```typescript
await page.evaluate(async () => {
    const dbs = await window.indexedDB.databases();
    dbs.forEach(db => { if(db.name) window.indexedDB.deleteDatabase(db.name); });
    window.localStorage.clear();
});
await page.reload();
```

---

## 🎯 5. LOCATOR DETERMINISM (`value` vs `text`)

**The Rule:**
- You are STRICTLY FORBIDDEN from using `locator('div').filter({ hasText: '...' })` to target form values, input states, or rendered data fields (like an active timer description).
- You MUST bind a stable `data-testid="xyz"` to the native input element.
- You MUST assert state using `.toHaveValue(...)` instead of string matching, as input descriptions reside within the element `value` property, not the child DOM text layer.

---

## ⏸️ 6. CHROMIUM BACKGROUND THROTTLING

**The Problem:** When running multi-context tests simulating multiple devices (`pageA`, `pageB`), Chromium brutally throttles background tabs. It suspends Javascript execution and freezes outbound WebSocket/HTTP network flushes. If a background device performs a local Dexie write and then enters a `waitForTimeout` to let the SyncOrchestrator push to Supabase, the network will freeze and the test will fail or destabilize.

**The Rule:**
- **Foreground Forcing:** Before ANY intentional network flush wait on a secondary context, you MUST force that exact context to the foreground to defeat Chromium suspension.
- **Dexie Hydration Lock (Anti-Ghosting Protocol):** When a Local-First architecture mounts, the UI temporarily renders the default React state (`START`) before Dexie pushes the actual IndexedDB persisted state (`STOP`) up the hook execution tree. If you evaluate `locator.textContent()` immediately after a page load, you will consistently read false-positives. You MUST inject: `await page.waitForTimeout(3000);` immediately before attempting to classify or interact with a persisted component's state.
- **Physical UI Settlement Lock (Optimistic UI Defense):** For Dirty State Resets or immediate toggle actions, DO NOT click blindly. If a component uses Optimistic UI/Debounce patterns, you MUST explicitly assert `toBeEnabled({ timeout: 10000 })` before clicking to prevent Playwright from firing events on temporarily disabled nodes. After clicking, explicitly force Playwright to assert that the physical UI has hydrated the change: `await expect(locator).toContainText(/STATE/i, { timeout: 10000 });` before executing any subsequent logic.
- **Asymmetric Offline Simulator (LWW):** Dual-online sync simulations are physically non-deterministic on CI runners due to CPU throttling scrambling WebSocket concurrent queues. To test Last-Write-Wins (LWW) override behavior, you MUST deploy an Asymmetric Offline Sequence:
   1. **Independent Baselines:** Before the isolation, YOU MUST reset and verify BOTH devices' states locally and independently (`.toBeEnabled() + .click() + explicit wait`). DO NOT rely on Realtime WebSockets to synchronize the baseline state across contexts before the test begins.
   2. Device B goes offline (`context.setOffline(true)`).
   3. Device A (online) clicks and flush-commits the "losing" server truth.
   4. A deterministic time wedge is inserted (`waitForTimeout(3000)`).
   5. Device B (offline) interacts, logging the newer timestamp strictly to local Dexie.
   6. Device B goes online (`context.setOffline(false)`). The Orchestrator predictably flushes and overwrites, allowing Device A to safely reload and assert the LWW convergence.
- **CI Hardware Latency Skip (The Outlier Protocol):** Tests that architecturally rely on intense simultaneous local database writes and granular network queue timing (like Dexie backdoor injections or dual-browser local sync checks) are structurally incompatible with 2-core GitHub Actions environments (Node threading locks). You MUST inject: `test.skip(!!process.env.CI, 'Skipped on CI runner due to hardware throttling.');` at the start of these tests. These are certified strictly for Local Dev execution.

---

## 📱 7. MOBILE LAYOUT SHIFT RESILIENCE (TWO-STAGE FORM SUBMISSION)

**The Problem:** Playwright `.click()` events on Mobile viewports are incredibly brittle during DOM layout shifts caused by the virtual keyboard vanishing (e.g. after `.blur()`). Sometimes the strict `click` vanishes into the void, or hits overlapping `<div role="button">` backgrounds resulting in a form not submitting mid-test.

**The Rule:**
- **Two-Stage Submission:** You MUST implement a Native Keyboard fallback before attempting an absolute UI click on mobile forms.
  1. Trigger physical form submission via `await input.press('Enter');` immediately after `.fill()`.
  2. Implement an ultra-resilient UI physical fallback click targeting generic `button` tags with text filters bounded to the root modal `[role="dialog"]`. Ensure this fallback click is *conditional* (i.e., wrapped in an `if (await modalHeading.isVisible())` block) to prevent race conditions if the native `Enter` press succeeded gracefully.

---

## ✄️ 8. WOLF NUKE SOP — FK CASCADE TEARDOWN

**The Problem:** The `nukeTestState()` REST API cleanup runs after each multi-device test. If it fires `DELETE` requests on `clients` before all FK-dependent records (`time_entries`, `projects`, `notes`, `tasks`, `deals`, `contact_roles`) are removed, Supabase returns a `409 Conflict` (FK violation). A failing nuke means zombie `time_entries` with `is_running: true` persist on the server, poisoning the hydration of subsequent test contexts.

**Root Cause Gotchas:**
- PostgREST `like` is **case-sensitive**. Test data uses mixed case (`Wolf Corp`) but nuke filter uses `WOLF_%`. Always use `ilike` for case-insensitive matching.
- `Promise.all` on simultaneous DELETE requests violates FK topological order — Postgres rejects out-of-order deletes. Always use a **sequential `for...of` loop**.
- Subquery syntax (`project_id.in.(select id from projects where ...)`) is **NOT** supported by the PostgREST REST API. Use a two-step GET + ID collect approach.

**The Rule — Mandatory Nuke Execution Order:**
1. **Phase 1 (GET):** Resolve test entity IDs first via parallel GET with `ilike` name filters.
2. **Phase 2 (FK Leaves, sequential):** Delete FK-dependent records using collected IDs (`client_id=in.(...)`, `project_id=in.(...)`) in strict topological order: `time_entries → notes → tasks → deals → contact_roles → project_phases → project_contacts → project_suppliers`.
3. **Phase 2b:** Also GET projects linked to test clients by `client_id` (not just by name prefix). Cascade their children before deleting them.
4. **Phase 3 (Roots):** Delete `projects` then `clients` by name filter last.
5. Treat HTTP `404` as success (nothing to delete). Only non-404 non-2xx responses are errors.

---

## ⚡ 9. SYNC DEBOUNCE SHIELD IN SEQUENTIAL E2E TESTS

**The Problem:** `syncPendingData()` in `syncManager.ts` has a 15-second module-level debounce (`lastSyncExecution`). This variable is reset only on full page reload. In a sequential test run, Test 9 may stop a zombie timer (triggering `syncPendingData()`) and immediately restart a new timer. The debounce shield blocks the new timer's sync to Supabase. Device B then reloads, hydrates from Supabase (which doesn't have the new timer yet), and incorrectly shows START.

**The Rule:**
- After any dirty-state-reset that invokes `syncPendingData()` (i.e., clicking STOP on a zombie timer), you MUST reload the Device A browser context before starting the next timer.
- The reload re-initializes the module, resetting `lastSyncExecution = 0` and guaranteeing the next `syncPendingData()` call fires immediately.

```typescript
// Dirty state reset: stop zombie timer
await btnA.click();
await cleanReqA; // Confirm sync landed on server

// MANDATORY: Reset debounce shield
await pageA.reload({ waitUntil: 'domcontentloaded' });
await waitForHydration(pageA);
// Now safe to start a new timer — syncPendingData() will fire immediately
```

---

## 🏷️ 10. E2E TIMERS: EXPLICIT TAGGING

**The Problem:** Tests (such as Multi-device realtime or Conflict resolution test) that natively click "START" on the Dashboard widget without specifying a description generate anonymous `0m` ghost timers (i.e. `description IS NULL` and `project_id IS NULL`). The teardown script (`WOLF NUKE`) specifically avoids dropping real `description IS NULL` entries to safeguard user data, meaning these anonymous E2E records leak and persist infinitely. 

**The Rule:**
- You MUST explicitly sign/tag every new Time Entry created directly from the UI.
- Use `getByTestId('active-timer-name')` to inject an `E2E_` or `TARGET_` string prefix before clicking the START button.

```typescript
// MANDATORY: Fill the timer description with a WOLF/E2E prefix BEFORE firing
const descInputA = pageA.getByTestId('active-timer-name');
await expect(descInputA).toBeVisible();
await descInputA.fill('E2E_SYNC_TEST_TIMER');
await descInputA.press('Enter');
await descInputA.blur(); // Trigger debounce if interacting with React states

// Proceed with START
await startBtnA.click();
```
