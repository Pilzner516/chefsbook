/**
 * POST /api/admin/templates/generate
 *
 * AI-generates a cookbook PDF template from a text description.
 * Admin-only, rate-limited to 5 generations per admin per day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import { logAiCall } from '@chefsbook/db';
import { validateTemplate, computeLayout, PAGE_SIZES } from '@/lib/pdf-templates/engine';
import type { ValidationResult, TemplateManifest } from '@/lib/pdf-templates/engine/types';

const SONNET = 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';
const DAILY_LIMIT = 5;

// Condensed reference template pattern - shows the required structure without full implementation
const REFERENCE_TEMPLATE_PATTERN = `
// Template structure example (condensed)
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import type { TemplateContext, ComputedLayout } from './engine/types';
import { groupIngredients, formatDuration, formatQuantity, truncate, fixTimerCharacter } from './types';
import type { BookStrings } from './book-strings';

// Register fonts via jsDelivr CDN
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf', fontWeight: 600 },
  ],
});

// Colour constants
const ACCENT = '#ce2b37';
const BACKGROUND = '#faf7f0';
const TEXT = '#1a1a1a';
const MUTED = '#7a6a5a';

// Static styles only - no layout.* values here
const styles = StyleSheet.create({
  coverPage: { backgroundColor: BACKGROUND },
  // ... more static styles
});

function CoverPage({ cookbook, chefsHatBase64, strings, layout }: { cookbook: any; chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={styles.coverPage}>
      {/* Cover content - use layout.* for all dynamic sizing */}
      <Text style={{ fontSize: layout.fontTitle, fontFamily: 'Playfair Display', fontWeight: 700 }}>
        {cookbook.title}
      </Text>
    </Page>
  );
}

function RecipeContentPage({ recipe, strings, layout }: { recipe: any; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop,
      paddingBottom: layout.marginBottom,
      paddingLeft: layout.marginInner,
      paddingRight: layout.marginOuter,
      backgroundColor: BACKGROUND,
    }} wrap>
      {/* Ingredients - wrap={false} keeps section together */}
      <View wrap={false}>
        <Text style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600, color: ACCENT }}>INGREDIENTS</Text>
        {/* ingredient items */}
      </View>

      {/* Steps - section wraps, individual steps don't */}
      <View>
        <Text style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600, color: ACCENT }}>STEPS</Text>
        {recipe.steps.map((step: any) => (
          // CRITICAL: Step row structure - MUST follow this exactly
          <View key={step.step_number} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: layout.stepGap }} wrap={false} minPresenceAhead={100}>
            {/* Badge - fixed size, never shrinks */}
            <View style={{
              width: layout.badgeSize,
              height: layout.badgeSize,
              borderRadius: layout.badgeSize / 2,
              backgroundColor: ACCENT,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Text style={{ color: '#ffffff', fontSize: layout.badgeFontSize, fontFamily: 'Playfair Display', fontWeight: 700 }}>
                {String(step.step_number)}
              </Text>
            </View>
            {/* Text - fills remaining row width, wraps naturally */}
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', lineHeight: layout.lineHeight }}>
                {fixTimerCharacter(step.instruction)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

// Main document export - MUST be default export accepting TemplateContext
export default function TemplateDocument(ctx: TemplateContext) {
  const { cookbook, recipes, chefsHatBase64, layout, strings } = ctx;

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />
      {/* TOCPage, RecipeImagePage, RecipeContentPage for each recipe, BackPage */}
    </Document>
  );
}
`;

// Rate limiting: check how many generate calls this admin made today
async function checkRateLimit(adminUserId: string): Promise<{ allowed: boolean; count: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('ai_usage_log')
    .select('id')
    .eq('user_id', adminUserId)
    .eq('action', 'generate_template')
    .gte('created_at', today.toISOString());

  if (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true, count: 0 }; // Fail open
  }

  const count = data?.length ?? 0;
  return { allowed: count < DAILY_LIMIT, count };
}

// Build the system prompt with all required sections
function buildSystemPrompt(
  referenceTemplate: string,
  typesContent: string,
  layoutContent: string
): string {
  return `You are an expert React PDF template developer for ChefsBook, a recipe cookbook app.
Your job is to generate a valid TypeScript React component for a cookbook PDF template.

Return ONLY a JSON object with two keys:
- "code": the complete TypeScript component as a string
- "manifest": the template manifest as an object

Do not include any explanation, markdown, code fences, or preamble.
Return pure JSON only.

## Technical Constraints

### ComputedLayout Interface (from engine/types.ts)
\`\`\`typescript
export interface ComputedLayout {
  width: number;
  height: number;
  marginTop: number;        // 54pt minimum
  marginBottom: number;     // 54pt minimum
  marginInner: number;      // 63pt minimum (binding gutter)
  marginOuter: number;      // 45pt minimum
  contentWidth: number;     // width - marginInner - marginOuter
  contentHeight: number;    // height - marginTop - marginBottom
  fontTitle: number;        // recipe title (36-20pt range)
  fontSubtitle: number;     // section headers (22-13pt range)
  fontBody: number;         // ingredient/step text (11-9pt range)
  fontCaption: number;      // metadata, timers, captions (10-8pt range)
  fontStepNumber: number;   // step badge numbers (fixed 11pt)
  lineHeight: number;       // body line height multiplier (1.5)
  heroImageHeight: number;  // full-width hero photo (~38% content height)
  thumbImageHeight: number; // secondary/additional images (~28% content height)
  badgeSize: number;        // step badge circle diameter (22pt)
  badgeFontSize: number;    // number inside badge (11pt)
  stepGap: number;          // vertical gap between steps (10pt)
  sectionGap: number;       // gap between major sections (16pt)
}

export interface TemplateContext {
  recipe: CookbookRecipe;
  cookbook: {
    title: string;
    subtitle?: string;
    author_name: string;
    cover_style: string;
    cover_image_url?: string;
    selected_image_urls?: Record<string, string[]>;
    foreword?: string;
    pageSize?: string;
  };
  recipes: CookbookRecipe[];
  chefsHatBase64?: string | null;
  language?: string;
  layout: ComputedLayout;
  settings: TemplateSettings;
  strings: BookStrings;
  fillZone?: FillContent;
  isPreview?: boolean;
}

export interface TemplateSettings {
  palette: {
    accent: string;
    background: string;
    text: string;
    muted: string;
    surface: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}
\`\`\`

### Mandatory Rules
- Only import from \`@react-pdf/renderer\` and \`./types\` or \`./engine/types\`
- Use \`layout.*\` for ALL sizing — never hardcode pixel values for margins, fonts, or heights
- Never use \`size="LETTER"\` or any hardcoded page size on \`<Page>\`
- Never use emoji or Unicode characters above U+00FF in text content
- Never use \`fontStyle: 'italic'\` with Inter font (Inter has no italic variants registered)
- Never use \`height\`, \`minHeight\`, or \`maxHeight\` on step row Views — auto-height only
- Step row structure: outer View (flexDirection:'row', wrap:false) → badge View (flexShrink:0) → inner View (flex:1, paddingLeft:8) → Text
- Badge: View with borderRadius = layout.badgeSize/2, color from settings.palette.accent
- Page order within recipe: PhotoPage → AdditionalImagePage → RecipeContentPage → CustomPage → FillZone
- Export a default function that accepts TemplateContext as its only parameter
- Page component must use: \`<Page size={{ width: layout.width, height: layout.height }}>\`
- StyleSheet.create() is evaluated at module load — use inline style overrides for layout.* values
- Always use \`wrap={false}\` only on individual step rows and notes boxes, NEVER on section containers

### Lulu Print Spec
- Minimum margins: top/bottom 54pt, inner 63pt, outer 45pt
- DPI: 300 minimum for images
- \`computeLayout()\` already enforces these margins — trust its values

### Template Manifest Structure
\`\`\`json
{
  "id": "template-id",
  "name": "Template Name",
  "description": "A brief description of the template style",
  "version": "1.0.0",
  "isSystem": false,
  "status": "draft",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    { "family": "FontFamily", "weights": [400, 700], "italic": [] }
  ],
  "settings": {
    "palette": {
      "accent": "#hexcolor",
      "background": "#hexcolor",
      "text": "#hexcolor",
      "muted": "#hexcolor",
      "surface": "#hexcolor"
    },
    "fonts": {
      "heading": "FontFamily",
      "body": "FontFamily"
    }
  }
}
\`\`\`

## Reference Implementation (Trattoria template)
${referenceTemplate}
`;
}

function buildUserPrompt(
  description: string,
  accentColor?: string,
  backgroundColor?: string,
  style?: string
): string {
  return `Generate a cookbook PDF template with this style:

Description: ${description}
Accent color: ${accentColor || 'choose an appropriate color for this style'}
Background color: ${backgroundColor || 'choose an appropriate color for this style'}
Style: ${style || 'derive from description'}

The template name should reflect the style described.
Choose appropriate Google Fonts that match the aesthetic.
Ensure the template is visually distinct from the Trattoria (warm rustic Italian),
Studio (dark modern), Garden (minimal green), Heritage (farmhouse),
Nordic (Scandinavian minimal), and BBQ (pitmaster charcoal) templates.

The template MUST:
1. Export a default function that accepts TemplateContext
2. Use layout.* values for all sizing
3. Include CoverPage, TOCPage, RecipeImagePage, RecipeContentPage, and BackPage components
4. Use the exact step row structure from the reference
5. Register fonts via Font.register() with jsDelivr CDN URLs`;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify admin
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Rate limit check
    const { allowed, count } = await checkRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json({
        error: `Daily generation limit reached (${DAILY_LIMIT}/day)`,
        limit: DAILY_LIMIT,
        used: count,
      }, { status: 429 });
    }

    // Parse request
    const body = await req.json();
    const { description, accentColor, backgroundColor, style } = body;

    if (!description || typeof description !== 'string' || description.length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 });
    }

    if (description.length > 300) {
      return NextResponse.json({ error: 'Description must be 300 characters or less' }, { status: 400 });
    }

    // Build prompts with embedded reference pattern
    const systemPrompt = buildSystemPrompt(REFERENCE_TEMPLATE_PATTERN, '', '');
    const userPrompt = buildUserPrompt(description, accentColor, backgroundColor, style);

    // Call Claude Sonnet
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
    if (!apiKey) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
    }

    const startTime = Date.now();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Claude API error:', errorBody);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;
    const usage = data.usage ?? {};
    const tokensIn = usage.input_tokens ?? 0;
    const tokensOut = usage.output_tokens ?? 0;

    // Log AI usage
    await logAiCall({
      userId: user.id,
      action: 'generate_template',
      model: 'sonnet',
      tokensIn,
      tokensOut,
      metadata: { description, style, durationMs },
      success: true,
      durationMs,
    });

    // Parse the response
    const rawText = data.content?.[0]?.text ?? '';
    let parsed: { code: string; manifest: TemplateManifest };

    try {
      // Try to extract JSON from the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json({
        error: 'Failed to parse generated template',
        rawResponse: rawText.slice(0, 500),
      }, { status: 500 });
    }

    if (!parsed.code || !parsed.manifest) {
      return NextResponse.json({
        error: 'Invalid response structure: missing code or manifest',
      }, { status: 500 });
    }

    // Validate the generated code
    const validation: ValidationResult = validateTemplate(parsed.code);

    return NextResponse.json({
      code: parsed.code,
      manifest: parsed.manifest,
      validation,
      tokensUsed: tokensIn + tokensOut,
      remaining: DAILY_LIMIT - count - 1,
    });

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Generation failed',
    }, { status: 500 });
  }
}

// GET endpoint to check rate limit status
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { allowed, count } = await checkRateLimit(user.id);

    return NextResponse.json({
      limit: DAILY_LIMIT,
      used: count,
      remaining: DAILY_LIMIT - count,
      allowed,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check limit' }, { status: 500 });
  }
}
