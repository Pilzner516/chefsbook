# ChefsBook — Session: Fix Hanging Upload + Upload Indicator UX
# Source: Emulator screenshot — upload hangs indefinitely, indicator unreadable
# Target: apps/mobile

---

## CONTEXT

From the emulator screenshot, the image upload is triggering (the "Uploading..." state is
reached) but hangs indefinitely and never completes or fails. The upload indicator is also
nearly invisible — light pink text on cream background.

Fix both issues. Read CLAUDE.md before starting.

---

## FIX 1 — Diagnose and fix the hanging upload

The upload reaches `FileSystem.uploadAsync` but never resolves. Work through these checks:

### 1a — Confirm the Supabase URL is reachable from the emulator

The emulator is a separate virtual device. It cannot reach `rpi5-eth` (a Tailscale hostname)
directly — it needs the Tailscale IP address.

In the upload function, log the full upload URL before the request:
```ts
console.log('Upload URL:', uploadUrl);
console.log('File URI:', localUri);
console.log('Session token (first 20 chars):', session.access_token?.substring(0, 20));
```

Check Metro logs. If the URL contains `rpi5-eth` instead of `100.110.47.62`, the emulator
cannot resolve it and the request hangs silently.

**Fix:** In `@chefsbook/db` or wherever `SUPABASE_URL` is defined for mobile, ensure it uses
the Tailscale IP `http://100.110.47.62:8000` (or whatever port Supabase is on) — not a
hostname that only resolves on the host machine.

Also confirm `adb reverse` is not needed for this — unlike Metro (which uses port forwarding),
Supabase on RPi5 is a real network service accessible via Tailscale IP directly.

### 1b — Add a timeout to the upload

`FileSystem.uploadAsync` can hang indefinitely if the server is unreachable. Add a timeout:

```ts
const uploadPromise = FileSystem.uploadAsync(uploadUrl, localUri, {
  httpMethod: 'POST',
  uploadType: FileSystem.FileSystemUploadType.MULTIPART,
  fieldName: 'file',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_ANON_KEY,
  },
});

const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('Upload timed out after 30s')), 30000)
);

const response = await Promise.race([uploadPromise, timeoutPromise]);
```

This ensures the upload either completes or fails with a clear error within 30 seconds.

### 1c — Log the full response

After the upload resolves, log the complete response:
```ts
console.log('Upload response status:', response.status);
console.log('Upload response body:', response.body);
```

If the status is not 200, log the body — it will contain the actual error from the Supabase
Storage API.

### 1d — Handle upload errors gracefully

Currently when the upload fails or times out the UI may stay in "Uploading..." forever.
Add proper error handling:

```ts
try {
  const publicUrl = await uploadPhoto(localUri, recipeId);
  // success path
} catch (error) {
  console.error('Upload error:', error);
  // Show error state in UI — see Fix 2 below
  setUploadState('error');
}
```

---

## FIX 2 — Replace the upload indicator with a visible red pill

### Current state
"Uploading..." is rendered as light pink text on the cream placeholder background —
nearly invisible.

### Target state

In the image placeholder zone (the dashed box in EditImageGallery), when an upload is
in progress show a centered red pill with white bold text:

```tsx
// Uploading state
{uploadState === 'uploading' && (
  <View style={{
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  }}>
    <View style={{
      backgroundColor: colors.accent,   // pomodoro red #ce2b37
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    }}>
      <Text style={{
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
      }}>
        Uploading...
      </Text>
    </View>
  </View>
)}
```

Also add distinct states for error and success:

```tsx
// Error state — shown if upload fails
{uploadState === 'error' && (
  <View style={{ /* same centering */ }}>
    <View style={{ backgroundColor: colors.accent, /* same pill style */ }}>
      <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
        Upload failed — tap to retry
      </Text>
    </View>
  </View>
)}
```

The error pill is tappable and retries the upload when tapped.

The placeholder dashed border and chef's hat watermark remain visible behind the pill
in both states — the pill overlays them, it does not replace the whole zone.

---

## COMPLETION CHECKLIST

- [ ] Upload URL logged in Metro — confirm it uses Tailscale IP not hostname
- [ ] If hostname issue: SUPABASE_URL in mobile env uses `100.110.47.62` IP
- [ ] 30s timeout added to `FileSystem.uploadAsync`
- [ ] Full response status + body logged on completion
- [ ] Upload error caught and sets error state in UI
- [ ] Uploading indicator is a red pill with white bold text, centered in image zone
- [ ] Error indicator is a red pill with "Upload failed — tap to retry", tappable
- [ ] Upload completes successfully and image appears in recipe photo gallery
- [ ] Files confirmed in `storage.objects` on RPi5 after successful upload
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
