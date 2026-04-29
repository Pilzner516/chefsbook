/**
 * BBQ Template — Smoky, rustic, American barbecue
 * Feels like a treasured pitmaster's cookbook.
 * Bold, warm, and inviting with charred wood textures.
 */
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import {
  CookbookPdfOptions,
  CookbookRecipe,
  CustomPageData,
  groupIngredients,
  formatDuration,
  formatQuantity,
  truncate,
  fixTimerCharacter,
  getPageSize,
  PageSizeKey,
} from './types';
import { getStrings, type BookStrings } from './book-strings';

// Register fonts via jsDelivr CDN
Font.register({
  family: 'Oswald',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-500-normal.ttf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Source Sans Pro',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@latest/latin-600-normal.ttf', fontWeight: 600 },
  ],
});

// Colour palette — smoky, warm BBQ tones
const CHARCOAL = '#2d2926';
const SMOKE = '#4a4543';
const AMBER = '#d4a03a';
const RUST = '#b54b32';
const CREAM = '#f5f0e8';
const WARM_WHITE = '#fffdf8';
const BARK = '#3d3330';

const styles = StyleSheet.create({
  // Cover page
  coverPage: {
    backgroundColor: CHARCOAL,
    position: 'relative',
  },
  coverWithImage: {
    flex: 1,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(45, 41, 38, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  coverNoCover: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '45%',
    backgroundColor: CHARCOAL,
    position: 'relative',
  },
  coverStripe: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: AMBER,
  },
  coverStripeBottom: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: RUST,
  },
  coverTitle: {
    fontSize: 52,
    fontFamily: 'Oswald',
    fontWeight: 700,
    color: WARM_WHITE,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 18,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: AMBER,
    textAlign: 'center',
    marginBottom: 24,
  },
  coverDivider: {
    width: 100,
    height: 3,
    backgroundColor: AMBER,
    marginVertical: 20,
  },
  coverAuthor: {
    fontSize: 14,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: CREAM,
    textAlign: 'center',
  },
  cookbookLine: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: SMOKE,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  coverFooterText: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: SMOKE,
  },
  coverFooterUrl: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: AMBER,
    marginTop: 4,
  },

  // Foreword page
  forewordPage: {
    backgroundColor: CREAM,
    padding: 60,
    paddingTop: 80,
  },
  forewordTitle: {
    fontSize: 28,
    fontFamily: 'Oswald',
    fontWeight: 600,
    color: CHARCOAL,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  forewordRule: {
    width: 60,
    height: 3,
    backgroundColor: RUST,
    marginBottom: 32,
  },
  forewordText: {
    fontSize: 12,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SMOKE,
    lineHeight: 1.8,
  },

  // TOC
  tocPage: {
    backgroundColor: CREAM,
    padding: 60,
    paddingTop: 80,
  },
  tocTitle: {
    fontSize: 32,
    fontFamily: 'Oswald',
    fontWeight: 700,
    color: CHARCOAL,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 8,
  },
  tocRule: {
    width: 60,
    height: 3,
    backgroundColor: AMBER,
    marginBottom: 32,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  tocRecipe: {
    fontSize: 13,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: CHARCOAL,
    flex: 1,
  },
  tocLeader: {
    borderBottomWidth: 1,
    borderBottomColor: SMOKE,
    borderBottomStyle: 'dotted',
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 3,
  },
  tocPageNum: {
    fontSize: 13,
    fontFamily: 'Oswald',
    fontWeight: 500,
    color: RUST,
  },

  // Recipe image page (left)
  recipeImagePage: {
    backgroundColor: CHARCOAL,
    position: 'relative',
  },
  recipeFullImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recipeImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(45, 41, 38, 0.9)',
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  recipeImageTitle: {
    fontSize: 28,
    fontFamily: 'Oswald',
    fontWeight: 700,
    color: WARM_WHITE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  recipeImageMeta: {
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: AMBER,
  },

  // Recipe text page (no image)
  recipeTextOnlyPage: {
    backgroundColor: CREAM,
    padding: 48,
    justifyContent: 'flex-start',
    paddingTop: '35%',
  },
  recipeTextOnlyTitle: {
    fontSize: 36,
    fontFamily: 'Oswald',
    fontWeight: 700,
    color: CHARCOAL,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  recipeTextOnlyRule: {
    width: 80,
    height: 4,
    backgroundColor: RUST,
    marginBottom: 16,
  },
  recipeTextOnlyMeta: {
    fontSize: 12,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SMOKE,
  },

  // Recipe detail page (right)
  recipePage: {
    backgroundColor: CREAM,
    padding: 40,
    paddingTop: 48,
  },
  recipeHeader: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: CHARCOAL,
    paddingBottom: 16,
  },
  recipeTitle: {
    fontSize: 24,
    fontFamily: 'Oswald',
    fontWeight: 700,
    color: CHARCOAL,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  recipeMeta: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SMOKE,
  },
  recipeDescription: {
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SMOKE,
    lineHeight: 1.6,
    marginTop: 10,
  },

  // Stacked layout for better page breaks
  ingredientsSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: CHARCOAL,
  },
  stepsSection: {
    flex: 1,
  },

  // Ingredients
  ingredientsLabel: {
    fontSize: 12,
    fontFamily: 'Oswald',
    fontWeight: 600,
    color: RUST,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  ingredientGroupLabel: {
    fontSize: 10,
    fontFamily: 'Oswald',
    fontWeight: 500,
    color: CHARCOAL,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    backgroundColor: AMBER,
    marginRight: 8,
    marginTop: 4,
  },
  ingredientText: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: CHARCOAL,
    flex: 1,
    lineHeight: 1.4,
  },

  // Steps
  stepsLabel: {
    fontSize: 12,
    fontFamily: 'Oswald',
    fontWeight: 600,
    color: RUST,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  stepGroupLabel: {
    fontSize: 10,
    fontFamily: 'Oswald',
    fontWeight: 500,
    color: CHARCOAL,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 22,
    height: 22,
    backgroundColor: CHARCOAL,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 10,
    fontFamily: 'Oswald',
    fontWeight: 600,
    color: WARM_WHITE,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: CHARCOAL,
    lineHeight: 1.6,
  },

  // Notes
  notesBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: WARM_WHITE,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
  },
  notesLabel: {
    fontSize: 9,
    fontFamily: 'Oswald',
    fontWeight: 600,
    color: RUST,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SMOKE,
    lineHeight: 1.5,
  },

  // Back page
  backPage: {
    backgroundColor: CHARCOAL,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  backLogo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  backTitle: {
    fontSize: 28,
    fontFamily: 'Oswald',
    fontWeight: 700,
    color: WARM_WHITE,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  backTagline: {
    fontSize: 12,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: CREAM,
    textAlign: 'center',
    lineHeight: 1.7,
    maxWidth: 320,
    marginBottom: 24,
  },
  backUrl: {
    fontSize: 14,
    fontFamily: 'Source Sans Pro',
    fontWeight: 600,
    color: AMBER,
  },
});

function CoverPage({ cookbook, chefsHatBase64, strings, pageSize }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings; pageSize: PageSizeKey }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size={getPageSize(pageSize)} style={styles.coverPage}>
        <View style={styles.coverWithImage}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
          <View style={styles.coverOverlay}>
            <Text style={styles.coverTitle}>{cookbook.title}</Text>
            {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
            <View style={styles.coverDivider} />
            <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
            <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
          </View>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>{strings.createdWith}</Text>
          <Text style={styles.coverFooterUrl}>chefsbk.app</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size={getPageSize(pageSize)} style={styles.coverPage}>
      <View style={styles.coverStripe} />
      <View style={styles.coverStripeBottom} />
      <View style={styles.coverNoCover}>
        <Text style={styles.coverTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
        <View style={styles.coverDivider} />
        <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
        <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
      </View>
      <View style={styles.coverFooter}>
        <Text style={styles.coverFooterText}>{strings.createdWith}</Text>
        <Text style={styles.coverFooterUrl}>chefsbk.app</Text>
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, strings, pageSize }: { foreword: string; strings: BookStrings; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.forewordPage}>
      <Text style={styles.forewordTitle}>{strings.foreword}</Text>
      <View style={styles.forewordRule} />
      <Text style={styles.forewordText}>{foreword}</Text>
    </Page>
  );
}

function TOCPage({ recipes, startPage, strings, pageSize }: { recipes: CookbookRecipe[]; startPage: number; strings: BookStrings; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.tocPage}>
      <Text style={styles.tocTitle}>{strings.contents}</Text>
      <View style={styles.tocRule} />
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={styles.tocEntry}>
          <Text style={styles.tocRecipe}>{recipe.title}</Text>
          <View style={styles.tocLeader} />
          <Text style={styles.tocPageNum}>{startPage + idx * 2}</Text>
        </View>
      ))}
    </Page>
  );
}

function RecipeImagePage({ recipe, strings, pageSize }: { recipe: CookbookRecipe; strings: BookStrings; pageSize: PageSizeKey }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={styles.recipeImageOverlay}>
          <Text style={styles.recipeImageTitle}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={styles.recipeImageMeta}>{meta.join('  |  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size={getPageSize(pageSize)} style={styles.recipeTextOnlyPage}>
      <Text style={styles.recipeTextOnlyTitle}>{recipe.title}</Text>
      <View style={styles.recipeTextOnlyRule} />
      {meta.length > 0 && <Text style={styles.recipeTextOnlyMeta}>{meta.join('  |  ')}</Text>}
    </Page>
  );
}

function AdditionalImagePage({ imageUrl, recipeName, pageSize }: { imageUrl: string; recipeName: string; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
      <Image src={imageUrl} style={styles.recipeFullImage} />
      <View style={styles.recipeImageOverlay}>
        <Text style={styles.recipeImageTitle}>{recipeName}</Text>
      </View>
    </Page>
  );
}

// Custom page component for user-added pages
function CustomPageComponent({ customPage, pageSize }: { customPage: CustomPageData; pageSize: PageSizeKey }) {
  const hasImage = customPage.layout !== 'text_only' && customPage.image_url;
  const hasText = customPage.layout !== 'image_only' && customPage.text;

  if (customPage.layout === 'image_only' && customPage.image_url) {
    return (
      <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
        <Image src={customPage.image_url} style={styles.recipeFullImage} />
        {customPage.caption && (
          <View style={styles.recipeImageOverlay}>
            <Text style={styles.recipeImageTitle}>{customPage.caption}</Text>
          </View>
        )}
      </Page>
    );
  }

  if (customPage.layout === 'text_only') {
    return (
      <Page size={getPageSize(pageSize)} style={styles.recipeTextOnlyPage}>
        <Text style={styles.recipeTextOnlyTitle}>{customPage.text}</Text>
      </Page>
    );
  }

  // image_and_text layout
  return (
    <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
      {hasImage && <Image src={customPage.image_url} style={styles.recipeFullImage} />}
      <View style={styles.recipeImageOverlay}>
        {customPage.caption && <Text style={styles.recipeImageTitle}>{customPage.caption}</Text>}
        {hasText && <Text style={{ ...styles.recipeImageMeta, marginTop: 8 }}>{customPage.text}</Text>}
      </View>
    </Page>
  );
}

function FillZone({ fillType, fillContent, accentColor }: { fillType?: string; fillContent?: { quoteText?: string; quoteAttribution?: string; customText?: string; customImageUrl?: string }; accentColor: string }) {
  if (!fillType || fillType === 'blank') return null;

  if (fillType === 'chefs_notes') {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: 600, color: accentColor }}>Chef's Notes</Text>
          <Text style={{ fontSize: 8, marginLeft: 4, color: SMOKE }}>✎</Text>
        </View>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: SMOKE, marginBottom: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: SMOKE, height: 24 }} />
        ))}
      </View>
    );
  }

  if (fillType === 'quote' && fillContent?.quoteText) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: SMOKE, width: '60%', marginBottom: 16 }} />
        <Text style={{ fontSize: 36, color: accentColor, marginBottom: 4 }}>"</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Source Sans Pro', fontWeight: 300, fontStyle: 'italic', textAlign: 'center', maxWidth: '80%', lineHeight: 1.6, color: CHARCOAL }}>
          {fillContent.quoteText}
        </Text>
        {fillContent.quoteAttribution && (
          <Text style={{ fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: 300, color: SMOKE, marginTop: 12 }}>
            — {fillContent.quoteAttribution}
          </Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: SMOKE, width: '60%', marginTop: 16 }} />
      </View>
    );
  }

  if (fillType === 'custom' && (fillContent?.customText || fillContent?.customImageUrl)) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
        {fillContent.customImageUrl && (
          <Image src={fillContent.customImageUrl} style={{ maxWidth: 200, maxHeight: 120, objectFit: 'contain', marginBottom: fillContent.customText ? 12 : 0 }} />
        )}
        {fillContent.customText && (
          <Text style={{ fontSize: 11, fontFamily: 'Source Sans Pro', fontWeight: 300, color: CHARCOAL, textAlign: 'center', maxWidth: '80%', lineHeight: 1.5 }}>
            {fillContent.customText}
          </Text>
        )}
      </View>
    );
  }

  return null;
}

function RecipePage({ recipe, strings, pageSize }: { recipe: CookbookRecipe; strings: BookStrings; pageSize: PageSizeKey }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const groups = groupIngredients(recipe.ingredients);
  let currentStepGroup: string | null = null;

  return (
    <Page size={getPageSize(pageSize)} style={styles.recipePage} wrap>
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        {meta.length > 0 && <Text style={styles.recipeMeta}>{meta.join('  |  ')}</Text>}
        {recipe.description && <Text style={styles.recipeDescription}>{truncate(recipe.description, 200)}</Text>}
      </View>

      {/* Ingredients section - stays together, doesn't break across pages */}
      <View style={styles.ingredientsSection} wrap={false}>
        <Text style={styles.ingredientsLabel}>{strings.ingredients}</Text>
        {groups.map((group, gi) => (
          <View key={gi}>
            {group.label && <Text style={styles.ingredientGroupLabel}>{group.label}</Text>}
            {group.items.map((ing, ii) => {
              const qty = formatQuantity(ing.quantity);
              const parts = [qty, ing.unit, ing.ingredient, ing.preparation].filter(Boolean);
              return (
                <View key={ii} style={styles.ingredientRow}>
                  <View style={styles.ingredientBullet} />
                  <Text style={styles.ingredientText}>
                    {parts.join(' ')}
                    {ing.optional && ' (optional)'}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Steps section - flows across pages, individual steps don't break */}
      <View style={styles.stepsSection}>
        <Text style={styles.stepsLabel}>{strings.steps}</Text>
        {recipe.steps.map((step, si) => {
          const showGroupLabel = step.group_label && step.group_label !== currentStepGroup;
          if (step.group_label) currentStepGroup = step.group_label;

          return (
            <View key={si} wrap={false} minPresenceAhead={40}>
              {showGroupLabel && <Text style={styles.stepGroupLabel}>{step.group_label}</Text>}
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.step_number}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>
                    {fixTimerCharacter(step.instruction)}
                    {step.timer_minutes ? ` (${step.timer_minutes} min)` : ''}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {recipe.notes && (
          <View style={styles.notesBox} wrap={false}>
            <Text style={styles.notesLabel}>{strings.notes}</Text>
            <Text style={styles.notesText}>{recipe.notes}</Text>
          </View>
        )}
      </View>

      <FillZone fillType={recipe.fillType} fillContent={recipe.fillContent} accentColor={AMBER} />
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings, pageSize }: { chefsHatBase64?: string | null; strings: BookStrings; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.backPage}>
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backLogo} />}
      <Text style={styles.backTitle}>ChefsBook</Text>
      <Text style={styles.backTagline}>{strings.tagline}</Text>
      <Text style={styles.backUrl}>chefsbk.app</Text>
    </Page>
  );
}

export function BBQDocument({ cookbook, recipes, chefsHatBase64, language }: CookbookPdfOptions) {
  const strings = getStrings(language ?? 'en');
  const pageSize = cookbook.pageSize ?? 'letter';
  const tocPages = Math.ceil(recipes.length / 25);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 2 + tocPages + (hasForeword ? 1 : 0) + 1;

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} pageSize={pageSize} />
      {hasForeword && <ForewordPage foreword={cookbook.foreword!} strings={strings} pageSize={pageSize} />}
      <TOCPage recipes={recipes} startPage={startPage} strings={strings} pageSize={pageSize} />
      {recipes.map((recipe) => (
        <React.Fragment key={recipe.id}>
          <RecipeImagePage recipe={recipe} strings={strings} pageSize={pageSize} />
          <RecipePage recipe={recipe} strings={strings} pageSize={pageSize} />
          {/* Render additional image pages if they exist */}
          {recipe.image_urls.slice(1).map((imageUrl, idx) => (
            <AdditionalImagePage key={`${recipe.id}-img-${idx}`} imageUrl={imageUrl} recipeName={recipe.title} pageSize={pageSize} />
          ))}
          {/* Render custom pages added by user */}
          {recipe.custom_pages?.map((cp) => (
            <CustomPageComponent key={cp.id} customPage={cp} pageSize={pageSize} />
          ))}
        </React.Fragment>
      ))}
      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} pageSize={pageSize} />
    </Document>
  );
}
