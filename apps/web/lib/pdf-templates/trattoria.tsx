/**
 * Trattoria Template — Classic, warm, rustic
 * Feels like a beloved Italian cookbook from the 1970s.
 * Marcella Hazan meets modern food photography.
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
import type { ComputedLayout, TemplateContext, MenuChapterData } from './engine/types';
import { MenuChapterPage } from './MenuChapterPage';

// Register fonts via jsDelivr CDN (reliable TTF files)
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf', fontWeight: 600 },
  ],
});

// Colour palette
const CREAM = '#faf7f0';
const CREAM_DARK = '#f0ece0';
const RED = '#ce2b37';
const GREEN = '#009246';
const DARK = '#1a1a1a';
const MUTED = '#7a6a5a';
const BORDER = '#ddd8cc';

const styles = StyleSheet.create({
  // Cover page
  coverPage: {
    backgroundColor: CREAM,
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
    height: '35%',
    backgroundColor: 'rgba(250, 247, 240, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  coverNoCover: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: CREAM,
    paddingTop: '45%',
  },
  coverFrame: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 1.5,
    borderColor: RED,
  },
  coverHatIcon: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 48,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverTitleWhite: {
    fontSize: 48,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 22,
    fontFamily: 'Playfair Display',
    fontWeight: 400,
    fontStyle: 'italic',
    color: MUTED,
    textAlign: 'center',
    marginBottom: 16,
  },
  coverDivider: {
    width: 80,
    height: 1,
    backgroundColor: RED,
    marginVertical: 16,
  },
  coverAuthor: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'center',
  },
  coverFooter: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  coverFooterText: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },
  coverFooterUrl: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: RED,
    marginTop: 4,
  },

  // TOC
  tocPage: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 54,
    backgroundColor: CREAM_DARK,
  },
  tocTitle: {
    fontSize: 36,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: RED,
    marginBottom: 12,
  },
  tocDivider: {
    height: 1,
    backgroundColor: RED,
    marginBottom: 24,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tocRecipe: {
    fontSize: 13,
    fontFamily: 'Playfair Display',
    fontWeight: 400,
    color: DARK,
    flexShrink: 0,
    paddingRight: 8,
  },
  tocLeader: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 4,
  },
  tocPageNum: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    paddingLeft: 8,
    minWidth: 24,
    textAlign: 'right',
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
  recipeImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 230, // ~30% of page height
    backgroundColor: 'rgba(250, 247, 240, 0.92)',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  recipeImageTitle: {
    fontSize: 28,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: DARK,
    marginTop: 16,
    marginBottom: 8,
  },
  recipeImageMeta: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: MUTED,
    marginTop: 4,
  },
  recipeNoImagePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
  },
  recipeNoImageTitle: {
    fontSize: 36,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  cuisinePill: {
    backgroundColor: RED,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cuisinePillText: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 500,
    color: '#ffffff',
  },

  // Recipe content page
  contentPage: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingLeft: 63,
    paddingRight: 45,
    backgroundColor: CREAM,
  },
  ingredientsSection: {
    backgroundColor: CREAM_DARK,
    padding: 16,
    marginBottom: 20,
  },
  stepsSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: RED,
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 600,
    color: DARK,
    marginTop: 8,
    marginBottom: 4,
  },
  ingredient: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: DARK,
    marginBottom: 3,
  },
  stepWrap: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNum: {
    width: 28,
    fontSize: 14,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: RED,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: DARK,
    lineHeight: 1.6,
  },
  stepTimer: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: GREEN,
    marginTop: 4,
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
  notesText: {
    fontSize: 10.5,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    lineHeight: 1.5,
  },
  secondImage: {
    height: 80,
    marginTop: 16,
    objectFit: 'cover',
  },

  // Running footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 63,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerLeft: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },
  footerCenter: {
    fontSize: 8,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    maxWidth: 200,
    textAlign: 'center',
  },
  footerRight: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: DARK,
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
    backgroundColor: CREAM,
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
    backgroundColor: CREAM,
    paddingHorizontal: 60,
  },
  backHat: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  backWordmark: {
    fontSize: 32,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    color: DARK,
    marginBottom: 12,
  },
  backTagline: {
    fontSize: 14,
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
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: RED,
  },
});

function CoverPage({ cookbook, chefsHatBase64, strings, layout }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={styles.coverPage}>
        <View style={styles.coverWithImage}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
          <View style={{ ...styles.coverOverlay, height: layout.heroImageHeight, paddingHorizontal: layout.marginOuter }}>
            <Text style={{ ...styles.coverTitle, fontSize: layout.fontTitle }}>{cookbook.title}</Text>
            {cookbook.subtitle && <Text style={{ ...styles.coverSubtitle, fontSize: layout.fontSubtitle }}>{cookbook.subtitle}</Text>}
            <View style={styles.coverDivider} />
            <Text style={{ ...styles.coverAuthor, fontSize: layout.fontBody }}>{cookbook.author_name}</Text>
            <Text style={{ ...styles.cookbookLine, fontSize: layout.fontCaption, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
          </View>
        </View>
        <View style={styles.coverFooter}>
          <Text style={{ ...styles.coverFooterText, fontSize: layout.fontCaption }}>{strings.createdWith}</Text>
          <Text style={{ ...styles.coverFooterUrl, fontSize: layout.fontCaption }}>chefsbk.app</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={styles.coverPage}>
      <View style={styles.coverFrame} />
      <View style={{ ...styles.coverNoCover, paddingTop: layout.marginTop * 4 }}>
        {chefsHatBase64 && <Image src={chefsHatBase64} style={{ width: layout.badgeSize * 3.5, height: layout.badgeSize * 3.5, marginBottom: layout.sectionGap }} />}
        <Text style={{ ...styles.coverTitle, fontSize: layout.fontTitle }}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={{ ...styles.coverSubtitle, fontSize: layout.fontSubtitle }}>{cookbook.subtitle}</Text>}
        <View style={styles.coverDivider} />
        <Text style={{ ...styles.coverAuthor, fontSize: layout.fontBody }}>{cookbook.author_name}</Text>
        <Text style={{ ...styles.cookbookLine, fontSize: layout.fontCaption, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
      </View>
      <View style={styles.coverFooter}>
        <Text style={{ ...styles.coverFooterText, fontSize: layout.fontCaption }}>{strings.createdWith}</Text>
        <Text style={{ ...styles.coverFooterUrl, fontSize: layout.fontCaption }}>chefsbk.app</Text>
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
      backgroundColor: CREAM_DARK,
    }}>
      <Text style={{ fontSize: layout.fontSubtitle, fontFamily: 'Playfair Display', fontWeight: 700, color: RED, marginBottom: layout.stepGap }}>{strings.contents}</Text>
      <View style={styles.tocDivider} />
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={{ ...styles.tocEntry, marginBottom: layout.stepGap }}>
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontWeight: 400, color: DARK, flexShrink: 0, paddingRight: 8 }}>{recipe.title}</Text>
          <View style={styles.tocLeader} />
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED, paddingLeft: 8, minWidth: 24, textAlign: 'right' }}>{startPage + idx * 2}</Text>
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
      <Page size={{ width: layout.width, height: layout.height }} style={styles.recipeImagePage}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={{ ...styles.recipeImageOverlay, height: layout.heroImageHeight, paddingHorizontal: layout.marginOuter }}>
          <Text style={{ fontSize: layout.fontSubtitle * 0.8, fontFamily: 'Playfair Display', fontWeight: 700, color: DARK, marginTop: layout.sectionGap, marginBottom: layout.stepGap * 0.8 }}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 400, color: MUTED }}>{meta.join('  ·  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={styles.recipeNoImagePage}>
      <Text style={{ fontSize: layout.fontSubtitle, fontFamily: 'Playfair Display', fontWeight: 700, color: DARK, textAlign: 'center', marginBottom: layout.stepGap }}>{recipe.title}</Text>
      {recipe.cuisine && (
        <View style={{ backgroundColor: RED, paddingHorizontal: layout.stepGap, paddingVertical: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 500, color: '#ffffff' }}>{recipe.cuisine}</Text>
        </View>
      )}
    </Page>
  );
}

function AdditionalImagePage({ imageUrl, recipeTitle, layout }: { imageUrl: string; recipeTitle: string; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={styles.recipeImagePage}>
      <Image src={imageUrl} style={styles.recipeFullImage} />
      <View style={{ ...styles.recipeImageOverlay, height: layout.heroImageHeight, paddingHorizontal: layout.marginOuter }}>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 400, color: MUTED }}>{recipeTitle}</Text>
      </View>
    </Page>
  );
}

function CustomPageComponent({ customPage, layout }: { customPage: CustomPageData; layout: ComputedLayout }) {
  const hasImage = customPage.layout !== 'text_only' && customPage.image_url;
  const hasText = customPage.layout !== 'image_only' && customPage.text;

  if (customPage.layout === 'image_only' && customPage.image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={styles.recipeImagePage}>
        <Image src={customPage.image_url} style={styles.recipeFullImage} />
        {customPage.caption && (
          <View style={{ ...styles.recipeImageOverlay, height: layout.heroImageHeight, paddingHorizontal: layout.marginOuter }}>
            <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 400, color: MUTED }}>{customPage.caption}</Text>
          </View>
        )}
      </Page>
    );
  }

  if (customPage.layout === 'text_only') {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{
        paddingTop: layout.marginTop * 1.5,
        paddingBottom: layout.marginBottom,
        paddingHorizontal: layout.marginOuter * 1.5,
        backgroundColor: CREAM,
      }}>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontWeight: 400, fontStyle: 'italic', color: DARK, lineHeight: 1.8, textAlign: 'center', maxWidth: 450 }}>{customPage.text}</Text>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={styles.recipeImagePage}>
      {hasImage && <Image src={customPage.image_url} style={styles.recipeFullImage} />}
      <View style={{ ...styles.recipeImageOverlay, height: layout.heroImageHeight, paddingHorizontal: layout.marginOuter }}>
        {customPage.caption && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 400, color: MUTED }}>{customPage.caption}</Text>}
        {hasText && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 400, color: MUTED, marginTop: layout.stepGap }}>{customPage.text}</Text>}
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
          <Text style={{ fontSize: layout.fontCaption * 0.8, marginLeft: 4 }}>✎</Text>
        </View>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#ddd8cc', marginBottom: layout.sectionGap }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: '#e8e0d0', height: layout.sectionGap }} />
        ))}
      </View>
    );
  }

  if (fillType === 'quote' && fillContent?.quoteText) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: layout.sectionGap }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: '#ddd8cc', width: '60%', marginBottom: layout.sectionGap }} />
        <Text style={{ fontSize: layout.fontSubtitle, color: accentColor, marginBottom: 4 }}>"</Text>
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontStyle: 'italic', textAlign: 'center', maxWidth: '80%', lineHeight: 1.6 }}>
          {fillContent.quoteText}
        </Text>
        {fillContent.quoteAttribution && (
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: '#7a6a5a', marginTop: layout.stepGap }}>
            — {fillContent.quoteAttribution}
          </Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#ddd8cc', width: '60%', marginTop: layout.sectionGap }} />
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

function RecipeContentPage({ recipe, pageNumber, strings, pageSize, layout }: { recipe: CookbookRecipe; pageNumber: number; strings: BookStrings; pageSize: PageSizeKey; layout: ComputedLayout }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop,
      paddingBottom: layout.marginBottom,
      paddingLeft: layout.marginInner,
      paddingRight: layout.marginOuter,
      backgroundColor: CREAM,
    }} wrap>
      {/* Ingredients section - allows pagination for long lists */}
      <View style={{ backgroundColor: CREAM_DARK, padding: layout.sectionGap, marginBottom: 20 }}>
        <Text style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: RED, marginBottom: 12 }}>{strings.ingredients.toUpperCase()}</Text>
        {ingredientGroups.map((group, gi) => (
          <View key={gi}>
            {group.label && <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 600, color: DARK, marginTop: 8, marginBottom: 4 }}>{group.label}</Text>}
            {group.items.map((ing, i) => {
              const qty = formatQuantity(ing.quantity);
              const unit = ing.unit ?? '';
              const prep = ing.preparation ? `, ${ing.preparation}` : '';
              return (
                <Text key={i} style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 400, color: DARK, marginBottom: 3 }}>
                  •  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                </Text>
              );
            })}
          </View>
        ))}
      </View>

      {/* Steps section - flows across pages, individual steps don't break */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: RED, marginBottom: 12 }}>{strings.steps.toUpperCase()}</Text>
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: layout.stepGap }} wrap={false} minPresenceAhead={100}>
              {/* Badge - fixed size, never shrinks */}
              <View style={{
                width: layout.badgeSize,
                height: layout.badgeSize,
                borderRadius: layout.badgeSize / 2,
                backgroundColor: RED,
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
                <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 400, color: DARK, lineHeight: layout.lineHeight }}>{instruction}</Text>
                {step.timer_minutes && step.timer_minutes > 0 && (
                  <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, color: GREEN, marginTop: 4 }}>{formatDuration(step.timer_minutes)}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {recipe.notes && (
        <View style={{ marginTop: layout.sectionGap, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: BORDER }} wrap={false}>
          <Text style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: RED, marginBottom: 12 }}>{strings.notes.toUpperCase()}</Text>
          <Text style={{ fontSize: layout.fontBody - 0.5, fontFamily: 'Inter', fontWeight: 300, color: MUTED, lineHeight: 1.5 }}>{recipe.notes}</Text>
        </View>
      )}

      {/* Fill zone - flexGrow fills remaining space */}
      <FillZone fillType={recipe.fillType} fillContent={recipe.fillContent} accentColor={RED} layout={layout} />

      <View style={{ position: 'absolute', bottom: 30, left: layout.marginInner, right: layout.marginOuter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8 }} fixed>
        <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 300, color: MUTED }}>ChefsBook</Text>
        <Text style={{ fontSize: 8, fontFamily: 'Inter', fontWeight: 300, color: MUTED, maxWidth: 200, textAlign: 'center' }}>{truncate(recipe.title, 40)}</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 400, color: DARK }} render={({ pageNumber: pn }) => `${pn}`} />
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
      backgroundColor: CREAM,
    }}>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Inter', fontWeight: 300, letterSpacing: 4, color: RED, textTransform: 'uppercase', marginBottom: layout.stepGap }}>{forewordLabel}</Text>
      <View style={{ width: 60, height: 1, backgroundColor: RED, marginBottom: layout.sectionGap * 1.5 }} />
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Playfair Display', fontWeight: 400, fontStyle: 'italic', color: DARK, lineHeight: 1.8, textAlign: 'center', maxWidth: 450 }}>{foreword}</Text>
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
      backgroundColor: CREAM,
      paddingHorizontal: layout.marginOuter,
    }}>
      {chefsHatBase64 && <Image src={chefsHatBase64} style={{ width: layout.badgeSize * 3.5, height: layout.badgeSize * 3.5, marginBottom: layout.sectionGap }} />}
      <Text style={{ fontSize: layout.fontSubtitle * 0.9, fontFamily: 'Playfair Display', fontWeight: 700, color: DARK, marginBottom: layout.stepGap }}>{strings.tagline ? 'ChefsBook' : 'ChefsBook'}</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginBottom: layout.sectionGap }}>{strings.tagline}</Text>
      <View style={{ width: 60, height: 1, backgroundColor: BORDER, marginVertical: layout.sectionGap }} />
      <Text style={{ fontSize: layout.fontBody - 1, fontFamily: 'Inter', fontWeight: 300, color: MUTED, textAlign: 'center', lineHeight: 1.6, marginBottom: layout.sectionGap }}>
        This cookbook was created with ChefsBook — the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={{ fontSize: layout.fontBody - 1, fontFamily: 'Inter', fontWeight: 400, color: RED }}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function TrattoriaDocument(ctx: TemplateContext) {
  const { cookbook, recipes, chefsHatBase64, layout, strings, organisation, menuChapters } = ctx;
  const tocPages = Math.ceil(recipes.length / 25);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  const templateSettings = {
    palette: {
      accent: RED,
      background: CREAM,
      text: DARK,
      muted: MUTED,
      surface: CREAM_DARK,
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Inter',
    },
  };

  const renderRecipe = (recipe: CookbookRecipe, pageNumber: number) => (
    <React.Fragment key={recipe.id}>
      <RecipeImagePage recipe={recipe} strings={strings} layout={layout} />
      {recipe.image_urls.slice(1).map((imageUrl, imgIdx) => (
        <AdditionalImagePage key={`${recipe.id}-img-${imgIdx}`} imageUrl={imageUrl} recipeTitle={recipe.title} layout={layout} />
      ))}
      <RecipeContentPage recipe={recipe} pageNumber={pageNumber} strings={strings} pageSize={cookbook.pageSize ?? 'letter'} layout={layout} />
      {recipe.custom_pages?.map((cp) => (
        <CustomPageComponent key={cp.id} customPage={cp} layout={layout} />
      ))}
    </React.Fragment>
  );

  const renderByMenu = () => {
    if (!menuChapters || menuChapters.length === 0) {
      return recipes.map((recipe, idx) => renderRecipe(recipe, startPage + idx * 2 + 1));
    }

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const renderedRecipeIds = new Set<string>();
    let currentPage = startPage;
    const elements: React.ReactNode[] = [];

    for (const chapter of menuChapters) {
      const chapterRecipes = chapter.recipe_ids
        .map((id) => recipeMap.get(id))
        .filter((r): r is CookbookRecipe => !!r && !renderedRecipeIds.has(r.id));

      if (chapterRecipes.length === 0) continue;

      elements.push(
        <MenuChapterPage
          key={`chapter-${chapter.menu_id}`}
          menuTitle={chapter.menu_title}
          occasion={chapter.occasion}
          menuNotes={chapter.notes}
          recipeCount={chapterRecipes.length}
          chapterNumber={chapter.chapter_number}
          layout={layout}
          settings={templateSettings}
          strings={strings}
          chefsHatBase64={chefsHatBase64}
        />
      );
      currentPage += 1;

      for (const recipe of chapterRecipes) {
        elements.push(renderRecipe(recipe, currentPage));
        renderedRecipeIds.add(recipe.id);
        currentPage += 2 + (recipe.image_urls.length > 1 ? recipe.image_urls.length - 1 : 0) + (recipe.custom_pages?.length || 0);
      }
    }

    const unassignedRecipes = recipes.filter((r) => !renderedRecipeIds.has(r.id));
    if (unassignedRecipes.length > 0) {
      elements.push(
        <MenuChapterPage
          key="chapter-other"
          menuTitle={strings.otherRecipes || 'Other Recipes'}
          recipeCount={unassignedRecipes.length}
          chapterNumber={menuChapters.length + 1}
          layout={layout}
          settings={templateSettings}
          strings={strings}
          chefsHatBase64={chefsHatBase64}
        />
      );
      currentPage += 1;

      for (const recipe of unassignedRecipes) {
        elements.push(renderRecipe(recipe, currentPage));
        currentPage += 2 + (recipe.image_urls.length > 1 ? recipe.image_urls.length - 1 : 0) + (recipe.custom_pages?.length || 0);
      }
    }

    return elements;
  };

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />

      {/* Blank page after cover */}
      <Page size={{ width: layout.width, height: layout.height }} style={{ backgroundColor: CREAM }} />

      <TOCPage recipes={recipes} startPage={startPage} strings={strings} layout={layout} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} strings={strings} layout={layout} />
      )}

      {organisation === 'by_menu'
        ? renderByMenu()
        : recipes.map((recipe, idx) => renderRecipe(recipe, startPage + idx * 2 + 1))}

      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />
    </Document>
  );
}

export default TrattoriaDocument;
