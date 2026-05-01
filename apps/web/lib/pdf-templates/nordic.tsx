/**
 * Nordic Template — Stark, minimal, Scandinavian
 * Inspired by Noma, Rene Redzepi, Scandinavian design.
 * Massive white space, photos bleed to edges, ultra clean.
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

// Register Work Sans only (Nordic template uses single font family)
Font.register({
  family: 'Work Sans',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-500-normal.ttf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

// Stark Scandinavian colour palette
const WHITE = '#ffffff';
const CHARCOAL = '#2d2d2d';
const CHARCOAL_LIGHT = '#4a4a4a';
const BLUE = '#5c7a8a';
const BLUE_LIGHT = '#8ba3af';
const GREY_LIGHT = '#f5f5f5';
const BORDER = '#e0e0e0';

const styles = StyleSheet.create({
  // Cover with image - full bleed
  coverPage: {
    backgroundColor: WHITE,
    position: 'relative',
  },
  coverWithImage: {
    flex: 1,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 48,
    paddingTop: 28,
  },
  coverTitle: {
    fontSize: 38,
    fontFamily: 'Work Sans',
    fontWeight: 700,
    color: CHARCOAL,
    letterSpacing: -1,
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 14,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
    marginBottom: 16,
  },
  coverAuthor: {
    fontSize: 11,
    fontFamily: 'Work Sans',
    fontWeight: 400,
    color: BLUE,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 24,
    right: 48,
  },
  coverFooterText: {
    fontSize: 8,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
  },

  // Cover without image
  coverNoCover: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 48,
    paddingTop: '45%',
    backgroundColor: WHITE,
  },
  coverNoImageAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '40%',
    height: '100%',
    backgroundColor: GREY_LIGHT,
  },
  coverNoImageTitle: {
    fontSize: 48,
    fontFamily: 'Work Sans',
    fontWeight: 700,
    color: CHARCOAL,
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  coverNoImageSubtitle: {
    fontSize: 16,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: BLUE,
    marginBottom: 24,
  },
  coverNoImageAuthor: {
    fontSize: 12,
    fontFamily: 'Work Sans',
    fontWeight: 400,
    color: CHARCOAL_LIGHT,
  },
  coverHatIcon: {
    width: 48,
    height: 48,
    marginBottom: 24,
  },
  cookbookLine: {
    fontSize: 9,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
    marginTop: 20,
  },

  // TOC
  tocPage: {
    paddingTop: 72,
    paddingBottom: 54,
    paddingHorizontal: 72,
    backgroundColor: WHITE,
  },
  tocLabel: {
    fontSize: 8,
    fontFamily: 'Work Sans',
    fontWeight: 500,
    letterSpacing: 3,
    color: BLUE,
    textTransform: 'uppercase',
    marginBottom: 32,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  tocPageNum: {
    fontSize: 11,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: BLUE,
    width: 28,
  },
  tocRecipe: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Work Sans',
    fontWeight: 400,
    color: CHARCOAL,
  },
  tocMeta: {
    fontSize: 9,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
  },

  // Recipe image page - full bleed
  recipeImagePage: {
    position: 'relative',
    backgroundColor: WHITE,
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
    paddingHorizontal: 48,
    paddingVertical: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  recipeImageTitle: {
    fontSize: 28,
    fontFamily: 'Work Sans',
    fontWeight: 700,
    color: CHARCOAL,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  recipeImageMeta: {
    fontSize: 10,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: BLUE,
  },
  recipeNoImage: {
    flex: 1,
    backgroundColor: WHITE,
    paddingHorizontal: 72,
    paddingTop: 120,
  },
  recipeNoImageAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 6,
    height: '100%',
    backgroundColor: BLUE,
  },
  recipeNoImageTitle: {
    fontSize: 36,
    fontFamily: 'Work Sans',
    fontWeight: 700,
    color: CHARCOAL,
    letterSpacing: -1,
    marginBottom: 16,
  },
  recipeNoImageMeta: {
    fontSize: 11,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: BLUE,
  },

  // Content page
  contentPage: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    backgroundColor: WHITE,
  },
  ingredientSection: {
    marginBottom: 36,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Work Sans',
    fontWeight: 500,
    letterSpacing: 3,
    color: BLUE,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  ingredientColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ingredientItem: {
    width: '50%',
    paddingRight: 16,
    marginBottom: 8,
  },
  ingredientText: {
    fontSize: 10,
    fontFamily: 'Work Sans',
    fontWeight: 400,
    color: CHARCOAL,
    lineHeight: 1.6,
  },
  ingredientQty: {
    fontWeight: 600,
    color: CHARCOAL,
  },
  stepsSection: {
    flex: 1,
  },
  stepWrap: {
    marginBottom: 20,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: BORDER,
  },
  stepNum: {
    fontSize: 9,
    fontFamily: 'Work Sans',
    fontWeight: 500,
    color: BLUE,
    marginBottom: 4,
    marginLeft: 12,
  },
  stepText: {
    fontSize: 11,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL,
    lineHeight: 1.7,
    marginLeft: 12,
  },
  stepTimer: {
    fontSize: 9,
    fontFamily: 'Work Sans',
    fontWeight: 400,
    color: BLUE_LIGHT,
    marginTop: 6,
    marginLeft: 12,
  },
  notesSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  notesText: {
    fontSize: 10,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
    lineHeight: 1.6,
  },

  // Running footer
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
  },
  footerPage: {
    fontSize: 8,
    fontFamily: 'Work Sans',
    fontWeight: 500,
    color: BLUE,
  },

  // Foreword page
  forewordPage: {
    paddingTop: 100,
    paddingBottom: 60,
    paddingHorizontal: 80,
    backgroundColor: WHITE,
  },
  forewordAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 6,
    height: '100%',
    backgroundColor: BLUE,
  },
  forewordLabel: {
    fontSize: 8,
    fontFamily: 'Work Sans',
    fontWeight: 500,
    letterSpacing: 3,
    color: BLUE,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  forewordText: {
    fontSize: 13,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL,
    lineHeight: 2,
  },
  forewordAuthor: {
    fontSize: 10,
    fontFamily: 'Work Sans',
    fontWeight: 400,
    color: BLUE,
    marginTop: 36,
  },

  // Back page
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: WHITE,
    paddingHorizontal: 72,
    position: 'relative',
  },
  backAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '30%',
    height: '100%',
    backgroundColor: GREY_LIGHT,
  },
  backHat: {
    width: 48,
    height: 48,
    marginBottom: 20,
  },
  backWordmark: {
    fontSize: 28,
    fontFamily: 'Work Sans',
    fontWeight: 700,
    color: CHARCOAL,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  backTagline: {
    fontSize: 12,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: BLUE,
    marginBottom: 24,
  },
  backBlurb: {
    fontSize: 11,
    fontFamily: 'Work Sans',
    fontWeight: 300,
    color: CHARCOAL_LIGHT,
    lineHeight: 1.8,
    marginBottom: 24,
    maxWidth: 340,
  },
  backUrl: {
    fontSize: 10,
    fontFamily: 'Work Sans',
    fontWeight: 500,
    color: BLUE,
  },
});

function CoverPage({ cookbook, chefsHatBase64, strings, layout }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={styles.coverPage}>
        <View style={styles.coverWithImage}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
          <View style={{ ...styles.coverImageOverlay, height: layout.heroImageHeight, paddingHorizontal: layout.marginOuter, paddingTop: layout.sectionGap }}>
            <Text style={{ fontSize: layout.fontTitle * 0.8, fontFamily: 'Work Sans', fontWeight: 700, color: CHARCOAL, letterSpacing: -1, marginBottom: 4 }}>{cookbook.title}</Text>
            {cookbook.subtitle && <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL_LIGHT, marginBottom: layout.sectionGap }}>{cookbook.subtitle}</Text>}
            <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 400, color: BLUE }}>by {cookbook.author_name}</Text>
          </View>
        </View>
        <View style={{ position: 'absolute', bottom: 24, right: layout.marginOuter }}>
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL_LIGHT }}>ChefsBook</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={styles.coverPage}>
      <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start', paddingHorizontal: layout.marginOuter, paddingTop: layout.marginTop * 4, backgroundColor: WHITE }}>
        <View style={styles.coverNoImageAccent} />
        {chefsHatBase64 && <Image src={chefsHatBase64} style={{ width: layout.badgeSize * 2, height: layout.badgeSize * 2, marginBottom: layout.sectionGap }} />}
        <Text style={{ fontSize: layout.fontTitle, fontFamily: 'Work Sans', fontWeight: 700, color: CHARCOAL, letterSpacing: -1.5, marginBottom: layout.stepGap }}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={{ fontSize: layout.fontSubtitle * 0.7, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE, marginBottom: layout.sectionGap }}>{cookbook.subtitle}</Text>}
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 400, color: CHARCOAL_LIGHT }}>by {cookbook.author_name}</Text>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL_LIGHT, marginTop: layout.sectionGap }}>A ChefsBook Cookbook</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage, strings, layout }: { recipes: CookbookRecipe[]; startPage: number; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop * 1.3,
      paddingBottom: layout.marginBottom,
      paddingHorizontal: layout.marginOuter * 1.3,
      backgroundColor: WHITE,
    }}>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 500, letterSpacing: 3, color: BLUE, textTransform: 'uppercase', marginBottom: layout.sectionGap * 1.5 }}>{strings.contents}</Text>
      {recipes.map((recipe, idx) => {
        const meta: string[] = [];
        if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
        if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

        return (
          <View key={recipe.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: layout.stepGap * 1.4 }}>
            <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE, width: 28 }}>{startPage + idx * 2}</Text>
            <Text style={{ flex: 1, fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 400, color: CHARCOAL }}>{recipe.title}</Text>
            {meta.length > 0 && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL_LIGHT }}>{meta.join(' / ')}</Text>}
          </View>
        );
      })}
    </Page>
  );
}

function RecipeImagePage({ recipe, strings, layout }: { recipe: CookbookRecipe; strings: BookStrings; layout: ComputedLayout }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative', backgroundColor: WHITE }}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: layout.marginOuter, paddingVertical: layout.sectionGap, backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
          <Text style={{ fontSize: layout.fontSubtitle * 0.8, fontFamily: 'Work Sans', fontWeight: 700, color: CHARCOAL, letterSpacing: -0.5, marginBottom: 6 }}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE }}>{meta.join('  /  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative', backgroundColor: WHITE }}>
      <View style={{ flex: 1, backgroundColor: WHITE, paddingHorizontal: layout.marginOuter * 1.3, paddingTop: layout.marginTop * 2.5 }}>
        <View style={styles.recipeNoImageAccent} />
        <Text style={{ fontSize: layout.fontSubtitle, fontFamily: 'Work Sans', fontWeight: 700, color: CHARCOAL, letterSpacing: -1, marginBottom: layout.sectionGap }}>{recipe.title}</Text>
        {meta.length > 0 && <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE }}>{meta.join('  /  ')}</Text>}
      </View>
    </Page>
  );
}

function AdditionalImagePage({ imageUrl, recipeTitle, layout }: { imageUrl: string; recipeTitle: string; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative', backgroundColor: WHITE }}>
      <Image src={imageUrl} style={styles.recipeFullImage} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: layout.marginOuter, paddingVertical: layout.sectionGap, backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
        <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE }}>{recipeTitle}</Text>
      </View>
    </Page>
  );
}

function CustomPageComponent({ customPage, layout }: { customPage: CustomPageData; layout: ComputedLayout }) {
  const hasImage = customPage.layout !== 'text_only' && customPage.image_url;
  const hasText = customPage.layout !== 'image_only' && customPage.text;

  if (customPage.layout === 'image_only' && customPage.image_url) {
    return (
      <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative', backgroundColor: WHITE }}>
        <Image src={customPage.image_url} style={styles.recipeFullImage} />
        {customPage.caption && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: layout.marginOuter, paddingVertical: layout.sectionGap, backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
            <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE }}>{customPage.caption}</Text>
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
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL, lineHeight: 2 }}>{customPage.text}</Text>
      </Page>
    );
  }

  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{ position: 'relative', backgroundColor: WHITE }}>
      {hasImage && <Image src={customPage.image_url} style={styles.recipeFullImage} />}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: layout.marginOuter, paddingVertical: layout.sectionGap, backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
        {customPage.caption && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE }}>{customPage.caption}</Text>}
        {hasText && <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE, marginTop: layout.stepGap }}>{customPage.text}</Text>}
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
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 600, color: accentColor }}>Chef's Notes</Text>
          <Text style={{ fontSize: layout.fontCaption * 0.8, marginLeft: 4, color: CHARCOAL_LIGHT }}>✎</Text>
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
        <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, textAlign: 'center', maxWidth: '80%', lineHeight: 1.6, color: CHARCOAL }}>
          {fillContent.quoteText}
        </Text>
        {fillContent.quoteAttribution && (
          <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL_LIGHT, marginTop: layout.stepGap }}>
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
          <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL, textAlign: 'center', maxWidth: '80%', lineHeight: 1.5 }}>
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
      paddingBottom: layout.marginBottom + 12,
      paddingHorizontal: layout.marginOuter,
      backgroundColor: WHITE,
    }}>
      <View style={{ marginBottom: layout.sectionGap }}>
        <Text style={{
          fontSize: layout.fontCaption,
          fontFamily: 'Work Sans',
          fontWeight: 500,
          letterSpacing: 3,
          color: BLUE,
          textTransform: 'uppercase',
          marginBottom: layout.sectionGap,
        }}>{strings.ingredients}</Text>
        <View style={styles.ingredientColumns}>
          {allIngredients.map((ing, i) => {
            const qty = formatQuantity(ing.quantity);
            const unit = ing.unit ?? '';
            return (
              <View key={i} style={styles.ingredientItem}>
                <Text style={{
                  fontSize: layout.fontCaption,
                  fontFamily: 'Work Sans',
                  fontWeight: 400,
                  color: CHARCOAL,
                  lineHeight: layout.lineHeight,
                }}>
                  <Text style={{ fontWeight: 600, color: CHARCOAL }}>{qty}</Text> {unit} {ing.ingredient}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.stepsSection}>
        <Text style={{
          fontSize: layout.fontCaption,
          fontFamily: 'Work Sans',
          fontWeight: 500,
          letterSpacing: 3,
          color: BLUE,
          textTransform: 'uppercase',
          marginBottom: layout.sectionGap,
        }}>{strings.steps}</Text>
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={{
              marginBottom: layout.stepGap * 2,
              paddingLeft: 4,
              borderLeftWidth: 2,
              borderLeftColor: BORDER,
            }} wrap={false} minPresenceAhead={100}>
              <Text style={{
                fontSize: layout.fontCaption,
                fontFamily: 'Work Sans',
                fontWeight: 500,
                color: BLUE,
                marginBottom: 4,
                marginLeft: 12,
              }}>{String(step.step_number).padStart(2, '0')}</Text>
              <Text style={{
                fontSize: layout.fontBody,
                fontFamily: 'Work Sans',
                fontWeight: 300,
                color: CHARCOAL,
                lineHeight: layout.lineHeight,
                marginLeft: 12,
              }}>{instruction}</Text>
              {step.timer_minutes && step.timer_minutes > 0 && (
                <Text style={{
                  fontSize: layout.fontCaption,
                  fontFamily: 'Work Sans',
                  fontWeight: 400,
                  color: BLUE_LIGHT,
                  marginTop: 6,
                  marginLeft: 12,
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
          borderTopWidth: 1,
          borderTopColor: BORDER,
        }} wrap={false}>
          <Text style={{
            fontSize: layout.fontCaption,
            fontFamily: 'Work Sans',
            fontWeight: 500,
            letterSpacing: 3,
            color: BLUE,
            textTransform: 'uppercase',
            marginBottom: layout.sectionGap,
          }}>{strings.notes}</Text>
          <Text style={{
            fontSize: layout.fontCaption,
            fontFamily: 'Work Sans',
            fontWeight: 300,
            color: CHARCOAL_LIGHT,
            lineHeight: layout.lineHeight,
          }}>{recipe.notes}</Text>
        </View>
      )}

      <FillZone fillType={recipe.fillType} fillContent={recipe.fillContent} accentColor={BLUE} layout={layout} />

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{truncate(recipe.title, 40)}</Text>
        <Text style={styles.footerPage} render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, authorName, strings, layout }: { foreword: string; authorName: string; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      paddingTop: layout.marginTop * 2,
      paddingBottom: layout.marginBottom,
      paddingHorizontal: layout.marginOuter * 1.5,
      backgroundColor: WHITE,
    }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', backgroundColor: BLUE }} />
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 500, letterSpacing: 3, color: BLUE, textTransform: 'uppercase', marginBottom: layout.sectionGap * 1.5 }}>{strings.foreword}</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL, lineHeight: 2 }}>{foreword}</Text>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 400, color: BLUE, marginTop: layout.sectionGap * 2 }}>{authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings, layout }: { chefsHatBase64?: string | null; strings: BookStrings; layout: ComputedLayout }) {
  return (
    <Page size={{ width: layout.width, height: layout.height }} style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-start',
      backgroundColor: WHITE,
      paddingHorizontal: layout.marginOuter * 1.3,
      position: 'relative',
    }}>
      <View style={styles.backAccent} />
      {chefsHatBase64 && <Image src={chefsHatBase64} style={{ width: layout.badgeSize * 2, height: layout.badgeSize * 2, marginBottom: layout.sectionGap }} />}
      <Text style={{ fontSize: layout.fontSubtitle * 0.8, fontFamily: 'Work Sans', fontWeight: 700, color: CHARCOAL, letterSpacing: -0.5, marginBottom: layout.stepGap }}>ChefsBook</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: BLUE, marginBottom: layout.sectionGap }}>{strings.tagline}</Text>
      <Text style={{ fontSize: layout.fontBody, fontFamily: 'Work Sans', fontWeight: 300, color: CHARCOAL_LIGHT, lineHeight: 1.8, marginBottom: layout.sectionGap, maxWidth: 340 }}>
        This cookbook was created with ChefsBook. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={{ fontSize: layout.fontCaption, fontFamily: 'Work Sans', fontWeight: 500, color: BLUE }}>chefsbk.app</Text>
    </Page>
  );
}

export function NordicDocument(ctx: TemplateContext) {
  const { cookbook, recipes, chefsHatBase64, layout, strings, organisation, menuChapters } = ctx;
  const tocPages = Math.ceil(recipes.length / 20);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  const templateSettings = {
    palette: {
      accent: BLUE,
      background: WHITE,
      text: CHARCOAL,
      muted: CHARCOAL_LIGHT,
      surface: GREY_LIGHT,
    },
    fonts: {
      heading: 'Work Sans',
      body: 'Work Sans',
    },
  };

  const renderRecipe = (recipe: CookbookRecipe) => (
    <React.Fragment key={recipe.id}>
      <RecipeImagePage recipe={recipe} strings={strings} layout={layout} />
      {recipe.image_urls.slice(1).map((imageUrl, imgIdx) => (
        <AdditionalImagePage key={`${recipe.id}-img-${imgIdx}`} imageUrl={imageUrl} recipeTitle={recipe.title} layout={layout} />
      ))}
      <RecipeContentPage recipe={recipe} strings={strings} pageSize={cookbook.pageSize ?? 'letter'} layout={layout} />
      {recipe.custom_pages?.map((cp) => (
        <CustomPageComponent key={cp.id} customPage={cp} layout={layout} />
      ))}
    </React.Fragment>
  );

  const renderByMenu = () => {
    if (!menuChapters || menuChapters.length === 0) {
      return recipes.map((recipe) => renderRecipe(recipe));
    }

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const renderedRecipeIds = new Set<string>();
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

      for (const recipe of chapterRecipes) {
        elements.push(renderRecipe(recipe));
        renderedRecipeIds.add(recipe.id);
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

      for (const recipe of unassignedRecipes) {
        elements.push(renderRecipe(recipe));
      }
    }

    return elements;
  };

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

      {organisation === 'by_menu' ? renderByMenu() : recipes.map((recipe) => renderRecipe(recipe))}

      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} layout={layout} />
    </Document>
  );
}

export default NordicDocument;
