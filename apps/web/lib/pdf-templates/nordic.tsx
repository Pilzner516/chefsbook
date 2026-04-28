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
  groupIngredients,
  formatDuration,
  formatQuantity,
  truncate,
  fixTimerCharacter,
} from './types';
import { getStrings, type BookStrings } from './book-strings';

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

function CoverPage({ cookbook, chefsHatBase64, strings }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverWithImage}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
          <View style={styles.coverImageOverlay}>
            <Text style={styles.coverTitle}>{cookbook.title}</Text>
            {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
            <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
          </View>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>ChefsBook</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.coverPage}>
      <View style={styles.coverNoCover}>
        <View style={styles.coverNoImageAccent} />
        {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.coverHatIcon} />}
        <Text style={styles.coverNoImageTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverNoImageSubtitle}>{cookbook.subtitle}</Text>}
        <Text style={styles.coverNoImageAuthor}>by {cookbook.author_name}</Text>
        <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage, strings }: { recipes: CookbookRecipe[]; startPage: number; strings: BookStrings }) {
  return (
    <Page size="LETTER" style={styles.tocPage}>
      <Text style={styles.tocLabel}>{strings.contents}</Text>
      {recipes.map((recipe, idx) => {
        const meta: string[] = [];
        if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
        if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

        return (
          <View key={recipe.id} style={styles.tocEntry}>
            <Text style={styles.tocPageNum}>{startPage + idx * 2}</Text>
            <Text style={styles.tocRecipe}>{recipe.title}</Text>
            {meta.length > 0 && <Text style={styles.tocMeta}>{meta.join(' / ')}</Text>}
          </View>
        );
      })}
    </Page>
  );
}

function RecipeImagePage({ recipe, strings }: { recipe: CookbookRecipe; strings: BookStrings }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size="LETTER" style={styles.recipeImagePage}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={styles.recipeImageOverlay}>
          <Text style={styles.recipeImageTitle}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={styles.recipeImageMeta}>{meta.join('  /  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.recipeImagePage}>
      <View style={styles.recipeNoImage}>
        <View style={styles.recipeNoImageAccent} />
        <Text style={styles.recipeNoImageTitle}>{recipe.title}</Text>
        {meta.length > 0 && <Text style={styles.recipeNoImageMeta}>{meta.join('  /  ')}</Text>}
      </View>
    </Page>
  );
}

function RecipeContentPage({ recipe, strings }: { recipe: CookbookRecipe; strings: BookStrings }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);
  const allIngredients = ingredientGroups.flatMap(g => g.items);

  return (
    <Page size="LETTER" style={styles.contentPage}>
      <View style={styles.ingredientSection}>
        <Text style={styles.sectionLabel}>{strings.ingredients}</Text>
        <View style={styles.ingredientColumns}>
          {allIngredients.map((ing, i) => {
            const qty = formatQuantity(ing.quantity);
            const unit = ing.unit ?? '';
            return (
              <View key={i} style={styles.ingredientItem}>
                <Text style={styles.ingredientText}>
                  <Text style={styles.ingredientQty}>{qty}</Text> {unit} {ing.ingredient}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.stepsSection}>
        <Text style={styles.sectionLabel}>{strings.steps}</Text>
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={styles.stepWrap} wrap={false} minPresenceAhead={40}>
              <Text style={styles.stepNum}>{String(step.step_number).padStart(2, '0')}</Text>
              <Text style={styles.stepText}>{instruction}</Text>
              {step.timer_minutes && step.timer_minutes > 0 && (
                <Text style={styles.stepTimer}>{formatDuration(step.timer_minutes)}</Text>
              )}
            </View>
          );
        })}
      </View>

      {recipe.notes && (
        <View style={styles.notesSection} wrap={false}>
          <Text style={styles.sectionLabel}>{strings.notes}</Text>
          <Text style={styles.notesText}>{recipe.notes}</Text>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{truncate(recipe.title, 40)}</Text>
        <Text style={styles.footerPage} render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, authorName, strings }: { foreword: string; authorName: string; strings: BookStrings }) {
  return (
    <Page size="LETTER" style={styles.forewordPage}>
      <View style={styles.forewordAccent} />
      <Text style={styles.forewordLabel}>{strings.foreword}</Text>
      <Text style={styles.forewordText}>{foreword}</Text>
      <Text style={styles.forewordAuthor}>{authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings }: { chefsHatBase64?: string | null; strings: BookStrings }) {
  return (
    <Page size="LETTER" style={styles.backPage}>
      <View style={styles.backAccent} />
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backHat} />}
      <Text style={styles.backWordmark}>ChefsBook</Text>
      <Text style={styles.backTagline}>{strings.tagline}</Text>
      <Text style={styles.backBlurb}>
        This cookbook was created with ChefsBook. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={styles.backUrl}>chefsbk.app</Text>
    </Page>
  );
}

export function NordicDocument({ cookbook, recipes, chefsHatBase64, language }: CookbookPdfOptions) {
  const strings = getStrings(language ?? 'en');
  const tocPages = Math.ceil(recipes.length / 20);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} />

      {/* Blank page after cover */}
      <Page size="LETTER" style={{ backgroundColor: WHITE }} />

      <TOCPage recipes={recipes} startPage={startPage} strings={strings} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} strings={strings} />
      )}

      {recipes.map((recipe) => (
        <React.Fragment key={recipe.id}>
          <RecipeImagePage recipe={recipe} strings={strings} />
          <RecipeContentPage recipe={recipe} strings={strings} />
        </React.Fragment>
      ))}

      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} />
    </Document>
  );
}

export default NordicDocument;
