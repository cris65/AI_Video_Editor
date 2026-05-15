### 🗺️ EVOLUTION (Roadmap & Backlog)

**Current Version:** v0.7.156 - 2026-04-29 **Mantra:** "See it. Click it. Route
it." (Ubiquitous UI Routing).

This document is the forward-looking roadmap. For architectural details on
implemented features, refer to `SOTA.md`.

---

## 🎯 NOW (Current Sprint: UX/UI & Deep Navigation)

**Objective:** Eliminate friction in finding, moving, and connecting existing
data, and solidify the basic data architecture.

- [ ] **Ubiquitous Routing (Label Links):** Every label, tag, or badge
      representing an entity (Project, Client, Phase) must be a clickable
      hyperlink navigating directly to its detail view.
- [ ] **Deep/Complete Search inside Projects:** Replicate the robust Global
      Search & Filter Engine directly inside the Project details views
      (specifically for Tasks and Tracks). Currently absent, forcing users to
      rely entirely on global routes.
- [ ] **Bulk Actions (Global & Project-Scoped):**
  - Checkbox multi-selection UI across Thoughts, global Tracks, and contextual
    Project Tracks/Tasks.
  - **"Select All" Capability:** An instant toggle to capture all currently
    filtered/rendered items in massive lists (essential for fast triage).
  - Floating Action Bar for selected items.
  - Mass-operations: Delete, Move to List, and **Link to Project/Phase**
    (critical for assigning large batches of legacy tracked hours).
- [x] **The Universal 'LOG' Archetype:** ✅ Shipped. `archetype: 'log'` entities
      via `jsonb` payloads. Boolean, numeric, and state metrics fully supported.
      Smart Coercer maps string values (`"YES"`, `"SI / YES"`, `true`) to
      chart-ready numerics. `ComposedChart` dual-axis visualization with habit
      adherence ratio micro-cards (`trueCount/totalCount`).
- [x] **The Kiosk Field Test:** ✅ Shipped & stabilized. Multi-tenant, 100%
      agnostic ingestion pipeline via `ingest-log` Edge Function (Deno 2
      `Deno.serve()`). Ownership derived cryptographically from `parent_log_id`
      — zero hardcoded env secrets. JWT bypass permanently locked in
      `config.toml`. Deployed to production.
- [ ] **Kiosk QR & Share Utility (Last Mile Distribution):** Enhance the
      existing `KioskQR` modal (already embedded in `LogTrackerView`) with two
      zero-friction sharing actions:
  - **Copy Link:** One-click clipboard copy of the Kiosk URL with a "✓ Copied!"
    transient confirmation state.
  - **WhatsApp Share:** A direct `https://wa.me/?text=` deep-link pre-populating
    the Kiosk URL — the primary last-mile sharing channel for field teams and
    sub-contractors on mobile.

---

## 🚀 NEXT (Upcoming Modules)

**Objective:** Complete Phase 4 features to fully seal the operational CRM
lifecycle and introduce reporting.

- [ ] **The Financial Layer (Orders & Billing Engine):**
  - **Separation of Concerns:** Introduce the `Order` (Commessa) entity (using
    the universal `notes` table with `archetype: 'order'`) as a child of
    `Project`. Projects remain the pure operational container (Where/What),
    while Orders act as the financial/contractual shield (Budget/Billing).
  - **The 4 Billing Archetypes:** Native support within `projects` for:
    - _Fixed Price_ (A Corpo / Preventivo).
    - _Hourly Rate_ (A Consuntivo / Time & Materials).
    - _**Prepaid Bundle**_ (A Consumo / Monte Ore): Tracked time depletes a
      pre-paid reservoir. Orders here are vital as they represent the
      "recharges" purchasing new blocks of hours.
    - _Recurring / Retainer_ (Canone Ricorrente mensile/annuale).
  - **Order-Driven Financial Logic:** The financial health of a project is
    calculated dynamically based on its `billing_type` and the aggregation of
    its associated `order` notes.
- [ ] **Ubiquitous Thought Engine (Ghosting & CoW):** Implement "Alias"
      references for Notes/Thoughts, allowing a single note to exist in multiple
      lists simultaneously. Include a "Detachment" (Copy-on-Write) flow to
      branch notes into independent entities while preserving their historical
      lineage in `jsonb`.
- [ ] **Dynamic Custom KPIs:** Introduce customizable Dashboard/Project widgets
      capable of reading and aggregating values from list metadata or extracting
      specific datapoints from LOG `jsonb` payloads.
- [ ] **Archetype Customization Engine:** A dedicated configuration panel to
      manage entity archetypes (Notes, Expenses, Logs, etc.), allowing
      customization of colors, icons, and behavioral rules (e.g., `is_readonly`,
      `allows_time_tracking`).
- [ ] **Storage Buckets:** File and linked document management via Supabase
      Storage integration within Projects and Notes.
- [ ] **Nested Lists (Folder Hierarchy):** Evolve the flat list architecture for
      thoughts into a recursive UI. Allow users to drag a list entirely inside
      another list (like traditional file system folders) via D&D, requiring a
      structural DB expansion (`parent_list_id`).
- [ ] **Design System Refinement:** Replace native HTML inputs with custom
      Headless UI components to finalize the deep dark aesthetic.
- [ ] **Timeline Evolution (Gantt-lite) & Proactive UX:**
  - **Phase 1 (Core Interactivity):** Implement Drag & Drop (D&D) to shift
    entire Phases along the time axis, and Edge Resizing via handles to
    stretch/shrink durations.
  - **Phase 2 (Relations):** Visual dependency links (e.g., "Finish-to-Start"
    arrows) between Phases.
- [ ] **Kiosk Expenses (Public Receipt Ingestion):** Extend the agnostic Kiosk
      architecture with a dedicated unauthenticated public form for petty cash
      submissions and external receipt capture. Incoming payloads are classified
      as `archetype: 'expense'` and routed directly into the parent Project's
      Expense Hub via the same `parent_log_id` cryptographic anchor. Designed
      for field teams, sub-contractors, and site managers who lack CRM access
      but generate reimbursable costs.
- [ ] **Kiosk Meet/Booking (2-Way Calendar Sync):** A zero-login slot-booking
      module that reads CRM user availability (respecting existing calendar
      events and manual blocks) and exposes a lightweight public booking form
      via a unique QR or shareable link. Confirmed bookings sync back into the
      CRM Calendar Hub as structured `archetype: 'meeting'` entities. Designed
      as a self-hosted Calendly alternative for freelancers and agencies running
      on tAImetrack.
- [ ] **Public Visitor Kiosk & CRM Triage System:** A public-facing UI
      (tablet/screen) designed for zero-friction visitor registration at
      physical premises.
  - **Architecture:** Communicates via a strict POST-only, Write-Only endpoint
    ensuring total data isolation.
  - **Triage Buffer (`kiosk_entries`):** Data flows into a dedicated buffer
    table to prevent polluting core CRM entities (like Leads). Fields include:
    `name`, `email`, `company`, `notes`, `category` (Reason for visit), and
    `status` (pending/processed).
  - **CRM Reception Dashboard:** A dedicated internal triage view for users to
    process incoming visitor logs.
  - **Category-Based Routing:** Smart promotion paths: "Sales/Info" → Lead;
    "Meeting" → Linked to Client/Project; "HR/Interview" → HR Pipeline;
    "Delivery" → Archived as security log.
- [ ] **Outbound Email Routing Strategy (Transactional Emails):** A two-phased
      approach for CRM and Kiosk auto-replies and alerts.
  - **Phase 1 (Zero-Friction MVP):** The system natively provisions sub-routed
    addresses (e.g., `[tenant-name]@taimetrack.cloud`). This ensures immediate
    time-to-value, allowing users to test auto-replies instantly without
    touching DNS records.
  - **Phase 2 (Bring Your Own Domain):** Enterprise integration via an
    `Email & Communications` settings panel. Supports direct SMTP integration
    and Domain Verification (SPF/DKIM TXT records) for complete white-label
    sending.

---

## 🅿️ THE PARKING LOT (Backlog & Advanced R&D)

**Objective:** Parked features and massive architectural shifts reserved for
future phases.

- **The "GOD TRANSFORMER":** Advanced global state mutation and entity
  conversion logic (Log reserved).
- **Enterprise Reporting & AI:** Advanced predictive modeling for project delays
  and budget overruns based on historical tracking data.
- **Financial Node Compositor (DAG Architecture):** Visual Node-Based
  Aggregation Engine (`React Flow`) for mapping Cashflow, Revenue Streams, and
  Cost Centers organically without rigid folders.

---

## 🧲 TRACTION & ECOSYSTEM (Future Growth Vectors)

**Objective:** High-leverage utilities and platform extensions designed to
trigger viral B2B acquisition loops and massive enterprise lock-in.

### 🎣 Vertical Traction Hooks (B2B Lock-in Mechanisms)

- **Local-First Media Router (The Videomaker Hook):** A free "Zapier
  alternative" designed specifically for routing heavy media files (e.g.,
  Frame.io to Google Drive).
  - _The Mechanism:_ Instead of moving Terabytes of video files through our
    cloud (which would generate bankrupting bandwidth costs), tAImetrack acts
    purely as the Webhook Switchboard.
  - _The Execution:_ An ultra-lightweight Local Agent (e.g., a Go binary or Node
    CLI) installed on the creative agency's computers listens to the CRM's
    Supabase Realtime channel. When it receives the webhook trigger, the agent
    executes the transfer locally (via `rclone`), utilizing the agency's own
    internet bandwidth.
  - _The Trap:_ Creative agencies adopt the ecosystem to avoid expensive
    Zapier/Make.com bandwidth limits, creating an instant enterprise lock-in.
    Once inside the ecosystem, the natural friction to upsell them to the core
    CRM (for project billing, margin calculation, and time tracking) is
    practically zero.

### 🕸️ Core Ecosystem Integrations

- **PLG Freemium Funnel (Triple-Layer Trojan Horse Pipeline):** A deliberate,
  three-tier product-led growth strategy that converts free utility users into
  paying CRM subscribers without traditional sales friction.
  - **Layer 1 — Chrome Extension (Lead Magnet):** Free full-page screenshot tool
    with a proprietary tAImetrack watermark. Zero sign-up required. Maximum
    viral surface area. Converts passive brand exposure into email capture and
    CRM trial invitations.
  - **Layer 2 — Kiosk & Log Engine (Free Sandbox):** The `/kiosk/:id` public
    endpoints allow non-users to interact with a CRM user's data tracker —
    effectively experiencing the platform's value without an account. Each
    submission trains the lead on the value of structured data capture. The
    habit loop is set before the paywall is ever mentioned.
  - **Layer 3 — PRO/ENTERPRISE Upsell (The Reveal):** Once leads have
    experienced Layers 1 or 2, the CRM's full feature set (Financial Layer,
    Calendar Sync, Multi-user, Reporting) is revealed. The user is already
    invested in the ecosystem — conversion is a natural next step, not a cold
    sale.
- **The Unauthenticated Kiosk Engine (Trojan Horse):** Generation of isolated,
  unauthenticated React UI endpoints (`/kiosk/:id`) driven by DB JSON
  configurations. Allows non-users to pump specific, permitted field data
  directly into the premium user's CRM.
  - _Context:_ Intentionally public (no JWT verification) to ensure maximum
    zero-friction accessibility for non-digitalized users on legacy devices.
  - _Security Enhancements (Pre Pro-Tier Launch):_
    - **Honeypot Technique:** Add a hidden form field (e.g., `email_confirm`)
      invisible to humans via CSS. The `ingest-log` Edge Function must
      immediately discard any submission where this field is populated
      (detecting bot automation).
    - **Contextual Rate Limiting:** Implement IP-based throttling in the
      Supabase Edge Function. Set a generous threshold (e.g., 100 logs/minute
      per IP) to allow high-concurrency scenarios like mass training sessions or
      site-wide Wi-Fi, while blocking high-frequency DDoS or spam attacks.
    - **CORS Lockdown:** Explicitly restrict Edge Function headers to accept
      requests only from the production domain (`app.taimetrack.cloud`).
  - _Validated Use Cases (To guide future UI/UX):_
    - **Mass Training/Safety Briefings:** Support 40+ concurrent scans in a
      single room (Training Log).
    - **Fleet/Vehicle Management:** QR codes on dashboards for sub-contractors
      (Vehicle Log).
    - **On-Site Maintenance:** Physical QR stickers on hardware/doors for
      technical logs (Maintenance Log).
    - **Customer Feedback:** Public-facing QR for direct issue reporting into
      the CRM (Support Log).
- **Standalone Chrome Extension (Snapshot Lead Magnet):** Free full-page
  screenshot capturing tool that automatically injects a "Generated by
  tAImetrack" proprietary watermark. Designed as a high-priority viral
  distribution channel.
- **Open Plugin Architecture (The Obsidian Model):** Expose safe internal APIs
  allowing users to build custom JS/React extensions (e.g., specific local
  accounting exporters) without cluttering the main CRM codebase. Includes
  direct Local-First file sync capabilities for integrations with
  Obsidian/Joplin via flat `.md` files.
- **The "Client Portal" (Magic Links):** Generate beautiful, zero-login
  Read-Only timelines for specific projects, enabling agencies to share
  real-time progress externally.
- **The Universal Timer (Chrome Extension):** A floating widget that injects the
  tAImetrack "Start Timer" hook directly inside enemy territory (interfaces of
  Trello, Github, Jira, Asana).
- **Automated Proposal Generator:** 1-Click extraction of tracked hours,
  materials, and phases into branded PDF Statements of Work.

---

## 🏛️ THE ARCHIVE (Completed Phases Summary)

- **Phase 1 (Immortal Core):** Trinity Stack, local-first offline resilience,
  persistent timer.
- **Phase 2 (Operational CRM):** Unified thoughts, global search, universal
  alert engine, client hubs.
- **Phase 2.5 (WOLF Protocol Quality Barrier):** Strict Local-First Testing
  Doctrine. End-to-End (E2E) Playwright testing pipeline built locally and
  definitively migrated to automated CI/CD via GitHub Actions.
- **Phase 3 (Drag & Drop Engine):** Universal D&D, Kanban boards (Deals Pipeline
  & SMART Project Transformer), Sync Orchestrator, Zero-Spread DB hardening.
- **Phase 4 (Calendar & Overlays):** Calendar Hub, Mobile Drawers, Dual-Gate
  Filter Engine, RRULE Recurrence, Expense Tracking Hub, Z-Index/Portal
  Architecture mapped. Refined the Financial Paradigm: Expenses and revenues display as absolute numbers. Direction (in/out) is exclusively communicated through semantic color coding (Emerald=Income, Rose=Expense) with zero positive or negative signs in the UI.
