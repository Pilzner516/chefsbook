/**
 * Spice Template — Rich, ornate, celebratory
 * Inspired by Jerusalem, Ottolenghi, Middle Eastern cookbooks.
 * Jewel tones, decorative patterns, warm exotic feel.
 */
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import {
  CookbookPdfOptions,
  CookbookRecipe,
  groupIngredients,
  formatDuration,
  formatQuantity,
  truncate,
  fixTimerCharacter,
} from './types';

// Register fonts via jsDelivr CDN
Font.register({
  family: 'Cormorant Garamond',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-500-normal.ttf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-700-normal.ttf', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Lato',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lato@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lato@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lato@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

// Rich jewel-tone colour palette
const SAFFRON = '#d4a84b';
const SAFFRON_LIGHT = '#f5e6c8';
const POMEGRANATE = '#8b2942';
const POMEGRANATE_LIGHT = '#d4a3b0';
const TEAL = '#1a6b6b';
const TEAL_LIGHT = '#a8d4d4';
const CREAM = '#faf8f5';
const DARK = '#2a2520';
const MUTED = '#6a5a4a';
const BORDER = '#e8dcc8';

const styles = StyleSheet.create({
  // Cover with image - full bleed with ornate overlay
  coverPage: {
    backgroundColor: CREAM,
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
  coverDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(42, 37, 32, 0.55)',
  },
  coverTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  coverDecoPattern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  coverDecoLine: {
    width: 40,
    height: 1,
    backgroundColor: SAFFRON,
  },
  coverDecoDiamond: {
    width: 8,
    height: 8,
    backgroundColor: SAFFRON,
    transform: 'rotate(45deg)',
    marginHorizontal: 12,
  },
  coverTitle: {
    fontSize: 46,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 18,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 400,
    fontStyle: 'italic',
    color: SAFFRON_LIGHT,
    textAlign: 'center',
    marginBottom: 24,
  },
  coverDecoBottom: {
    width: 60,
    height: 2,
    backgroundColor: SAFFRON,
    marginBottom: 20,
  },
  coverAuthor: {
    fontSize: 13,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: '#ffffff',
    textAlign: 'center',
  },
  coverFooter: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  coverFooterText: {
    fontSize: 9,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Cover without image
  coverNoCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
    position: 'relative',
  },
  coverOrnateFrame: {
    position: 'absolute',
    top: 28,
    left: 28,
    right: 28,
    bottom: 28,
    borderWidth: 2,
    borderColor: SAFFRON,
  },
  coverOrnateFrameInner: {
    position: 'absolute',
    top: 36,
    left: 36,
    right: 36,
    bottom: 36,
    borderWidth: 1,
    borderColor: POMEGRANATE_LIGHT,
  },
  coverTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: POMEGRANATE,
  },
  coverBottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: TEAL,
  },
  coverHatIcon: {
    width: 56,
    height: 56,
    marginBottom: 16,
  },
  coverNoImageTitle: {
    fontSize: 44,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverNoImageSubtitle: {
    fontSize: 16,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 400,
    fontStyle: 'italic',
    color: POMEGRANATE,
    textAlign: 'center',
    marginBottom: 24,
  },
  coverNoImageAuthor: {
    fontSize: 12,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: MUTED,
  },
  cookbookLine: {
    fontSize: 10,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: MUTED,
    marginTop: 28,
  },

  // TOC
  tocPage: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 54,
    backgroundColor: CREAM,
  },
  tocTopBorder: {
    height: 3,
    backgroundColor: POMEGRANATE,
    marginBottom: 24,
  },
  tocDecoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tocDecoLine: {
    width: 50,
    height: 1,
    backgroundColor: SAFFRON,
  },
  tocDecoDiamond: {
    width: 6,
    height: 6,
    backgroundColor: SAFFRON,
    transform: 'rotate(45deg)',
    marginHorizontal: 10,
  },
  tocTitle: {
    fontSize: 30,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 24,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tocRecipe: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 500,
    color: DARK,
  },
  tocCuisine: {
    fontSize: 9,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: TEAL,
    marginRight: 16,
  },
  tocPageNum: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: POMEGRANATE,
    minWidth: 24,
    textAlign: 'right',
  },

  // Recipe image page - full bleed hero
  recipeImagePage: {
    position: 'relative',
    backgroundColor: CREAM,
  },
  recipeFullImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recipeImageDarkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(42, 37, 32, 0.75)',
  },
  recipeImageTextArea: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
  },
  recipeImageDeco: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeImageDecoLine: {
    width: 30,
    height: 1,
    backgroundColor: SAFFRON,
  },
  recipeImageDecoDiamond: {
    width: 6,
    height: 6,
    backgroundColor: SAFFRON,
    transform: 'rotate(45deg)',
    marginHorizontal: 8,
  },
  recipeImageTitle: {
    fontSize: 32,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 8,
  },
  recipeImageMeta: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: SAFFRON_LIGHT,
  },
  recipeNoImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
    position: 'relative',
  },
  recipeNoImageBorder: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 2,
    borderColor: SAFFRON,
  },
  recipeNoImageTitle: {
    fontSize: 36,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  recipeNoImageDeco: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cuisinePill: {
    backgroundColor: POMEGRANATE,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 3,
  },
  cuisinePillText: {
    fontSize: 10,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: '#ffffff',
  },

  // Content page
  contentPage: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    backgroundColor: CREAM,
    position: 'relative',
  },
  contentTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: TEAL,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Lato',
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: POMEGRANATE,
    marginBottom: 4,
  },
  sectionDeco: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionDecoLine: {
    width: 24,
    height: 1,
    backgroundColor: SAFFRON,
  },
  sectionDecoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SAFFRON,
    marginLeft: 8,
  },
  ingredientBox: {
    backgroundColor: SAFFRON_LIGHT,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: SAFFRON,
  },
  groupLabel: {
    fontSize: 12,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 600,
    color: POMEGRANATE,
    marginTop: 10,
    marginBottom: 6,
  },
  ingredient: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: DARK,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  ingredientBullet: {
    color: TEAL,
    fontWeight: 700,
  },
  stepsSection: {
    flex: 1,
  },
  stepWrap: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAL,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 12,
    fontFamily: 'Lato',
    fontWeight: 700,
    color: '#ffffff',
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepText: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: DARK,
    lineHeight: 1.65,
  },
  stepTimer: {
    fontSize: 10,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: SAFFRON,
    marginTop: 4,
  },
  notesSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: SAFFRON,
  },
  notesText: {
    fontSize: 10.5,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 400,
    fontStyle: 'italic',
    color: MUTED,
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
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerLeft: {
    fontSize: 8,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: MUTED,
  },
  footerCenter: {
    fontSize: 8,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 400,
    fontStyle: 'italic',
    color: MUTED,
    maxWidth: 200,
    textAlign: 'center',
  },
  footerRight: {
    fontSize: 9,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: POMEGRANATE,
  },

  // Foreword page
  forewordPage: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 72,
    backgroundColor: CREAM,
    alignItems: 'center',
    position: 'relative',
  },
  forewordTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: POMEGRANATE,
  },
  forewordDecoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  forewordDecoLine: {
    width: 40,
    height: 1,
    backgroundColor: SAFFRON,
  },
  forewordDecoDiamond: {
    width: 6,
    height: 6,
    backgroundColor: SAFFRON,
    transform: 'rotate(45deg)',
    marginHorizontal: 10,
  },
  forewordLabel: {
    fontSize: 9,
    fontFamily: 'Lato',
    fontWeight: 300,
    letterSpacing: 4,
    color: POMEGRANATE,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  forewordText: {
    fontSize: 14,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 400,
    fontStyle: 'italic',
    color: DARK,
    lineHeight: 1.9,
    textAlign: 'center',
    maxWidth: 420,
  },
  forewordAuthor: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: TEAL,
    marginTop: 36,
  },

  // Back page
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
    paddingHorizontal: 60,
    position: 'relative',
  },
  backTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: POMEGRANATE,
  },
  backBottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: TEAL,
  },
  backHat: {
    width: 56,
    height: 56,
    marginBottom: 16,
  },
  backDecoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backDecoLine: {
    width: 50,
    height: 1,
    backgroundColor: SAFFRON,
  },
  backDecoDiamond: {
    width: 8,
    height: 8,
    backgroundColor: SAFFRON,
    transform: 'rotate(45deg)',
    marginHorizontal: 12,
  },
  backWordmark: {
    fontSize: 30,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 700,
    color: DARK,
    marginBottom: 8,
  },
  backTagline: {
    fontSize: 14,
    fontFamily: 'Cormorant Garamond',
    fontWeight: 400,
    fontStyle: 'italic',
    color: POMEGRANATE,
    marginBottom: 20,
  },
  backDivider: {
    width: 60,
    height: 2,
    backgroundColor: SAFFRON,
    marginVertical: 16,
  },
  backBlurb: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 1.7,
    marginBottom: 20,
    maxWidth: 380,
  },
  backUrl: {
    fontSize: 11,
    fontFamily: 'Lato',
    fontWeight: 400,
    color: TEAL,
  },
});

function CoverPage({ cookbook, chefsHatBase64 }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverWithImage}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
          <View style={styles.coverDarkOverlay} />
          <View style={styles.coverTextContainer}>
            <View style={styles.coverDecoPattern}>
              <View style={styles.coverDecoLine} />
              <View style={styles.coverDecoDiamond} />
              <View style={styles.coverDecoLine} />
            </View>
            <Text style={styles.coverTitle}>{cookbook.title}</Text>
            {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
            <View style={styles.coverDecoBottom} />
            <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
          </View>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>A ChefsBook Cookbook</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.coverPage}>
      <View style={styles.coverNoCover}>
        <View style={styles.coverOrnateFrame} />
        <View style={styles.coverOrnateFrameInner} />
        <View style={styles.coverTopAccent} />
        <View style={styles.coverBottomAccent} />
        {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.coverHatIcon} />}
        <View style={styles.coverDecoPattern}>
          <View style={styles.coverDecoLine} />
          <View style={styles.coverDecoDiamond} />
          <View style={styles.coverDecoLine} />
        </View>
        <Text style={styles.coverNoImageTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverNoImageSubtitle}>{cookbook.subtitle}</Text>}
        <View style={styles.coverDecoBottom} />
        <Text style={styles.coverNoImageAuthor}>by {cookbook.author_name}</Text>
        <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage }: { recipes: CookbookRecipe[]; startPage: number }) {
  return (
    <Page size="LETTER" style={styles.tocPage}>
      <View style={styles.tocTopBorder} />
      <View style={styles.tocDecoContainer}>
        <View style={styles.tocDecoLine} />
        <View style={styles.tocDecoDiamond} />
        <View style={styles.tocDecoLine} />
      </View>
      <Text style={styles.tocTitle}>Table of Contents</Text>
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={styles.tocEntry}>
          <Text style={styles.tocRecipe}>{recipe.title}</Text>
          {recipe.cuisine && <Text style={styles.tocCuisine}>{recipe.cuisine}</Text>}
          <Text style={styles.tocPageNum}>{startPage + idx * 2}</Text>
        </View>
      ))}
    </Page>
  );
}

function RecipeImagePage({ recipe }: { recipe: CookbookRecipe }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`Serves ${recipe.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size="LETTER" style={styles.recipeImagePage}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={styles.recipeImageDarkOverlay} />
        <View style={styles.recipeImageTextArea}>
          <View style={styles.recipeImageDeco}>
            <View style={styles.recipeImageDecoLine} />
            <View style={styles.recipeImageDecoDiamond} />
            <View style={styles.recipeImageDecoLine} />
          </View>
          <Text style={styles.recipeImageTitle}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={styles.recipeImageMeta}>{meta.join('  |  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.recipeNoImage}>
      <View style={styles.recipeNoImageBorder} />
      <View style={styles.recipeNoImageDeco}>
        <View style={styles.coverDecoLine} />
        <View style={styles.coverDecoDiamond} />
        <View style={styles.coverDecoLine} />
      </View>
      <Text style={styles.recipeNoImageTitle}>{recipe.title}</Text>
      {recipe.cuisine && (
        <View style={styles.cuisinePill}>
          <Text style={styles.cuisinePillText}>{recipe.cuisine}</Text>
        </View>
      )}
    </Page>
  );
}

function RecipeContentPage({ recipe, pageNumber }: { recipe: CookbookRecipe; pageNumber: number }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);

  return (
    <Page size="LETTER" style={styles.contentPage}>
      <View style={styles.contentTopAccent} />

      <View style={styles.ingredientBox}>
        <Text style={styles.sectionLabel}>INGREDIENTS</Text>
        <View style={styles.sectionDeco}>
          <View style={styles.sectionDecoLine} />
          <View style={styles.sectionDecoDot} />
        </View>
        {ingredientGroups.map((group, gi) => (
          <View key={gi}>
            {group.label && <Text style={styles.groupLabel}>{group.label}</Text>}
            {group.items.map((ing, i) => {
              const qty = formatQuantity(ing.quantity);
              const unit = ing.unit ?? '';
              const prep = ing.preparation ? `, ${ing.preparation}` : '';
              return (
                <Text key={i} style={styles.ingredient}>
                  <Text style={styles.ingredientBullet}>+ </Text>
                  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                </Text>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.stepsSection}>
        <Text style={styles.sectionLabel}>METHOD</Text>
        <View style={styles.sectionDeco}>
          <View style={styles.sectionDecoLine} />
          <View style={styles.sectionDecoDot} />
        </View>
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={styles.stepWrap} wrap={false}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.step_number}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepText}>{instruction}</Text>
                {step.timer_minutes && step.timer_minutes > 0 && (
                  <Text style={styles.stepTimer}>{formatDuration(step.timer_minutes)}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {recipe.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.sectionLabel}>COOK'S NOTES</Text>
          <Text style={styles.notesText}>{recipe.notes}</Text>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text style={styles.footerLeft}>ChefsBook</Text>
        <Text style={styles.footerCenter}>{truncate(recipe.title, 40)}</Text>
        <Text style={styles.footerRight} render={({ pageNumber: pn }) => `${pn}`} />
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, authorName }: { foreword: string; authorName: string }) {
  return (
    <Page size="LETTER" style={styles.forewordPage}>
      <View style={styles.forewordTopBorder} />
      <View style={styles.forewordDecoTop}>
        <View style={styles.forewordDecoLine} />
        <View style={styles.forewordDecoDiamond} />
        <View style={styles.forewordDecoLine} />
      </View>
      <Text style={styles.forewordLabel}>F O R E W O R D</Text>
      <Text style={styles.forewordText}>{foreword}</Text>
      <Text style={styles.forewordAuthor}>-- {authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64 }: { chefsHatBase64?: string | null }) {
  return (
    <Page size="LETTER" style={styles.backPage}>
      <View style={styles.backTopBorder} />
      <View style={styles.backBottomBorder} />
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backHat} />}
      <View style={styles.backDecoTop}>
        <View style={styles.backDecoLine} />
        <View style={styles.backDecoDiamond} />
        <View style={styles.backDecoLine} />
      </View>
      <Text style={styles.backWordmark}>ChefsBook</Text>
      <Text style={styles.backTagline}>Your recipes, beautifully collected.</Text>
      <View style={styles.backDivider} />
      <Text style={styles.backBlurb}>
        This cookbook was created with ChefsBook -- the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={styles.backUrl}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function SpiceDocument({ cookbook, recipes, chefsHatBase64 }: CookbookPdfOptions) {
  const tocPages = Math.ceil(recipes.length / 20);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} />

      {/* Blank page after cover */}
      <Page size="LETTER" style={{ backgroundColor: CREAM }} />

      <TOCPage recipes={recipes} startPage={startPage} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} />
      )}

      {recipes.map((recipe, idx) => (
        <React.Fragment key={recipe.id}>
          <RecipeImagePage recipe={recipe} />
          <RecipeContentPage recipe={recipe} pageNumber={startPage + idx * 2 + 1} />
        </React.Fragment>
      ))}

      <BackPage chefsHatBase64={chefsHatBase64} />
    </Document>
  );
}

export default SpiceDocument;
