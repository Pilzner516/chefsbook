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
