# Kiosk Edge Function Implementation Plan

The purpose of this architecture is to provide a secure, serverless bridge between an unprotected HTML Kiosk (running remotely or on an iPad) and the secure TimeTrack CRM PostgreSQL backend. The Edge Function acts as the authentication shield and proxy, converting simple PIN inputs into valid Row Level Security (RLS) bypassed SQL insertions.

> [!WARNING]
> The `backend/supabase/functions` directory was not found. This indicates that this will be the FIRST Edge Function in the project. We must establish the base structure correctly.

## 1. Directory & Import Structure

We will use standard Deno and `esm.sh` imports typical for Supabase Edge Functions.

**Expected Path:** `backend/supabase/functions/kiosk_ingestion/index.ts`

**Deno Imports:**
```typescript
// Standard HTTP server for Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Supabase JS Client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
```

## 2. CORS Headers Configuration

Since the Kiosk will be a plain HTML file hosted elsewhere (or run locally `file://`), we must enforce a strict CORS policy for preflight `OPTIONS` requests.

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust to specific domain if deployed behind Vercel/Netlify
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
```

## 3. JSON Payload Contract

The HTML Kiosk will send a standard `POST` request with a JSON payload.

**Request Body Interface:**
```typescript
interface KioskIngestionPayload {
  pin: string;               // The security PIN entered by the worker
  action: 'start' | 'stop';  // The tracking action
  project_id?: string;       // Optional UUID of a specific project
}
```

## 4. Security Flow (PIN -> Service Role)

The function will explicitly NOT use standard user JWTs, as the iPad Kiosk cannot safely store session tokens. Instead, it relies on static environment variable authorization.

1. **Pre-flight Check:** Automatically return HTTP 200 with `corsHeaders` for `OPTIONS` requests.
2. **Payload Parsing:** Parse the JSON body payload.
3. **PIN Validation:** 
   - Check the `pin` against `Deno.env.get('KIOSK_PIN')`.
   - If invalid, return **HTTP 401 Unauthorized**.
4. **Service Role Escalation:**
   - Initialize the `supabase` admin client using `Deno.env.get('SUPABASE_URL')` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. This bypasses PostgreSQL RLS.
5. **Data Enrichment & Insertion:**
   - Build the `time_entries` insertion payload.
   - Inject the hardcoded user identifier: `worker_id: Deno.env.get('KIOSK_USER_ID')`
   - Inject the hardcoded organization identifier: `organization_id: Deno.env.get('KIOSK_ORG_ID')`
   - Execute the Admin SQL `insert()` or `update()`.
6. **Response:** Return HTTP 200 on success, or HTTP 400 on error.

> [!IMPORTANT]
> The Service Role Key allows unrestricted read/write access to the database. It MUST NOT be exposed to the client. It is strictly injected within the Deno runtime environment.

## 5. Local `.env` Configuration & CLI Testing

To test this locally without leaking secrets, we must map environment variables using a local `.env` file when serving the function via Supabase CLI.

**File:** `backend/supabase/.env.local`
```env
KIOSK_PIN=1965
KIOSK_USER_ID=your-worker-uuid-here
KIOSK_ORG_ID=your-org-uuid-here
```

**Commands for the Tech Lead to execute:**

1. **Bootstrap the function directory:**
   ```bash
   cd backend
   supabase functions new kiosk_ingestion
   ```
2. **Start the local Edge Runtime with Env variables:**
   ```bash
   supabase functions serve kiosk_ingestion --env-file ./supabase/.env.local --no-verify-jwt
   ```
   *(Note: `--no-verify-jwt` is essential so Supabase local relay allows unauthenticated incoming traffic directly to our function).*

3. **cURL Payload Testing:**
   ```bash
   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/kiosk_ingestion' \
        --header 'Content-Type: application/json' \
        --data '{"pin":"1965", "action":"start"}'
   ```

## User Review Required

Tech Lead, please confirm:
1. Is the data payload (`pin`, `action`, `project_id`) sufficient, or do you need additional tracking data (e.g., GPS coordinates, device timestamp)?
2. Should the `KIOSK_PIN` be hardcoded in Deno Env, or evaluated against an active user table query (which is slower but dynamic)?
3. Shall we proceed with executing step 1 (`functions new`) and establishing the Deno template?
