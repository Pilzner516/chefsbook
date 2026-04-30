/**
 * Garden Template — Minimal, fresh, airy
 * Ottolenghi meets a modern art museum.
 * Celebrates food photography above all else.
 * KEY DIFFERENTIATOR: Uses Inter ONLY (no Playfair Display)
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
import type { BookStrings } from './book-strings';
import type { ComputedLayout, TemplateContext } from './engine/types';

// Register Inter only (Garden template uses Inter for everything)
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

// Fresh, airy colour palette
const WHITE = '#ffffff';
const GREEN = '#009246'; // Basil green - primary accent
const RED = '#ce2b37';   // Secondary, sparingly
const DARK = '#1a1a1a';
const MUTED = '#9a8a7a';
const BORDER = '#e8e0d0';
const FRAME = '#f0ece0';

const styles = StyleSheet.create({
  // Cover with image
  coverPage: {
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverTitle: {
    fontSize: 38,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },
  coverImageContainer: {
    width: '100%',
    maxHeight: 480,
    borderWidth: 1,
    borderColor: GREEN,
    marginBottom: 24,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverAuthor: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    marginTop: 'auto',
  },
  coverUrl: {
    position: 'absolute',
    bottom: 36,
    right: 60,
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: GREEN,
  },

  // Cover without image
  coverNoImage: {
    flex: 1,
    backgroundColor: WHITE,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '45%',
    position: 'relative',
  },
  coverTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: GREEN,
  },
  coverNoImageTitle: {
    fontSize: 52,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 16,
  },
  coverRule: {
    width: 48,
    height: 2,
    backgroundColor: GREEN,
    marginBottom: 16,
  },
  coverNoImageSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    marginBottom: 48,
  },

  // TOC
  tocPage: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 60,
    backgroundColor: WHITE,
  },
  tocTopRule: {
    height: 1,
    backgroundColor: GREEN,
    marginBottom: 24,
  },
  tocLabel: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 4,
    color: GREEN,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tocRecipe: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: DARK,
  },
  tocPageNum: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },

  // Recipe page with image
  recipeImagePage: {
    backgroundColor: WHITE,
    padding: 0,
  },
  recipeImageTop: {
    width: '100%',
    height: '55%',
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recipeImageFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: FRAME,
  },
  recipeHeader: {
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 16,
  },
  recipeTitle: {
    fontSize: 28,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: DARK,
    marginBottom: 8,
  },
  recipeMeta: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },

  // Recipe page without image
  recipeNoImage: {
    flex: 1,
    backgroundColor: WHITE,
    paddingTop: 80,
    paddingHorizontal: 48,
  },
  recipeNoImageTitle: {
    fontSize: 36,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  recipeNoImageMeta: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Content page
  contentPage: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    backgroundColor: WHITE,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 600,
    letterSpacing: 3,
    color: GREEN,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionRule: {
    height: 1,
    backgroundColor: GREEN,
    marginBottom: 16,
    width: 40,
  },
  ingredientItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  ingredientBullet: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: GREEN,
    marginRight: 8,
  },
  ingredientText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: DARK,
    lineHeight: 1.8,
  },
  stepsSection: {
    marginTop: 32,
  },
  stepWrap: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNum: {
    fontSize: 18,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: GREEN,
    width: 32,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: DARK,
    lineHeight: 1.65,
  },
  stepTimer: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    marginTop: 4,
  },
  notesSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: GREEN,
  },
  notesText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    lineHeight: 1.6,
  },

  // Running footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },

  // "A ChefsBook Cookbook" line on cover
  cookbookLine: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    marginTop: 24,
  },

  // Foreword page
  forewordPage: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 80,
    backgroundColor: WHITE,
    alignItems: 'center',
  },
  forewordLabel: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 4,
    color: GREEN,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  forewordRule: {
    width: 60,
    height: 1,
    backgroundColor: GREEN,
    marginBottom: 32,
  },
  forewordText: {
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: DARK,
    lineHeight: 1.8,
    textAlign: 'center',
    maxWidth: 450,
  },
  forewordAuthor: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'right',
    marginTop: 32,
  },

  // Back page
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 60,
  },
  backTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: GREEN,
  },
  backHat: {
    width: 60,
    height: 60,
    marginBottom: 20,
  },
  backWordmark: {
    fontSize: 28,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: DARK,
    marginBottom: 8,
  },
  backTagline: {
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    marginBottom: 16,
  },
  backDivider: {
    width: 60,
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 20,
  },
  backBlurb: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  backUrl: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: GREEN,
  },
});

function CoverPage({ cookbook, chefsHatBase64, strings, layout }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{
        backgroundColor: WHITE,
        justifyContent: 'center',
        alignItems: 'center',
        padding: layout.marginOuter,
      }}>
        <Text style={{ fontSize: layout.fontTitle * 0.8, fontFamily: 'Inter', fontWeight: 700, color: DARK, textAlign: 'center', marginBottom: layout.stepGap }}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={{ fontSize: layout.fontSubtitle * 0.7, fontFamily: 'Inter', fontWeight: 300, color: MUTED, textAlign: 'center', marginBottom: layout.sectionGap }}>{cookbook.subtitle}</Text>}
        <View style={{ width: '100%', maxHeight: layout.heroImageHeight * 2, borderWidth: 1, borderColor: GREEN, marginBottom: layout.sectionGap }}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
        </View>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>by {cookbook.author_name}</Text>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
        <Text style={{ position: 'absolute', bottom: 36, right: layout.marginOuter, fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 400, color: GREEN }}>chefsbk.app</Text>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }}>
      <View style={{ flex: 1, backgroundColor: WHITE, justifyContent: 'flex-start', alignItems: 'center', paddingTop: layout.marginTop * 4, position: 'relative' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: GREEN }} />
        <Text style={{ fontSize: layout.fontTitle, fontFamily: 'Inter', fontWeight: 700, color: DARK, textAlign: 'center', marginBottom: layout.sectionGap }}>{cookbook.title}</Text>
        <View style={{ width: 48, height: 2, backgroundColor: GREEN, marginBottom: layout.sectionGap }} />
        {cookbook.subtitle && <Text style={{ fontSize: layout.fontSubtitle * 0.7, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginBottom: layout.sectionGap * 2 }}>{cookbook.subtitle}</Text>}
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>by {cookbook.author_name}</Text>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage, strings, layout }: { recipes: CookbookRecipe[]; startPage: number; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop,
      paddingBottom: layout.marginBottom,
      paddingHorizontal: layout.marginOuter,
      backgroundColor: WHITE,
    }}>
      <View style={{ height: 1, backgroundColor: GREEN, marginBottom: layout.sectionGap }} />
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, letterSpacing: 4, color: GREEN, textTransform: 'uppercase', marginBottom: layout.sectionGap }}>{strings.contents.toUpperCase()}</Text>
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: layout.stepGap, borderBottomWidth: 0.5, borderBottomColor: BORDER }}>
          <Text style={{ flex: 1, fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 400, color: DARK }}>{recipe.title}</Text>
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>{startPage + idx * 2}</Text>
        </View>
      ))}
    </Page>
  );
}

function RecipePage({ recipe, strings, layout }: { recipe: CookbookRecipe; strings: BookStrings; layout: ComputedLayout }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: WHITE, padding: 0 }}>
        <View style={{ width: '100%', height: layout.heroImageHeight * 1.2, position: 'relative' }}>
          <Image src={primaryImage} style={styles.recipeImage} />
          <View style={styles.recipeImageFrame} />
        </View>
        <View style={{ paddingHorizontal: layout.marginOuter, paddingTop: layout.sectionGap, paddingBottom: layout.sectionGap }}>
          <Text style={{ fontSize: layout.fontSubtitle * 0.8, fontFamily: 'Inter', fontWeight: 700, color: DARK, marginBottom: layout.stepGap }}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>{meta.join('  ·  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }}>
      <View style={{ flex: 1, backgroundColor: WHITE, paddingTop: layout.marginTop * 1.5, paddingHorizontal: layout.marginOuter }}>
        <Text style={{ fontSize: layout.fontSubtitle, fontFamily: 'Inter', fontWeight: 700, color: DARK, textAlign: 'center', marginBottom: layout.stepGap }}>{recipe.title}</Text>
        {meta.length > 0 && <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED, textAlign: 'center', marginBottom: layout.sectionGap * 1.5 }}>{meta.join('  ·  ')}</Text>}
      </View>
    </Page>
  );
}

function AdditionalImagePage({ imageUrl, recipeTitle, layout }: { imageUrl: string; recipeTitle: string; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: WHITE, padding: 0 }}>
      <View style={{ width: '100%', height: layout.heroImageHeight * 1.2, position: 'relative' }}>
        <Image src={imageUrl} style={styles.recipeImage} />
        <View style={styles.recipeImageFrame} />
      </View>
      <View style={{ paddingHorizontal: layout.marginOuter, paddingTop: layout.sectionGap }}>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>{recipeTitle}</Text>
      </View>
    </Page>
  );
}

function CustomPageComponent({ customPage, layout }: { customPage: CustomPageData; layout: ComputedLayout }) {
  const hasImage = customPage.layout !== 'text_only' && customPage.image_url;
  const hasText = customPage.layout !== 'image_only' && customPage.text;

  if (customPage.layout === 'image_only' && customPage.image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: WHITE, padding: 0 }}>
        <View style={{ width: '100%', height: layout.heroImageHeight * 1.2, position: 'relative' }}>
          <Image src={customPage.image_url} style={styles.recipeImage} />
          <View style={styles.recipeImageFrame} />
        </View>
        {customPage.caption && (
          <View style={{ paddingHorizontal: layout.marginOuter, paddingTop: layout.sectionGap }}>
            <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>{customPage.caption}</Text>
          </View>
        )}
      </Page>
    );
  }

  if (customPage.layout === 'text_only') {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{
        paddingTop: layout.marginTop,
        paddingBottom: layout.marginBottom,
        paddingHorizontal: layout.marginOuter,
        backgroundColor: WHITE,
      }}>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: DARK, lineHeight: 1.8, textAlign: 'center', maxWidth: 450 }}>{customPage.text}</Text>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: WHITE, padding: 0 }}>
      {hasImage && (
        <View style={{ width: '100%', height: layout.heroImageHeight * 1.2, position: 'relative' }}>
          <Image src={customPage.image_url} style={styles.recipeImage} />
          <View style={styles.recipeImageFrame} />
        </View>
      )}
      <View style={{ paddingHorizontal: layout.marginOuter, paddingTop: layout.sectionGap }}>
        {customPage.caption && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>{customPage.caption}</Text>}
        {hasText && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginTop: layout.stepGap }}>{customPage.text}</Text>}
      </View>
    </Page>
  );
}

function FillZone({ fillType, fillContent, accentColor, layout }: { fillType?: string; fillContent?: { quoteText?: string; quoteAttribution?: string; customText?: string; customImageUrl?: string }; accentColor: string; layout: ComputedLayout }) {
  if (!fillType || fillType === 'blank') return null;

  if (fillType === 'chefs_notes') {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: layout.sectionGap }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: layout.stepGap }}>
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 600, color: accentColor }}>Chef's Notes</Text>
          <Text style={{ fontSize: layout.fontCaption * 0.8, marginLeft: 4, color: MUTED }}>✎</Text>
        </View>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, marginBottom: layout.sectionGap }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, height: layout.sectionGap }} />
        ))}
      </View>
    );
  }

  if (fillType === 'quote' && fillContent?.quoteText) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: layout.sectionGap }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: BORDER, width: '60%', marginBottom: layout.sectionGap }} />
        <Text style={{ fontSize: layout.fontSubtitle, color: accentColor, marginBottom: 4 }}>"</Text>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, textAlign: 'center', maxWidth: '80%', lineHeight: 1.6, color: DARK }}>
          {fillContent.quoteText}
        </Text>
        {fillContent.quoteAttribution && (
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginTop: layout.stepGap }}>
            — {fillContent.quoteAttribution}
          </Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, width: '60%', marginTop: layout.sectionGap }} />
      </View>
    );
  }

  if (fillType === 'custom' && (fillContent?.customText || fillContent?.customImageUrl)) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: layout.sectionGap }}>
        {fillContent.customImageUrl && (
          <Image src={fillContent.customImageUrl} style={{ maxWidth: layout.heroImageHeight * 0.85, maxHeight: layout.heroImageHeight * 0.5, objectFit: 'contain', marginBottom: fillContent.customText ? layout.stepGap : 0 }} />
        )}
        {fillContent.customText && (
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: DARK, textAlign: 'center', maxWidth: '80%', lineHeight: 1.5 }}>
            {fillContent.customText}
          </Text>
        )}
      </View>
    );
  }

  return null;
}

function RecipeContentPage({ recipe, strings, pageSize, layout }: { recipe: CookbookRecipe; strings: BookStrings; pageSize: PageSizeKey; layout: ComputedLayout }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop,
      paddingBottom: layout.marginBottom + 12,
      paddingHorizontal: layout.marginOuter,
      backgroundColor: WHITE,
    }}>
      <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 600, letterSpacing: 3, color: GREEN, textTransform: 'uppercase', marginBottom: 8 }}>{strings.ingredients.toUpperCase()}</Text>
      <View style={{ height: 1, backgroundColor: GREEN, marginBottom: layout.sectionGap, width: 40 }} />

      {ingredientGroups.map((group, gi) => (
        <View key={gi}>
          {group.items.map((ing, i) => {
            const qty = formatQuantity(ing.quantity);
            const unit = ing.unit ?? '';
            const prep = ing.preparation ? `, ${ing.preparation}` : '';
            return (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }}>
                <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 400, color: GREEN, marginRight: 8 }}>–</Text>
                <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 400, color: DARK, lineHeight: 1.8 }}>
                  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      <View style={{ marginTop: 32 }}>
        <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 600, letterSpacing: 3, color: GREEN, textTransform: 'uppercase', marginBottom: 8 }}>{strings.steps.toUpperCase()}</Text>
        <View style={{ height: 1, backgroundColor: GREEN, marginBottom: layout.sectionGap, width: 40 }} />

        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: layout.stepGap + 6 }} wrap={false} minPresenceAhead={40}>
              {/* Badge - fixed size, never shrinks */}
              <View style={{
                width: layout.badgeSize,
                height: layout.badgeSize,
                borderRadius: layout.badgeSize / 2,
                backgroundColor: GREEN,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Text style={{ color: '#ffffff', fontSize: layout.badgeFontSize, fontFamily: 'Inter', fontWeight: 700 }}>
                  {String(step.step_number)}
                </Text>
              </View>
              {/* Text - fills remaining row width, wraps naturally */}
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <Text style={{ fontSize: layout.fontBody + 1, fontFamily: 'Inter', fontWeight: 300, color: DARK, lineHeight: 1.65 }}>{instruction}</Text>
                {step.timer_minutes && step.timer_minutes > 0 && (
                  <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginTop: 4 }}>({formatDuration(step.timer_minutes)})</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {recipe.notes && (
        <View style={{ marginTop: 24, paddingTop: layout.sectionGap, borderTopWidth: 1, borderTopColor: GREEN }} wrap={false}>
          <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 600, letterSpacing: 3, color: GREEN, textTransform: 'uppercase', marginBottom: 8 }}>{strings.notes.toUpperCase()}</Text>
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED, lineHeight: 1.6 }}>{recipe.notes}</Text>
        </View>
      )}

      <FillZone fillType={recipe.fillType} fillContent={recipe.fillContent} accentColor={GREEN} layout={layout} />

      <View style={{ position: 'absolute', bottom: 30, left: layout.marginOuter, right: layout.marginOuter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8 }} fixed>
        <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>ChefsBook</Text>
        <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>{truncate(recipe.title, 40)}</Text>
        <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 300, color: MUTED }} render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, authorName, strings, layout }: { foreword: string; authorName: string; strings: BookStrings; layout: ComputedLayout }) {
  const forewordLabel = strings.foreword.toUpperCase().split('').join(' ');
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop * 1.5,
      paddingBottom: layout.marginBottom,
      paddingHorizontal: layout.marginOuter * 1.5,
      backgroundColor: WHITE,
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, letterSpacing: 4, color: GREEN, textTransform: 'uppercase', marginBottom: layout.stepGap }}>{forewordLabel}</Text>
      <View style={{ width: 60, height: 1, backgroundColor: GREEN, marginBottom: layout.sectionGap * 1.5 }} />
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: DARK, lineHeight: 1.8, textAlign: 'center', maxWidth: 450 }}>{foreword}</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED, textAlign: 'right', marginTop: layout.sectionGap * 1.5 }}>— {authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings, layout }: { chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: WHITE,
      paddingHorizontal: layout.marginOuter,
    }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: GREEN }} />
      {chefsHatBase64 && <Image src={chefsHatBase64} style={{ width: layout.badgeSize * 2.7, height: layout.badgeSize * 2.7, marginBottom: layout.sectionGap }} />}
      <Text style={{ fontSize: layout.fontSubtitle * 0.8, fontFamily: 'Inter', fontWeight: 700, color: DARK, marginBottom: layout.stepGap }}>ChefsBook</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginBottom: layout.sectionGap }}>{strings.tagline}</Text>
      <View style={{ width: 60, height: 1, backgroundColor: BORDER, marginVertical: layout.sectionGap }} />
      <Text style={{ fontSize: layout.fontBody - 1, fontFamily: 'Inter', fontWeight: 300, color: MUTED, textAlign: 'center', lineHeight: 1.6, marginBottom: layout.sectionGap }}>
        This cookbook was created with ChefsBook — the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 400, color: GREEN }}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function GardenDocument(ctx: TemplateContext) {
  const { cookbook, recipes, chefsHatBase64, layout, strings } = ctx;
  const tocPages = Math.ceil(recipes.length / 20);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />

      {/* Blank page after cover */}
      <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: WHITE }} />

      <TOCPage recipes={recipes} startPage={startPage} strings={strings} layout={layout} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} strings={strings} layout={layout} />
      )}

      {recipes.map((recipe) => (
        <React.Fragment key={recipe.id}>
          <RecipePage recipe={recipe} strings={strings} layout={layout} />
          {/* Render additional image pages (images beyond the first one) */}
          {recipe.image_urls.slice(1).map((imageUrl, imgIdx) => (
            <AdditionalImagePage key={`${recipe.id}-img-${imgIdx}`} imageUrl={imageUrl} recipeTitle={recipe.title} layout={layout} />
          ))}
          <RecipeContentPage recipe={recipe} strings={strings} pageSize={cookbook.pageSize ?? 'letter'} layout={layout} />
          {/* Render custom pages after content page */}
          {recipe.custom_pages?.map((cp) => (
            <CustomPageComponent key={cp.id} customPage={cp} layout={layout} />
          ))}
        </React.Fragment>
      ))}

      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />
    </Document>
  );
}

export default GardenDocument;
