# ChefsBook — Generate Image Prompts for Landing Page Concepts
# Purpose: Produce Nano Banana / AI image generation prompts for all 3 landing concepts
# Output: docs/landing-previews/image-prompts.md
# Note: No code changes, no deployment, no wrapup needed

---

## CONTEXT

Read CLAUDE.md and all 3 concept files:
- docs/landing-previews/concept-a.html
- docs/landing-previews/concept-b.html
- docs/landing-previews/concept-c.html

Study the visual direction, section structure, color palette, and
mood of each concept fully before writing any prompts.

Then produce docs/landing-previews/image-prompts.md as specified below.

---

## OUTPUT FILE STRUCTURE

The file must be structured exactly like this:

```markdown
# ChefsBook Landing Page — Image Generation Prompts
# Use these prompts in Nano Banana or any AI image generator
# Save generated images to: docs/pics/
# Then tell the agents which images are available

---

## Priority Order (generate these 5 first)
[List the 5 highest-impact images with filenames]

---

## All Image Prompts

### [filename.jpg]
- Concepts: [A / B / C / A+C / all]
- Section: [hero / chaos / workflow / showcase / testimonial / etc]
- Dimensions: [1200x800 / 800x800 / 600x1200 / 1920x1080]
- Prompt: [full generation prompt]

[repeat for all 20-25 images]

---

## Style Reference Notes
[Brief guide on adjusting prompts per concept mood]
```

---

## PROMPT WRITING RULES

### Universal rules for ALL prompts:
- Always include: "editorial food photography, natural window light,
  shallow depth of field, 50mm lens, professional food styling"
- Never include people's faces — hands only if people are shown
- Specify surface/background material (marble, wood, linen, slate)
- Include color temperature: "warm golden hour tones" or
  "cool overcast northern light" depending on concept
- End every prompt with: "high resolution, no text, no watermarks"

### Per-concept mood adjustments:

**Concept A — "The Unified Kitchen" (Palette A: cream + pomodoro red)**
Mood: clean, editorial, Scandinavian kitchen aesthetic
Light: bright, diffused, white/cream surfaces
Surfaces: white marble, light oak wood, linen
Color temperature: neutral to warm white
Feel: organized, calm, aspirational home cook

**Concept B — "The Operating System" (Palette B: near-black + deep garnet)**
Mood: cinematic, moody, premium restaurant kitchen aesthetic
Light: dramatic side lighting, deep shadows, single source
Surfaces: dark slate, black marble, cast iron, aged copper
Color temperature: cool with warm accent highlights
Feel: serious, intelligent, professional, cinematic

**Concept C — "Beautiful Food. Organized Life." (warm cream palette)**
Mood: warm, inviting, lifestyle, aspirational family kitchen
Light: golden hour sunlight, warm and soft
Surfaces: butcher block, terracotta tiles, warm wood
Color temperature: very warm golden tones
Feel: approachable, delicious, family-oriented, joyful

---

## IMAGE CATEGORIES TO COVER

Ensure prompts cover all of these across the 20-25 images:

**Hero images (3 — one per concept):**
- Each concept needs a distinct hero that matches its mood
- Large format: 1920x1080 or 1440x900
- Should work with text overlaid (not too busy in center)

**Food/ingredient close-ups (6-8):**
- Fresh herbs being chopped (hands visible)
- Colorful vegetables arranged on a surface
- A beautifully plated dish (overhead shot)
- A cutting board with ingredients mid-prep
- Steam rising from a pot or pan
- Fresh bread or pastry just out of oven
- A bowl of pasta or grain dish

**Kitchen lifestyle (4-5):**
- An open recipe book or cookbook on a kitchen counter
- A grocery bag with fresh produce spilling out
- A weekly meal plan written on paper or shown on a phone
- Kitchen counter with organized ingredients laid out
- Coffee + breakfast scene, morning light

**Mobile/app context (3-4):**
- Hands holding a phone in a kitchen (screen blurred/blank)
- A phone lying on a counter next to ingredients
- Someone's hands scrolling through recipes (phone from above)
- A tablet propped up showing a recipe while cooking

**Shopping/organization (2-3):**
- A tidy pantry or organized refrigerator
- Fresh produce at a farmers market or grocery store
- A reusable shopping bag with groceries

---

## PRIORITY ORDER CRITERIA

The 5 priority images should be:
1. The hero for the concept you judge as strongest (Concept B)
2. The hero for the most commercial concept (Concept C)
3. A close-up food shot usable across all concepts
4. A hands-with-phone-in-kitchen shot (needed for app showcase sections)
5. A lifestyle/organized kitchen shot

---

## COMPLETION

- [ ] Read all 3 concept HTML files fully
- [ ] Write 20-25 image prompts covering all categories
- [ ] Each prompt has filename, concepts, section, dimensions, full prompt
- [ ] Priority order section lists 5 images with filenames
- [ ] Style reference notes section included
- [ ] File saved to docs/landing-previews/image-prompts.md
- [ ] No other files modified
- [ ] No deployment
- [ ] No wrapup
- [ ] Recap: confirm file was created and how many prompts were written
