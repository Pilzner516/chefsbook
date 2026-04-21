Add the following item to AGENDA.md under a suitable priority section (suggest HIGH or BUGS):

---

## Import Pipeline Diagnostic — Incomplete recipes that should have been complete

**Background**: During testing of the Sous Chef suggest feature, the AI successfully generated
a perfect ingredient match for a recipe (Sicilian Pizza Dough, thekellykitchen.com) that the
import pipeline had marked as incomplete (missing ingredients). The Sous Chef route performs a
fresh GET on source_url and passes the scraped content to Haiku — the match was too accurate
to be hallucination, meaning the page was accessible and the ingredients were readable at
suggest-time but NOT at import-time.

**Hypothesis**: The import pipeline is failing to capture ingredients for some recipes that
are technically scrapeable, due to one or more of:
1. Rate limiting / soft bot detection returning partial HTML at import time
2. JavaScript-rendered ingredient sections missed by raw HTML fetch (JSON-LD in <head>
   comes through fine, explaining why title/description/tags import correctly)
3. 25,000 char truncation cutting off the ingredients section on large pages

**Diagnostic steps**:
1. Query import_attempts table for the thekellykitchen.com Sicilian Pizza Dough import.
   Check failure_reason and raw scraped content length. Do the ingredients appear in
   the scraped content or not?
2. Compare the Sous Chef route's GET response for the same URL — does it return more
   content than the original import fetch did?
3. If truncation: check whether raising the char limit (or prioritising the JSON-LD
   ingredients block before truncating) fixes it.
4. If JS-rendering: evaluate whether a headless fetch or the Chrome extension fallback
   should be the default for known JS-heavy recipe sites.
5. Audit the incomplete_recipes table — what percentage of incomplete recipes have a
   valid source_url that returns 200? Those are all pipeline failures, not genuinely
   incomplete sources.

**Why it matters**: The completeness gate is rejecting recipes that could have been
complete if the scrape had worked. The Sous Chef feature is quietly patching import
failures — good for users, but the pipeline should be fixed so it doesn't happen
in the first place.

---

Do not make any code changes. AGENDA.md edit only.
