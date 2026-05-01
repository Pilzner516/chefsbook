/**
 * Studio Template — Modern, dark, dramatic
 * A chef's private notebook. Eleven Madison Park meets Noma.
 * Every recipe feels like a revelation.
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

// Register fonts
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
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

// Dark colour palette
const DARK_BG = '#1a1a1a';
const CARD_BG = '#242424';
const RED = '#ce2b37';
const WHITE = '#f5f0e8';
const WHITE_MUTED = 'rgba(245, 240, 232, 0.5)';
const WHITE_BORDER = 'rgba(245, 240, 232, 0.12)';
const GHOST = 'rgba(255, 255, 255, 0.04)';

const styles = StyleSheet.create({
  // Cover with image
  coverPage: {
    flexDirection: 'row',
    backgroundColor: DARK_BG,
  },
  coverImageHalf: {
    width: '50%',
    height: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverTextHalf: {
    width: '50%',
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  coverRedRule: {
    width: 60,
    height: 1,
    backgroundColor: RED,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 44,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
    textAlign: 'center',
    marginBottom: 48,
  },
  coverAuthor: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 36,
    right: 36,
  },
  coverFooterText: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
  },

  // Cover without image
  coverNoImage: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '45%',
    position: 'relative',
  },
  coverAccentBar: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: RED,
  },
  coverNoImageTitle: {
    fontSize: 48,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: WHITE,
    textAlign: 'center',
    marginBottom: 24,
  },
  coverNoImageSubtitle: {
    fontSize: 18,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: RED,
    marginBottom: 48,
  },
  coverNoImageAuthor: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
  },

  // TOC
  tocPage: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 54,
    backgroundColor: DARK_BG,
  },
  tocLabel: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 4,
    color: WHITE,
    textTransform: 'uppercase',
    marginBottom: 36,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: WHITE_BORDER,
  },
  tocRecipe: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Playfair Display',
    fontWeight: 400,
    color: WHITE,
  },
  tocPageNum: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: RED,
  },

  // Recipe image page
  recipeImagePage: {
    position: 'relative',
  },
  recipeFullImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recipeImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  recipeImageText: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
  },
  recipeImageTitle: {
    fontSize: 34,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 8,
  },
  recipeImageMeta: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  recipeNoImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
  },
  recipeNoImageTitle: {
    fontSize: 40,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: WHITE,
    textAlign: 'center',
    marginBottom: 24,
  },
  recipeNoImageRule: {
    width: 60,
    height: 1,
    backgroundColor: RED,
  },

  // Recipe content page
  contentPage: {
    paddingTop: 40,
    paddingBottom: 54,
    paddingHorizontal: 48,
    backgroundColor: DARK_BG,
  },
  ingredientBand: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: WHITE_BORDER,
    paddingVertical: 20,
    marginBottom: 32,
  },
  ingredientLabel: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 3,
    color: RED,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  ingredientFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ingredientItem: {
    width: '33%',
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE,
    marginBottom: 6,
    paddingRight: 8,
  },
  stepsSection: {
    flex: 1,
  },
  stepWrap: {
    position: 'relative',
    marginBottom: 24,
    paddingLeft: 8,
  },
  ghostNumber: {
    position: 'absolute',
    top: -20,
    left: 0,
    fontSize: 72,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: GHOST,
  },
  stepText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: WHITE,
    lineHeight: 1.7,
    paddingLeft: 8,
  },
  stepTimer: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: RED,
    marginTop: 6,
    paddingLeft: 8,
  },
  notesSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: WHITE_BORDER,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 3,
    color: RED,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
    lineHeight: 1.5,
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
    borderTopColor: WHITE_BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: 'rgba(255, 255, 255, 0.35)',
  },

  // "A ChefsBook Cookbook" line on cover
  cookbookLine: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
    marginTop: 24,
  },

  // Foreword page
  forewordPage: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 80,
    backgroundColor: DARK_BG,
  },
  forewordLabel: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 4,
    color: RED,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  forewordRule: {
    width: 60,
    height: 1,
    backgroundColor: RED,
    marginBottom: 32,
  },
  forewordText: {
    fontSize: 13,
    fontFamily: 'Playfair Display',
    fontWeight: 400,
    fontStyle: 'italic',
    color: WHITE,
    lineHeight: 1.8,
    textAlign: 'center',
    maxWidth: 450,
  },
  forewordAuthor: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
    textAlign: 'right',
    marginTop: 32,
  },

  // Back page
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
    paddingHorizontal: 60,
  },
  backHat: {
    width: 80,
    height: 80,
    marginBottom: 24,
    opacity: 0.8,
  },
  backWordmark: {
    fontSize: 32,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: WHITE,
    marginBottom: 12,
  },
  backTagline: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
    marginBottom: 16,
  },
  backDivider: {
    width: 60,
    height: 1,
    backgroundColor: WHITE_BORDER,
    marginVertical: 20,
  },
  backBlurb: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: WHITE_MUTED,
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  backUrl: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: RED,
  },
});

function CoverPage({ cookbook, chefsHatBase64, strings, layout }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ flexDirection: 'row', backgroundColor: DARK_BG }}>
        <View style={{ width: '50%', height: '100%' }}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
        </View>
        <View style={{ width: '50%', backgroundColor: DARK_BG, justifyContent: 'center', alignItems: 'center', paddingHorizontal: layout.marginOuter * 0.7 }}>
          <View style={{ width: 60, height: 1, backgroundColor: RED, marginBottom: layout.sectionGap }} />
          <Text style={{ fontSize: layout.fontTitle * 0.9, fontFamily: 'Playfair Display', fontWeight: 700, color: WHITE, textAlign: 'center', marginBottom: layout.stepGap }}>{cookbook.title}</Text>
          {cookbook.subtitle && <Text style={{ fontSize: layout.fontSubtitle * 0.7, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, textAlign: 'center', marginBottom: layout.sectionGap * 2 }}>{cookbook.subtitle}</Text>}
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED }}>by {cookbook.author_name}</Text>
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
        </View>
        <View style={{ position: 'absolute', bottom: 36, right: 36 }}>
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED }}>ChefsBook</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }}>
      <View style={{ flex: 1, backgroundColor: DARK_BG, justifyContent: 'flex-start', alignItems: 'center', paddingTop: layout.marginTop * 4, position: 'relative' }}>
        <View style={{ position: 'absolute', top: '40%', left: 0, right: 0, height: 8, backgroundColor: RED }} />
        <Text style={{ fontSize: layout.fontTitle, fontFamily: 'Playfair Display', fontWeight: 700, color: WHITE, textAlign: 'center', marginBottom: layout.sectionGap }}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={{ fontSize: layout.fontSubtitle * 0.8, fontFamily: 'Inter', fontWeight: 300, color: RED, marginBottom: layout.sectionGap * 2 }}>{cookbook.subtitle}</Text>}
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED }}>by {cookbook.author_name}</Text>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
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
      backgroundColor: DARK_BG,
    }}>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, letterSpacing: 4, color: WHITE, textTransform: 'uppercase', marginBottom: layout.sectionGap * 1.5 }}>{strings.contents.toUpperCase()}</Text>
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: layout.stepGap, borderBottomWidth: 0.5, borderBottomColor: WHITE_BORDER }}>
          <Text style={{ flex: 1, fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontWeight: 400, color: WHITE }}>{recipe.title}</Text>
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: RED }}>{startPage + idx * 2}</Text>
        </View>
      ))}
    </Page>
  );
}

function RecipeImagePage({ recipe, strings, layout }: { recipe: CookbookRecipe; strings: BookStrings; layout: ComputedLayout }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative' }}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: layout.heroImageHeight, backgroundColor: 'rgba(0, 0, 0, 0.75)' }} />
        <View style={{ position: 'absolute', bottom: layout.marginBottom, left: layout.marginOuter, right: layout.marginOuter }}>
          <Text style={{ fontSize: layout.fontSubtitle, fontFamily: 'Playfair Display', fontWeight: 700, color: '#ffffff', marginBottom: layout.stepGap }}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: 'rgba(255, 255, 255, 0.6)' }}>{meta.join('  ·  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_BG }}>
        <Text style={{ fontSize: layout.fontSubtitle * 1.1, fontFamily: 'Playfair Display', fontWeight: 700, color: WHITE, textAlign: 'center', marginBottom: layout.sectionGap }}>{recipe.title}</Text>
        <View style={{ width: 60, height: 1, backgroundColor: RED }} />
      </View>
    </Page>
  );
}

function AdditionalImagePage({ imageUrl, recipeTitle, layout }: { imageUrl: string; recipeTitle: string; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative' }}>
      <Image src={imageUrl} style={styles.recipeFullImage} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: layout.heroImageHeight, backgroundColor: 'rgba(0, 0, 0, 0.75)' }} />
      <View style={{ position: 'absolute', bottom: layout.marginBottom, left: layout.marginOuter, right: layout.marginOuter }}>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: 'rgba(255, 255, 255, 0.6)' }}>{recipeTitle}</Text>
      </View>
    </Page>
  );
}

function CustomPageComponent({ customPage, layout }: { customPage: CustomPageData; layout: ComputedLayout }) {
  const hasImage = customPage.layout !== 'text_only' && customPage.image_url;
  const hasText = customPage.layout !== 'image_only' && customPage.text;

  if (customPage.layout === 'image_only' && customPage.image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative' }}>
        <Image src={customPage.image_url} style={styles.recipeFullImage} />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: layout.heroImageHeight, backgroundColor: 'rgba(0, 0, 0, 0.75)' }} />
        {customPage.caption && (
          <View style={{ position: 'absolute', bottom: layout.marginBottom, left: layout.marginOuter, right: layout.marginOuter }}>
            <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: 'rgba(255, 255, 255, 0.6)' }}>{customPage.caption}</Text>
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
        backgroundColor: DARK_BG,
      }}>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontWeight: 400, fontStyle: 'italic', color: WHITE, lineHeight: 1.8, textAlign: 'center', maxWidth: 450 }}>{customPage.text}</Text>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative' }}>
      {hasImage && <Image src={customPage.image_url} style={styles.recipeFullImage} />}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: layout.heroImageHeight, backgroundColor: 'rgba(0, 0, 0, 0.75)' }} />
      <View style={{ position: 'absolute', bottom: layout.marginBottom, left: layout.marginOuter, right: layout.marginOuter }}>
        {customPage.caption && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: 'rgba(255, 255, 255, 0.6)' }}>{customPage.caption}</Text>}
        {hasText && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: 'rgba(255, 255, 255, 0.6)', marginTop: layout.stepGap }}>{customPage.text}</Text>}
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
          <Text style={{ fontSize: layout.fontCaption * 0.8, marginLeft: 4, color: WHITE_MUTED }}>✎</Text>
        </View>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: WHITE_BORDER, marginBottom: layout.sectionGap }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: WHITE_BORDER, height: layout.sectionGap }} />
        ))}
      </View>
    );
  }

  if (fillType === 'quote' && fillContent?.quoteText) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: layout.sectionGap }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: WHITE_BORDER, width: '60%', marginBottom: layout.sectionGap }} />
        <Text style={{ fontSize: layout.fontSubtitle, color: accentColor, marginBottom: 4 }}>"</Text>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontStyle: 'italic', textAlign: 'center', maxWidth: '80%', lineHeight: 1.6, color: WHITE }}>
          {fillContent.quoteText}
        </Text>
        {fillContent.quoteAttribution && (
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, marginTop: layout.stepGap }}>
            — {fillContent.quoteAttribution}
          </Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: WHITE_BORDER, width: '60%', marginTop: layout.sectionGap }} />
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
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: WHITE, textAlign: 'center', maxWidth: '80%', lineHeight: 1.5 }}>
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
  const allIngredients = ingredientGroups.flatMap(g => g.items);

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop,
      paddingBottom: layout.marginBottom,
      paddingHorizontal: layout.marginOuter,
      backgroundColor: DARK_BG,
    }}>
      <View style={{
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: WHITE_BORDER,
        paddingVertical: layout.sectionGap,
        marginBottom: layout.sectionGap * 2,
      }}>
        <Text style={{
          fontSize: layout.fontCaption,
          fontFamily: 'Inter',
          fontWeight: 300,
          letterSpacing: 3,
          color: RED,
          textTransform: 'uppercase',
          marginBottom: layout.sectionGap,
        }}>{strings.ingredients.toUpperCase()}</Text>
        <View style={styles.ingredientFlow}>
          {allIngredients.map((ing, i) => {
            const qty = formatQuantity(ing.quantity);
            const unit = ing.unit ?? '';
            return (
              <Text key={i} style={{
                width: '33%',
                fontSize: layout.fontCaption,
                fontFamily: 'Inter',
                fontWeight: 300,
                color: WHITE,
                marginBottom: 6,
                paddingRight: 8,
              }}>
                {qty} {unit} {ing.ingredient}
              </Text>
            );
          })}
        </View>
      </View>

      <View style={styles.stepsSection}>
        <Text style={{
          fontSize: layout.fontCaption,
          fontFamily: 'Inter',
          fontWeight: 300,
          letterSpacing: 3,
          color: RED,
          textTransform: 'uppercase',
          marginBottom: layout.sectionGap,
        }}>{strings.steps.toUpperCase()}</Text>
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={{
              position: 'relative',
              marginBottom: layout.stepGap * 2.4,
              paddingLeft: 8,
            }} wrap={false} minPresenceAhead={100}>
              <Text style={{
                position: 'absolute',
                top: -20,
                left: 0,
                fontSize: layout.fontTitle * 2,
                fontFamily: 'Playfair Display',
                fontWeight: 700,
                color: GHOST,
              }}>{step.step_number}</Text>
              <Text style={{
                fontSize: layout.fontBody,
                fontFamily: 'Inter',
                fontWeight: 400,
                color: WHITE,
                lineHeight: layout.lineHeight,
                paddingLeft: 8,
              }}>{instruction}</Text>
              {step.timer_minutes && step.timer_minutes > 0 && (
                <Text style={{
                  fontSize: layout.fontCaption,
                  fontFamily: 'Inter',
                  fontWeight: 300,
                  color: RED,
                  marginTop: 6,
                  paddingLeft: 8,
                }}>{formatDuration(step.timer_minutes)}</Text>
              )}
            </View>
          );
        })}
      </View>

      {recipe.notes && (
        <View style={{
          marginTop: layout.sectionGap,
          paddingTop: layout.sectionGap,
          borderTopWidth: 0.5,
          borderTopColor: WHITE_BORDER,
        }} wrap={false}>
          <Text style={{
            fontSize: layout.fontCaption,
            fontFamily: 'Inter',
            fontWeight: 300,
            letterSpacing: 3,
            color: RED,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>{strings.notes.toUpperCase()}</Text>
          <Text style={{
            fontSize: layout.fontCaption,
            fontFamily: 'Inter',
            fontWeight: 300,
            color: WHITE_MUTED,
            lineHeight: layout.lineHeight,
          }}>{recipe.notes}</Text>
        </View>
      )}

      <FillZone fillType={recipe.fillType} fillContent={recipe.fillContent} accentColor={RED} layout={layout} />

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>ChefsBook</Text>
        <Text style={styles.footerText}>{truncate(recipe.title, 40)}</Text>
        <Text style={styles.footerText} render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, authorName, strings, layout }: { foreword: string; authorName: string; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop * 1.5,
      paddingBottom: layout.marginBottom,
      paddingHorizontal: layout.marginOuter * 1.5,
      backgroundColor: DARK_BG,
    }}>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, letterSpacing: 4, color: RED, textTransform: 'uppercase', marginBottom: layout.stepGap }}>F O R E W O R D</Text>
      <View style={{ width: 60, height: 1, backgroundColor: RED, marginBottom: layout.sectionGap * 1.5 }} />
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontWeight: 400, fontStyle: 'italic', color: WHITE, lineHeight: 1.8, textAlign: 'center', maxWidth: 450 }}>{foreword}</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, textAlign: 'right', marginTop: layout.sectionGap * 1.5 }}>— {authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings, layout }: { chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: DARK_BG,
      paddingHorizontal: layout.marginOuter,
    }}>
      {chefsHatBase64 && <Image src={chefsHatBase64} style={{ width: layout.badgeSize * 3.5, height: layout.badgeSize * 3.5, marginBottom: layout.sectionGap, opacity: 0.8 }} />}
      <Text style={{ fontSize: layout.fontSubtitle, fontFamily: 'Playfair Display', fontWeight: 700, color: WHITE, marginBottom: layout.stepGap }}>ChefsBook</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, marginBottom: layout.sectionGap }}>{strings.tagline}</Text>
      <View style={{ width: 60, height: 1, backgroundColor: WHITE_BORDER, marginVertical: layout.sectionGap }} />
      <Text style={{ fontSize: layout.fontBody - 1, fontFamily: 'Inter', fontWeight: 300, color: WHITE_MUTED, textAlign: 'center', lineHeight: 1.6, marginBottom: layout.sectionGap }}>
        This cookbook was created with ChefsBook — the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={{ fontSize: layout.fontBody - 1, fontFamily: 'Inter', fontWeight: 400, color: RED }}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function StudioDocument(ctx: TemplateContext) {
  const { cookbook, recipes, chefsHatBase64, layout, strings } = ctx;
  const tocPages = Math.ceil(recipes.length / 20);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />

      {/* Blank page after cover */}
      <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: DARK_BG }} />

      <TOCPage recipes={recipes} startPage={startPage} strings={strings} layout={layout} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} strings={strings} layout={layout} />
      )}

      {recipes.map((recipe) => (
        <React.Fragment key={recipe.id}>
          <RecipeImagePage recipe={recipe} strings={strings} layout={layout} />
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

export default StudioDocument;
