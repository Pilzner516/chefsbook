/**
 * Heritage Template — Warm, farmhouse, family-focused
 * Inspired by Magnolia Table and farmhouse cookbooks.
 * Feels like a treasured family heirloom.
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

// Register fonts via jsDelivr CDN
Font.register({
  family: 'Libre Baskerville',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-700-normal.ttf', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
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

// Warm farmhouse colour palette
const IVORY = '#f8f5f0';
const IVORY_DARK = '#f0ebe3';
const SAGE = '#8b9a7d';
const SAGE_LIGHT = '#d4dccf';
const BROWN = '#6b5344';
const BROWN_LIGHT = '#9a8a7a';
const DARK = '#3a3028';
const BORDER = '#ddd5c8';

const styles = StyleSheet.create({
  // Cover page with image
  coverPage: {
    backgroundColor: IVORY,
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 245, 240, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  coverDecoTop: {
    width: 120,
    height: 1,
    backgroundColor: SAGE,
    marginBottom: 8,
  },
  coverDecoTopOuter: {
    width: 80,
    height: 1,
    backgroundColor: SAGE,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 44,
    fontFamily: 'Libre Baskerville',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 16,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: BROWN,
    textAlign: 'center',
    marginBottom: 32,
  },
  coverDecoBottom: {
    width: 60,
    height: 2,
    backgroundColor: BROWN,
    marginBottom: 24,
  },
  coverAuthor: {
    fontSize: 13,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: BROWN_LIGHT,
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
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: BROWN_LIGHT,
  },
  coverFooterUrl: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SAGE,
    marginTop: 4,
  },

  // Cover without image
  coverNoCover: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '45%',
    backgroundColor: IVORY,
    position: 'relative',
  },
  coverFrame: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 1,
    borderColor: SAGE,
  },
  coverFrameInner: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
    borderWidth: 1,
    borderColor: BORDER,
  },
  coverHatIcon: {
    width: 64,
    height: 64,
    marginBottom: 20,
  },
  cookbookLine: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: BROWN_LIGHT,
    marginTop: 32,
  },

  // TOC
  tocPage: {
    paddingTop: 60,
    paddingBottom: 54,
    paddingHorizontal: 60,
    backgroundColor: IVORY,
  },
  tocDecoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tocDecoLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },
  tocDecoCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SAGE,
    marginHorizontal: 12,
  },
  tocTitle: {
    fontSize: 28,
    fontFamily: 'Libre Baskerville',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  tocSubtitle: {
    fontSize: 11,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: BROWN_LIGHT,
    textAlign: 'center',
    marginBottom: 24,
  },
  tocTwoColumn: {
    flexDirection: 'row',
  },
  tocColumn: {
    flex: 1,
    paddingHorizontal: 8,
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  tocRecipe: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: DARK,
    paddingRight: 8,
  },
  tocDots: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'dotted',
    marginBottom: 4,
    marginHorizontal: 4,
  },
  tocPageNum: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: SAGE,
    minWidth: 20,
    textAlign: 'right',
  },

  // Recipe image page
  recipeImagePage: {
    position: 'relative',
    backgroundColor: IVORY,
  },
  recipeImageFrame: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 1,
    borderColor: SAGE,
  },
  recipeFullImage: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    height: '55%',
    objectFit: 'cover',
  },
  recipeImageTextArea: {
    position: 'absolute',
    bottom: 60,
    left: 48,
    right: 48,
    alignItems: 'center',
  },
  recipeImageTitle: {
    fontSize: 28,
    fontFamily: 'Libre Baskerville',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  recipeImageDeco: {
    width: 40,
    height: 1,
    backgroundColor: SAGE,
    marginBottom: 8,
  },
  recipeImageMeta: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: BROWN_LIGHT,
    textAlign: 'center',
  },
  recipeNoImagePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IVORY,
    position: 'relative',
  },
  recipeNoImageFrame: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 1,
    borderColor: SAGE,
  },
  recipeNoImageTitle: {
    fontSize: 32,
    fontFamily: 'Libre Baskerville',
    fontWeight: 700,
    color: DARK,
    textAlign: 'center',
    marginBottom: 16,
  },
  recipeNoImageDeco: {
    width: 60,
    height: 2,
    backgroundColor: BROWN,
    marginBottom: 12,
  },
  cuisinePill: {
    backgroundColor: SAGE_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 4,
  },
  cuisinePillText: {
    fontSize: 10,
    fontFamily: 'Source Sans Pro',
    fontWeight: 600,
    color: DARK,
  },

  // Recipe content page
  contentPage: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingLeft: 54,
    paddingRight: 48,
    backgroundColor: IVORY,
  },
  ingredientsSection: {
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  stepsSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 600,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: SAGE,
    marginBottom: 4,
  },
  sectionDeco: {
    width: 30,
    height: 1,
    backgroundColor: SAGE,
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: BROWN,
    marginTop: 12,
    marginBottom: 6,
  },
  ingredient: {
    fontSize: 10.5,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: DARK,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  ingredientBullet: {
    color: SAGE,
  },
  stepWrap: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SAGE_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 11,
    fontFamily: 'Libre Baskerville',
    fontWeight: 700,
    color: DARK,
  },
  stepContent: {
    flex: 1,
    paddingTop: 3,
  },
  stepText: {
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: DARK,
    lineHeight: 1.6,
  },
  stepTimer: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: SAGE,
    marginTop: 4,
  },
  notesSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  notesText: {
    fontSize: 10,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: BROWN,
    lineHeight: 1.6,
  },

  // Running footer
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 54,
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
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: BROWN_LIGHT,
  },
  footerCenter: {
    fontSize: 8,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: BROWN_LIGHT,
    maxWidth: 200,
    textAlign: 'center',
  },
  footerRight: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: DARK,
  },

  // Foreword page
  forewordPage: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 80,
    backgroundColor: IVORY,
    alignItems: 'center',
  },
  forewordDecoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  forewordDecoLine: {
    width: 40,
    height: 1,
    backgroundColor: SAGE,
  },
  forewordDecoCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SAGE,
    marginHorizontal: 12,
  },
  forewordLabel: {
    fontSize: 9,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    letterSpacing: 4,
    color: BROWN_LIGHT,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  forewordText: {
    fontSize: 13,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: DARK,
    lineHeight: 1.9,
    textAlign: 'center',
    maxWidth: 420,
  },
  forewordAuthor: {
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: BROWN_LIGHT,
    textAlign: 'right',
    marginTop: 36,
  },

  // Back page
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IVORY,
    paddingHorizontal: 60,
    position: 'relative',
  },
  backFrame: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 1,
    borderColor: SAGE,
  },
  backHat: {
    width: 64,
    height: 64,
    marginBottom: 20,
  },
  backWordmark: {
    fontSize: 28,
    fontFamily: 'Libre Baskerville',
    fontWeight: 700,
    color: DARK,
    marginBottom: 8,
  },
  backTagline: {
    fontSize: 13,
    fontFamily: 'Libre Baskerville',
    fontWeight: 400,
    fontStyle: 'italic',
    color: BROWN,
    marginBottom: 20,
  },
  backDivider: {
    width: 60,
    height: 1,
    backgroundColor: SAGE,
    marginVertical: 16,
  },
  backBlurb: {
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 300,
    color: BROWN_LIGHT,
    textAlign: 'center',
    lineHeight: 1.7,
    marginBottom: 20,
    maxWidth: 380,
  },
  backUrl: {
    fontSize: 11,
    fontFamily: 'Source Sans Pro',
    fontWeight: 400,
    color: SAGE,
  },
});

function CoverPage({ cookbook, chefsHatBase64, strings }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverWithImage}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
          <View style={styles.coverImageOverlay}>
            <View style={styles.coverDecoTop} />
            <View style={styles.coverDecoTopOuter} />
            <Text style={styles.coverTitle}>{cookbook.title}</Text>
            {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
            <View style={styles.coverDecoBottom} />
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
    <Page size="LETTER" style={styles.coverPage}>
      <View style={styles.coverNoCover}>
        <View style={styles.coverFrame} />
        <View style={styles.coverFrameInner} />
        {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.coverHatIcon} />}
        <View style={styles.coverDecoTop} />
        <View style={styles.coverDecoTopOuter} />
        <Text style={styles.coverTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
        <View style={styles.coverDecoBottom} />
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

function TOCPage({ recipes, startPage, strings }: { recipes: CookbookRecipe[]; startPage: number; strings: BookStrings }) {
  // Split recipes into two columns
  const half = Math.ceil(recipes.length / 2);
  const leftRecipes = recipes.slice(0, half);
  const rightRecipes = recipes.slice(half);

  return (
    <Page size="LETTER" style={styles.tocPage}>
      <View style={styles.tocDecoTop}>
        <View style={styles.tocDecoLine} />
        <View style={styles.tocDecoCenter} />
        <View style={styles.tocDecoLine} />
      </View>
      <Text style={styles.tocTitle}>{strings.contents}</Text>
      <Text style={styles.tocSubtitle}>A collection of cherished recipes</Text>
      <View style={styles.tocTwoColumn}>
        <View style={styles.tocColumn}>
          {leftRecipes.map((recipe, idx) => (
            <View key={recipe.id} style={styles.tocEntry}>
              <Text style={styles.tocRecipe}>{truncate(recipe.title, 30)}</Text>
              <View style={styles.tocDots} />
              <Text style={styles.tocPageNum}>{startPage + idx * 2}</Text>
            </View>
          ))}
        </View>
        <View style={styles.tocColumn}>
          {rightRecipes.map((recipe, idx) => (
            <View key={recipe.id} style={styles.tocEntry}>
              <Text style={styles.tocRecipe}>{truncate(recipe.title, 30)}</Text>
              <View style={styles.tocDots} />
              <Text style={styles.tocPageNum}>{startPage + (half + idx) * 2}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function RecipeImagePage({ recipe, strings }: { recipe: CookbookRecipe; strings: BookStrings }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${strings.serves} ${recipe.servings}`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size="LETTER" style={styles.recipeImagePage}>
        <View style={styles.recipeImageFrame} />
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={styles.recipeImageTextArea}>
          <Text style={styles.recipeImageTitle}>{recipe.title}</Text>
          <View style={styles.recipeImageDeco} />
          {meta.length > 0 && <Text style={styles.recipeImageMeta}>{meta.join('  |  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.recipeNoImagePage}>
      <View style={styles.recipeNoImageFrame} />
      <Text style={styles.recipeNoImageTitle}>{recipe.title}</Text>
      <View style={styles.recipeNoImageDeco} />
      {recipe.cuisine && (
        <View style={styles.cuisinePill}>
          <Text style={styles.cuisinePillText}>{recipe.cuisine}</Text>
        </View>
      )}
    </Page>
  );
}

function RecipeContentPage({ recipe, pageNumber, strings }: { recipe: CookbookRecipe; pageNumber: number; strings: BookStrings }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);

  return (
    <Page size="LETTER" style={styles.contentPage} wrap>
      {/* Ingredients section - stays together on one page */}
      <View style={styles.ingredientsSection} wrap={false}>
        <Text style={styles.sectionLabel}>{strings.ingredients.toUpperCase()}</Text>
        <View style={styles.sectionDeco} />
        {ingredientGroups.map((group, gi) => (
          <View key={gi}>
            {group.label && <Text style={styles.groupLabel}>{group.label}</Text>}
            {group.items.map((ing, i) => {
              const qty = formatQuantity(ing.quantity);
              const unit = ing.unit ?? '';
              const prep = ing.preparation ? `, ${ing.preparation}` : '';
              return (
                <Text key={i} style={styles.ingredient}>
                  <Text style={styles.ingredientBullet}>*  </Text>
                  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                </Text>
              );
            })}
          </View>
        ))}
      </View>

      {/* Steps section - flows across pages, individual steps don't break */}
      <View style={styles.stepsSection}>
        <Text style={styles.sectionLabel}>{strings.steps.toUpperCase()}</Text>
        <View style={styles.sectionDeco} />
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={styles.stepWrap} wrap={false} minPresenceAhead={40}>
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
        <View style={styles.notesSection} wrap={false}>
          <Text style={styles.sectionLabel}>{strings.notes.toUpperCase()}</Text>
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

function ForewordPage({ foreword, authorName, strings }: { foreword: string; authorName: string; strings: BookStrings }) {
  const forewordLabel = strings.foreword.toUpperCase().split('').join(' ');
  return (
    <Page size="LETTER" style={styles.forewordPage}>
      <View style={styles.forewordDecoTop}>
        <View style={styles.forewordDecoLine} />
        <View style={styles.forewordDecoCenter} />
        <View style={styles.forewordDecoLine} />
      </View>
      <Text style={styles.forewordLabel}>{forewordLabel}</Text>
      <Text style={styles.forewordText}>{foreword}</Text>
      <Text style={styles.forewordAuthor}>-- {authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings }: { chefsHatBase64?: string | null; strings: BookStrings }) {
  return (
    <Page size="LETTER" style={styles.backPage}>
      <View style={styles.backFrame} />
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backHat} />}
      <Text style={styles.backWordmark}>ChefsBook</Text>
      <Text style={styles.backTagline}>{strings.tagline}</Text>
      <View style={styles.backDivider} />
      <Text style={styles.backBlurb}>
        This cookbook was lovingly created with ChefsBook -- the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={styles.backUrl}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function HeritageDocument({ cookbook, recipes, chefsHatBase64, language }: CookbookPdfOptions) {
  const strings = getStrings(language ?? 'en');
  const tocPages = Math.ceil(recipes.length / 40); // Two-column layout fits more
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} />

      {/* Blank page after cover */}
      <Page size="LETTER" style={{ backgroundColor: IVORY }} />

      <TOCPage recipes={recipes} startPage={startPage} strings={strings} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} strings={strings} />
      )}

      {recipes.map((recipe, idx) => (
        <React.Fragment key={recipe.id}>
          <RecipeImagePage recipe={recipe} strings={strings} />
          <RecipeContentPage recipe={recipe} pageNumber={startPage + idx * 2 + 1} strings={strings} />
        </React.Fragment>
      ))}

      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} />
    </Document>
  );
}

export default HeritageDocument;
