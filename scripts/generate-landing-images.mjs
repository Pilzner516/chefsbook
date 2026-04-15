import fs from 'fs'
import path from 'path'
import https from 'https'

const TOKEN = process.env.REPLICATE_TOKEN
const OUTPUT_DIR = 'docs/pics'

if (!TOKEN) { console.error('Missing REPLICATE_TOKEN'); process.exit(1) }
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const HERO = '16:9'
const CARD = '3:2'

const images = [
  { filename: 'hero-a-unified-kitchen.jpg', ar: HERO, prompt: 'Overhead editorial food photograph of a calm, organized white marble countertop with a single ceramic bowl of fresh pasta dough, a wooden rolling pin, small glass bowls of flour, salt, and cracked eggs, a linen napkin in natural cream, and a sprig of fresh basil. Empty negative space in the left third for headline text. Editorial food photography, natural window light from the right, shallow depth of field, 50mm lens, professional food styling. Bright diffused Scandinavian kitchen aesthetic, white and cream tones with subtle warmth, hint of pomodoro red from a small ripe tomato at the edge. High resolution, no text, no watermarks.' },
  { filename: 'hero-b-operating-system.jpg', ar: HERO, prompt: 'Cinematic moody overhead photograph of a dark slate countertop in a professional restaurant kitchen at night. A single cast iron pan with searing lamb, glowing embers, wisps of steam catching a warm tungsten rim light from one side. Scattered elements: aged copper measuring spoons, a knife with a dark wooden handle, a few sprigs of thyme, a single glass of deep garnet wine, coarse sea salt. Deep shadows, dramatic chiaroscuro, single light source. Editorial food photography, natural window light blended with single warm practical, shallow depth of field, 50mm lens, professional food styling. Near-black background with deep garnet and soft gold highlights, cool color temperature with warm accent highlights. High resolution, no text, no watermarks.' },
  { filename: 'hero-c-warm-pasta.jpg', ar: HERO, prompt: 'Warm golden-hour overhead photograph of a rustic Italian family dinner scene on a worn butcher block table. Hand-shaped pappardelle with a glossy ragù, a ceramic bowl of Parmesan, a bottle of olive oil, fresh basil leaves, a half loaf of crusty sourdough torn open, terracotta plates, a linen napkin the color of wheat, two glasses of red wine. Sunlight streams across from the upper left, casting long warm shadows. Editorial food photography, natural golden hour window light, shallow depth of field, 50mm lens, professional food styling. Warm cream and terracotta tones, very warm golden color temperature, joyful and inviting. Composition leaves breathing room in the center third for headline overlay. High resolution, no text, no watermarks.' },
  { filename: 'closeup-herbs-hands.jpg', ar: CARD, prompt: "Close-up of hands mid-chop over a wooden cutting board, slicing fresh basil and parsley with a chef's knife. Hands only, no face. A small pile of chopped herbs, a few whole leaves, a scattering of coarse salt, a halved lemon at the edge. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Warm neutral tones. High resolution, no text, no watermarks." },
  { filename: 'closeup-vegetables-arranged.jpg', ar: CARD, prompt: 'Flat-lay arrangement of colorful fresh produce on a white marble surface — ripe heirloom tomatoes, a bunch of rainbow carrots with green tops, a head of purple cabbage sliced in half, a small pile of pearl onions, a bunch of radishes, fresh herbs, a garlic bulb. Gentle shadows, thoughtful spacing. Editorial food photography, natural window light from above-left, shallow depth of field, 50mm lens, professional food styling. Neutral bright white to cream tones with vivid natural vegetable color. High resolution, no text, no watermarks.' },
  { filename: 'closeup-plated-dish.jpg', ar: CARD, prompt: 'Overhead close-up of a single perfectly plated dish — seared salmon fillet on a bed of green lentils with charred lemon, a drizzle of olive oil, a sprinkle of flaky sea salt and microgreens, on a ceramic plate with a cream glaze. A linen napkin in the corner, a single fork resting beside the plate. Editorial food photography, natural window light from the side, shallow depth of field, 50mm lens, professional food styling. Clean composition, warm neutral tones. High resolution, no text, no watermarks.' },
  { filename: 'closeup-plated-dish-dark.jpg', ar: CARD, prompt: 'Overhead close-up of a single refined restaurant-style dish on a matte black ceramic plate — rare duck breast sliced and fanned, glossy reduction sauce, a dot of purée, a few micro-herbs, edible flowers. The plate sits on dark slate. Dramatic side lighting from the right creates deep shadows on the left. Editorial food photography, single warm practical light, shallow depth of field, 50mm lens, professional food styling. Near-black moody aesthetic with rich garnet and copper accents, cinematic. High resolution, no text, no watermarks.' },
  { filename: 'closeup-cutting-board-prep.jpg', ar: CARD, prompt: 'Three-quarter view of a worn wooden cutting board mid-preparation: partially diced onions, a knife laid diagonally with residue of garlic on the blade, a small ramekin of olive oil, a sprinkle of thyme, a folded kitchen cloth in natural linen. Hands just out of frame. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Warm neutral tones, homey and inviting. High resolution, no text, no watermarks.' },
  { filename: 'closeup-steam-pan.jpg', ar: CARD, prompt: 'Low-angle shot of a cast iron pan on a stove with a piece of seared steak mid-cook, butter basting, visible wisps of steam and smoke catching soft backlight. A sprig of rosemary and a few smashed garlic cloves in the pan. Editorial food photography, natural window light with soft rim backlight, shallow depth of field, 50mm lens, professional food styling. Warm golden highlights on dark surfaces, dramatic but inviting. High resolution, no text, no watermarks.' },
  { filename: 'closeup-bread-oven.jpg', ar: CARD, prompt: 'Overhead close-up of a freshly baked country sourdough loaf on a piece of parchment paper on a light oak counter, deep amber crust with flour dusting, steam gently rising, a serrated bread knife beside it, a linen cloth, a small dish of salted butter. Editorial food photography, natural window light from above, shallow depth of field, 50mm lens, professional food styling. Warm amber and cream tones. High resolution, no text, no watermarks.' },
  { filename: 'closeup-pasta-bowl.jpg', ar: CARD, prompt: 'Overhead shot of a ceramic bowl of fresh tagliatelle tossed with brown butter, crispy sage, shaved Parmesan, and cracked black pepper, on a light oak table. A fork twirling a few strands up on the rim. A small glass of water and a linen napkin nearby. Editorial food photography, natural window light from the left, shallow depth of field, 50mm lens, professional food styling. Warm inviting tones, clean composition. High resolution, no text, no watermarks.' },
  { filename: 'closeup-grain-bowl-dark.jpg', ar: CARD, prompt: 'Moody overhead of a black matte bowl holding a composed grain dish — farro, roasted squash, pomegranate seeds, shaved radish, dark greens, tahini drizzle. Set on dark slate with cast iron utensils. Dramatic single-source side light. Editorial food photography, deep shadows, shallow depth of field, 50mm lens, professional food styling. Near-black with jewel-tone accents, cinematic and intentional. High resolution, no text, no watermarks.' },
  { filename: 'lifestyle-open-cookbook.jpg', ar: CARD, prompt: 'Three-quarter view of an open hardcover cookbook resting on a kitchen counter, handwritten notes in the margins, a splatter of olive oil on one page, a sprig of rosemary pressed between pages, a wooden spoon laid across the top. Soft bokeh of a kitchen in the background. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Warm neutral tones, nostalgic yet refined. High resolution, no text, no watermarks.' },
  { filename: 'lifestyle-grocery-bag.jpg', ar: CARD, prompt: 'A paper grocery bag on a light oak counter with fresh produce spilling gently out — a baguette, leafy greens, tomatoes on the vine, a bunch of carrots, a small bouquet of flowers, a jar of olive oil. Editorial food photography, natural window light from above-left, shallow depth of field, 50mm lens, professional food styling. Warm golden hour tones, joyful and abundant. High resolution, no text, no watermarks.' },
  { filename: 'lifestyle-meal-plan-paper.jpg', ar: CARD, prompt: 'Overhead close-up of a handwritten weekly meal plan on a piece of cream paper with elegant script handwriting listing Mon–Sun dinners, resting on a linen tablecloth. A pencil laid beside it, a small dish of olives, a coffee cup leaving a faint ring, a sprig of thyme. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Warm cream tones with neutral balance. High resolution, no text on the plan itself beyond generic script, no watermarks.' },
  { filename: 'lifestyle-organized-counter.jpg', ar: CARD, prompt: 'A beautifully organized kitchen counter scene, wide horizontal composition — glass jars of pantry staples in a row, a wooden knife block, a cutting board, a small bowl of lemons, fresh herbs in a ceramic vase, a linen cloth folded neatly. A window behind with sheer curtains filtering soft light. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Bright diffused Scandinavian kitchen aesthetic, white cream wood and linen palette. High resolution, no text, no watermarks.' },
  { filename: 'lifestyle-breakfast-morning.jpg', ar: CARD, prompt: 'Soft morning scene on a round wooden breakfast table — a cup of pour-over coffee with gentle steam, a plate with a flaky croissant and a small dish of jam, a half-peeled orange, a linen napkin, a folded newspaper in the background. Golden morning light streaming in from the side. Editorial food photography, natural warm window light, shallow depth of field, 50mm lens, professional food styling. Warm golden hour tones, calm and intimate. High resolution, no text, no watermarks.' },
  { filename: 'phone-in-kitchen-hands.jpg', ar: CARD, prompt: 'Close-up of hands holding a smartphone in a kitchen, with the phone screen blank or softly blurred. Hands only, no face. In the background, out of focus, a marble counter with ingredients being prepped — a cutting board, fresh herbs, a bowl. The phone is held naturally at a slight angle as if reading a recipe. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Clean neutral tones, crisp and modern. High resolution, no text on phone, no watermarks.' },
  { filename: 'phone-on-counter.jpg', ar: CARD, prompt: 'Overhead shot of a smartphone lying face-up on a light oak counter, screen blank. Surrounding the phone: a cast iron skillet with sizzling onions, a small bowl of spices, a wooden spoon, a linen cloth, a bunch of fresh cilantro. Editorial food photography, natural window light from above, shallow depth of field, 50mm lens, professional food styling. Warm neutral tones, aspirational home cook. High resolution, no text on phone, no watermarks.' },
  { filename: 'phone-scrolling-overhead.jpg', ar: CARD, prompt: 'Overhead shot of hands scrolling through a smartphone, phone held over a light marble counter. Screen is softly blurred or blank. Hands only, no face. One hand holding the phone, the other mid-scroll with thumb extended. A cup of tea, a small notebook with handwriting, a fountain pen, a sprig of thyme visible at the edges. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Clean bright neutral tones. High resolution, no text on phone, no watermarks.' },
  { filename: 'tablet-propped-recipe.jpg', ar: CARD, prompt: 'A tablet propped up against a backsplash on a kitchen counter, screen blurred or blank, next to an active cooking scene — a pan on the stove with ingredients, a wooden spoon, a small bowl of chopped onions, flour dusting the counter. Editorial food photography, natural window light with gentle warm highlight, shallow depth of field, 50mm lens, professional food styling. Warm neutral tones balancing kitchen warmth with clean technology. High resolution, no text on tablet, no watermarks.' },
  { filename: 'shopping-pantry-organized.jpg', ar: CARD, prompt: 'An impossibly tidy pantry shelf — rows of clear glass jars with wooden lids holding grains, pasta, dried beans, nuts, labeled in elegant script. A small basket of onions and garlic. Soft indirect light. Editorial food photography, natural window light, shallow depth of field, 50mm lens, professional food styling. Warm cream and amber tones, calm and aspirational. High resolution, no text except generic labels, no watermarks.' },
  { filename: 'shopping-farmers-market.jpg', ar: CARD, prompt: 'Close-up of hands picking up a bunch of fresh carrots at a farmers market stall, crates of seasonal produce in the background — leafy greens, tomatoes, squashes. Wooden crates, chalkboard signs out of focus. Hands only, no face. Editorial food photography, natural warm afternoon light, shallow depth of field, 50mm lens, professional food styling. Warm golden tones, vibrant natural color. High resolution, no legible text, no watermarks.' },
  { filename: 'shopping-reusable-bag.jpg', ar: CARD, prompt: 'A canvas reusable shopping bag set down on a warm wood kitchen table, with fresh groceries visible — a baguette poking out, leafy greens, a bunch of herbs tied with twine, a carton of eggs, a bottle of olive oil. Afternoon sun streaming in. Editorial food photography, natural warm window light, shallow depth of field, 50mm lens, professional food styling. Warm golden hour tones, joyful and homely. High resolution, no text, no watermarks.' },
  { filename: 'texture-dark-slate.jpg', ar: HERO, prompt: 'Abstract macro texture of dark slate and aged copper surfaces with subtle scratches, flour dusting in one corner, a single droplet of deep red wine reduction. Moody dramatic single-source light from the upper right creating deep shadow areas and specular highlights. Editorial food photography approach, shallow depth of field, 50mm lens. Near-black with warm garnet and copper accents, cinematic. High resolution, no text, no watermarks.' },
  { filename: 'texture-cream-linen.jpg', ar: HERO, prompt: 'Abstract macro texture of cream linen fabric draped over light oak wood, with soft folds, a sprig of rosemary resting on it, a dusting of flour, a few cracked pepper grains. Gentle directional window light. Editorial food photography approach, shallow depth of field, 50mm lens, professional styling. Warm cream and neutral tones, calm. High resolution, no text, no watermarks.' },
]

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath)
    https.get(url, res => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', reject)
  })
}

async function generate(img, idx) {
  const outPath = path.join(OUTPUT_DIR, img.filename)
  if (fs.existsSync(outPath)) {
    console.log(`[${idx+1}/${images.length}] SKIP (exists): ${img.filename}`)
    return { ok: true, skipped: true }
  }
  console.log(`[${idx+1}/${images.length}] Generating: ${img.filename} (${img.ar})`)
  try {
    let data, r
    for (let attempt = 0; attempt < 6; attempt++) {
      r = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait' },
        body: JSON.stringify({ input: { prompt: img.prompt, aspect_ratio: img.ar, num_outputs: 1, output_format: 'jpg', output_quality: 90 } }),
      })
      data = await r.json()
      if (r.status === 429) {
        const wait = (data.retry_after || 10) + 2
        console.log(`  429 throttled, waiting ${wait}s...`)
        await new Promise(rr => setTimeout(rr, wait * 1000))
        continue
      }
      break
    }
    if (!data.output || !data.output[0]) {
      console.error(`  FAIL: ${img.filename}`, JSON.stringify(data).slice(0, 300))
      return { ok: false, filename: img.filename, error: data.error || data.detail || 'no output' }
    }
    await download(data.output[0], outPath)
    console.log(`  ✓ Saved: ${outPath}`)
    return { ok: true }
  } catch (e) {
    console.error(`  ERROR: ${img.filename}:`, e.message)
    return { ok: false, filename: img.filename, error: e.message }
  }
}

async function main() {
  console.log(`Generating ${images.length} images → ${OUTPUT_DIR}/`)
  console.log(`Estimated cost: $${(images.length * 0.025).toFixed(2)}`)
  const failures = []
  for (let i = 0; i < images.length; i++) {
    const result = await generate(images[i], i)
    if (!result.ok) failures.push(result)
    if (i < images.length - 1) await new Promise(r => setTimeout(r, 11000))
  }
  console.log(`\nDone. ${images.length - failures.length}/${images.length} succeeded.`)
  if (failures.length) {
    console.log('Failures:')
    failures.forEach(f => console.log(`  - ${f.filename}: ${f.error}`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
