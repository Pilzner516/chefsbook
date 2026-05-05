# Prompt: ChefsBook — ClamAV Virus Scanning for File Uploads

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/virus-scan.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY (server-side; no UI changes)

## Overview

All user file uploads to ChefsBook are currently unscanned. This session adds
ClamAV virus scanning as a server-side gate on every file upload endpoint.
ClamAV runs as a daemon on slux (already our production Linux server). A shared
utility `scanFile.ts` handles size cap, MIME magic-byte validation, and AV scan.
It is wired into the two existing upload routes. Graceful degradation: if the
daemon is unreachable, uploads log a warning and proceed (never block users due
to a monitoring outage).

No database migrations. No UI changes. No new plan gating.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Confirm ClamAV is installed on slux:
   ```bash
   ssh pilzner@slux "which clamd && systemctl status clamav-daemon --no-pager"
   ```
   If not installed, install it (see Infrastructure section below).

2. Confirm the ClamAV socket path:
   ```bash
   ssh pilzner@slux "ls -la /var/run/clamav/clamd.ctl"
   ```

3. Locate the two upload routes — read both files fully before touching either:
   - `apps/web/app/api/import/file/route.ts`
   - `apps/web/app/api/print-cookbooks/upload-cover/route.ts`

4. Confirm TypeScript compiles clean before starting:
   ```bash
   cd apps/web && npx tsc --noEmit
   ```

5. Check feature-registry.md — confirm virus scanning is NOT already listed as live.

---

## Infrastructure: Install ClamAV on slux (if not already present)

```bash
ssh pilzner@slux

# Install
sudo apt-get update
sudo apt-get install -y clamav clamav-daemon

# Update signatures (may take a few minutes on first run)
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam

# Enable and start daemon
sudo systemctl enable clamav-daemon
sudo systemctl start clamav-daemon

# Verify socket exists (may take 30s after start)
ls -la /var/run/clamav/clamd.ctl

# Check daemon health
sudo systemctl status clamav-daemon --no-pager
```

Signatures are auto-updated daily by the `clamav-freshclam` systemd service —
no manual maintenance required.

---

## Environment variables

Add to `.env.local` on slux (`/opt/luxlabs/chefsbook/repo/.env.local`) and
document in CLAUDE.md Infrastructure section:

```
CLAMAV_SOCKET=/var/run/clamav/clamd.ctl   # ClamAV daemon socket; omit to skip AV (dev only)
```

Do NOT add this to the monorepo root `.env.local` on the dev machine —
ClamAV is a server-only concern. The utility gracefully skips the scan if
the env var is unset (dev mode) or the socket is unreachable (graceful degradation).

---

## Implementation

### Step 1 — Install the `clamdjs` npm package

```bash
cd apps/web
npm install clamdjs
```

`clamdjs` provides a simple Node.js client for the ClamAV daemon over a Unix socket.

### Step 2 — Create `apps/web/lib/scanFile.ts`

This is the single shared utility called by all upload routes.

```typescript
import net from "net";
import { PassThrough } from "stream";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Allowed MIME types by magic bytes (first 8 bytes of file)
const MAGIC_BYTES: Record<string, string> = {
  "25504446":         "application/pdf",           // %PDF
  "504b0304":         "application/zip",            // PK.. (docx/xlsx/etc)
  "d0cf11e0":         "application/msword",         // DOC (legacy)
  "ffd8ffe0":         "image/jpeg",
  "ffd8ffe1":         "image/jpeg",
  "89504e47":         "image/png",
  "47494638":         "image/gif",
  "52494646":         "image/webp",                 // RIFF (check bytes 8-11 for WEBP)
};

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/zip",            // covers .docx, .xlsx
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type ScanResult =
  | { ok: true }
  | { ok: false; reason: "too_large" }
  | { ok: false; reason: "bad_mime" }
  | { ok: false; reason: "virus_detected"; threat: string }
  | { ok: false; reason: "scan_error"; message: string };

export async function scanFile(
  buffer: Buffer,
  originalMime?: string
): Promise<ScanResult> {
  // 1. Size check
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  // 2. Magic byte MIME validation
  const hex = buffer.slice(0, 4).toString("hex").toLowerCase();
  const detectedMime = MAGIC_BYTES[hex];
  if (!detectedMime || !ALLOWED_TYPES.has(detectedMime)) {
    return { ok: false, reason: "bad_mime" };
  }

  // 3. ClamAV scan (skip gracefully if socket not configured or unreachable)
  const socketPath = process.env.CLAMAV_SOCKET;
  if (!socketPath) {
    // Dev environment — no ClamAV; proceed
    console.warn("[scanFile] CLAMAV_SOCKET not set — skipping AV scan (dev mode)");
    return { ok: true };
  }

  try {
    const result = await scanWithClamd(buffer, socketPath);
    return result;
  } catch (err) {
    // Daemon unreachable — log and degrade gracefully
    console.error("[scanFile] ClamAV daemon unreachable — proceeding without scan:", err);
    return { ok: true };
  }
}

async function scanWithClamd(
  buffer: Buffer,
  socketPath: string
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let response = "";

    socket.on("error", reject);

    socket.on("connect", () => {
      // Use INSTREAM command: clamd reads chunks terminated by a zero-length chunk
      socket.write("zINSTREAM\0");

      // Write size (4-byte big-endian) + data
      const sizeBuf = Buffer.alloc(4);
      sizeBuf.writeUInt32BE(buffer.length, 0);
      socket.write(sizeBuf);
      socket.write(buffer);

      // Terminate with zero-length chunk
      const end = Buffer.alloc(4); // all zeros
      socket.write(end);
    });

    socket.on("data", (chunk) => {
      response += chunk.toString();
    });

    socket.on("end", () => {
      // Response format: "stream: OK\0" or "stream: Eicar-Test-Signature FOUND\0"
      const clean = response.replace(/\0/g, "").trim();
      if (clean.endsWith("OK")) {
        resolve({ ok: true });
      } else if (clean.includes("FOUND")) {
        const threat = clean.replace(/^stream:\s*/, "").replace(/\s*FOUND$/, "");
        resolve({ ok: false, reason: "virus_detected", threat });
      } else {
        resolve({ ok: false, reason: "scan_error", message: clean });
      }
    });
  });
}
```

### Step 3 — Wire into `/api/import/file/route.ts`

Read the existing route fully before modifying. Find where the file buffer is read
from the multipart form data. Add the scan call immediately after reading the buffer,
before any parsing or storage:

```typescript
import { scanFile } from "@/lib/scanFile";

// After reading file buffer from formData:
const scan = await scanFile(buffer, file.type);

if (!scan.ok) {
  if (scan.reason === "too_large") {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }
  if (scan.reason === "bad_mime") {
    return NextResponse.json({ error: "File type not allowed" }, { status: 422 });
  }
  if (scan.reason === "virus_detected") {
    return NextResponse.json({ error: "File rejected for security reasons" }, { status: 422 });
  }
  // scan_error falls through (graceful degradation already handled in scanFile)
}
// ... existing logic continues
```

### Step 4 — Wire into `/api/print-cookbooks/upload-cover/route.ts`

Same pattern as Step 3. The cover upload is an image (JPEG/PNG/WebP). The scan
catches oversized covers and any malicious image files before they reach Supabase Storage.

---

## CLAUDE.md updates (make these changes)

### Add to Infrastructure section:

```markdown
- **Virus scanning**: ClamAV daemon on slux, socket at /var/run/clamav/clamd.ctl.
  All user file uploads scanned via `apps/web/lib/scanFile.ts` before parsing or storage.
  `CLAMAV_SOCKET` env var sets socket path (omit to skip in dev — graceful degradation).
  If daemon is unreachable, uploads log a warning and proceed (never hard-blocks users).
  Check daemon health: `ssh pilzner@slux "systemctl status clamav-daemon --no-pager"`
  Signatures auto-updated daily by `clamav-freshclam` systemd service.
```

### Add to Environment variables table:

```
CLAMAV_SOCKET=/var/run/clamav/clamd.ctl     # ClamAV daemon socket (slux only; omit in dev)
```

---

## Feature registry update

Add this row to `.claude/agents/feature-registry.md`:

```
| Virus scanning | ✅ Live | ClamAV daemon on slux; scanFile() called in /api/import/file
|                |         | and /api/print-cookbooks/upload-cover; 20MB cap; magic-byte
|                |         | MIME check; graceful degradation if daemon unreachable |
```

---

## Testing

### 1. TypeScript — must be clean before and after

```bash
cd apps/web && npx tsc --noEmit
```

### 2. EICAR test — virus detection (run on slux after deploy)

Create a plain text file containing exactly this string (it is a safe, standard
AV test string — not a real virus):

```
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
```

Upload it via the file import endpoint:
```bash
curl -X POST https://chefsbk.app/api/import/file \
  -H "Authorization: Bearer <user_jwt>" \
  -F "file=@eicar.txt;type=application/pdf"
```
Expected: HTTP 422, body contains "File rejected for security reasons"

### 3. Clean file — normal operation

Upload a valid PDF recipe file.
Expected: imports successfully, HTTP 200.

### 4. Oversized file — size cap

Upload or simulate a file > 20 MB.
Expected: HTTP 413, "File too large"

### 5. Wrong MIME type — magic byte detection

Rename a `.exe` or `.sh` file as `recipe.pdf` and upload it.
Expected: HTTP 422, "File type not allowed"
(Magic bytes reveal the true type — the extension is ignored.)

### 6. Cover upload — print cookbook route

Upload a valid JPEG cover image via `/api/print-cookbooks/upload-cover`.
Expected: succeeds as before.

Upload the EICAR file renamed as `cover.jpg`.
Expected: HTTP 422, rejected.

### 7. Daemon graceful degradation

On slux, temporarily stop the daemon, then upload a clean file:
```bash
ssh pilzner@slux "sudo systemctl stop clamav-daemon"
# upload a clean file via the API
ssh pilzner@slux "sudo systemctl start clamav-daemon"
```
Expected: upload succeeds (with a warning logged), daemon restarts cleanly.

---

## Deploy

Follow `deployment.md`.

Before deploying:
1. Confirm ClamAV daemon is running on slux (pre-flight step 1 above).
2. Add `CLAMAV_SOCKET=/var/run/clamav/clamd.ctl` to `/opt/luxlabs/chefsbook/repo/.env.local` on slux.
3. Deploy web: `ssh pilzner@slux && /opt/luxlabs/chefsbook/deploy-staging.sh`
4. Run the EICAR test against the deployed endpoint before wrapup.
5. Run the regression smoke test from `testing.md`.

---

## Wrapup

Follow `wrapup.md` fully.

After wrapup, confirm the following are done:
- [ ] CLAUDE.md Infrastructure section updated with ClamAV details
- [ ] CLAUDE.md env vars table updated with `CLAMAV_SOCKET`
- [ ] feature-registry.md updated with virus scanning row
- [ ] DONE.md entry written with session name VIRUS-SCAN
- [ ] EICAR test passed against production endpoint
- [ ] `clamav-freshclam` confirmed running (`systemctl status clamav-freshclam`)
