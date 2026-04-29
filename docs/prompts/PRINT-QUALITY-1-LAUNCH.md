You are starting session PRINT-QUALITY-1. Before writing any code:

1. Read .claude/agents/wrapup.md
2. Read CLAUDE.md fully
3. Read DONE.md
4. Read .claude/agents/testing.md
5. Read .claude/agents/feature-registry.md
6. Read .claude/agents/deployment.md
7. Read .claude/agents/ui-guardian.md
8. Read .claude/agents/pdf-design.md
9. Read .claude/agents/image-system.md
10. Read .claude/agents/ai-cost.md
11. Run all pre-flight checklists from every agent above
12. Run \d printed_cookbooks and \d user_profiles on RPi5 to verify schema
13. Only then begin writing code

Do not write a single line of code until all 13 steps are complete.

---

SESSION: PRINT-QUALITY-1
Route: /dashboard/print-cookbook/[id]
Builds on: CANVAS-EDITOR-4, session 30 (PLAN_LIMITS)

---

CONTEXT

The print cookbook canvas editor is working but two things need fixing:
1. The print cookbook feature is not plan-gated — any user can access it. It must be paid-only (chef/family/pro).
2. Recipe images are web resolution (72-96 DPI) which prints poorly. AI upscaling must run at generate time for paid users to produce 300 DPI quality output. Nothing extra is stored — upscaled images are used only during PDF generation then discarded.

---

TASK 1 — Gate the entire print cookbook feature to paid plans

Check PLAN_LIMITS in the codebase. There is already a canPDF flag. Extend this:

Add canPrint boolean to PLAN_LIMITS:
- free: false
- chef: true
- family: true
- pro: true

Gate the route /dashboard/print-cookbook/[id]:
- If canPrint is false, redirect to /dashboard/plans with message: "Print My ChefsBook is available on Chef, Family, and Pro plans."
- Also gate /dashboard/print-cookbook/new (or wherever a new cookbook is created)
- Gate the generate API route /api/print-cookbooks/[id]/generate — return 403 with { error: "upgrade_required" } for free users

On /dashboard/plans ensure print cookbook is listed as a paid benefit on chef/family/pro tier cards. Check what is already listed and add if missing.

---

TASK 2 — AI image upscaling at generate time (paid users only)

At PDF generate time, for each recipe image and the cover image:

Step 1 — Check image resolution using existing print-quality.ts logic.
- If image is already green (excellent), skip upscaling.
- If image is yellow or red, upscale it.

Step 2 — Upscale via Replicate API using Real-ESRGAN model:
- Model: nightmareai/real-esrgan
- Scale: 4x
- Do NOT save the upscaled image to storage. Stream it into the PDF pipeline only.
- If upscaling fails for any image, fall back to the original and log the failure — do not abort the entire PDF.

Step 3 — Add REPLICATE_API_TOKEN to .env.local on RPi5. Document it in CLAUDE.md under Environment Variables with a placeholder and instructions. The actual token value will be provided separately.

Step 4 — Show a progress indicator in the canvas editor UI during generation:
"Enhancing image quality for print..." shown while upscaling runs, before "Generating PDF..."

Step 5 — Track upscaling cost in ai_usage_log:
- model: "real-esrgan-4x"
- cost: 0.002 per image
- cookbook_id: the printed_cookbook id

---

TASK 3 — Update quality badge behaviour in canvas

Now that upscaling runs automatically, update badge messaging:
- Green badge: "Print ready"
- Yellow badge: "Will be enhanced at print time"
- Red badge: "Will be enhanced at print time"

Remove the pre-generate blocking for red images added in CANVAS-EDITOR-4. The Generate button must never be blocked by image quality — upscaling handles it automatically.

---

ACCEPTANCE CRITERIA

Before /wrapup verify all of these:

- [ ] Free user visiting /dashboard/print-cookbook/[id] is redirected to /dashboard/plans
- [ ] Free user hitting generate API gets 403 upgrade_required
- [ ] Paid user (chef/family/pro) can access canvas and generate normally
- [ ] /dashboard/plans lists print cookbook as a paid feature
- [ ] REPLICATE_API_TOKEN placeholder added to .env.local with setup instructions
- [ ] REPLICATE_API_TOKEN documented in CLAUDE.md under Environment Variables
- [ ] Upscaling runs at generate time for yellow and red images, skipped for green
- [ ] Upscaled images are NOT saved to Supabase storage
- [ ] PDF generation does not abort if upscaling fails — falls back to original
- [ ] Progress indicator shows "Enhancing image quality for print..." during generation
- [ ] ai_usage_log records upscaling calls with cost per image
- [ ] Quality badges show updated messaging, no generate blocking
- [ ] TypeScript: cd apps/web && npx tsc --noEmit passes with no new errors
- [ ] Deployed to RPi5 and verified: free user redirect works, paid user generates successfully
