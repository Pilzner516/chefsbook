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
  groupIngredients,
  formatDuration,
  formatQuantity,
  truncate,
  fixTimerCharacter,
} from './types';

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
    justifyContent: 'center',
    alignItems: 'center',
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

  // Back page
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
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
  backUrl: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: RED,
  },
});

function CoverPage({ cookbook, chefsHatBase64 }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverImageHalf}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
        </View>
        <View style={styles.coverTextHalf}>
          <View style={styles.coverRedRule} />
          <Text style={styles.coverTitle}>{cookbook.title}</Text>
          {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
          <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>ChefsBook</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER">
      <View style={styles.coverNoImage}>
        <View style={styles.coverAccentBar} />
        <Text style={styles.coverNoImageTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverNoImageSubtitle}>{cookbook.subtitle}</Text>}
        <Text style={styles.coverNoImageAuthor}>by {cookbook.author_name}</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage }: { recipes: CookbookRecipe[]; startPage: number }) {
  return (
    <Page size="LETTER" style={styles.tocPage}>
      <Text style={styles.tocLabel}>CONTENTS</Text>
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={styles.tocEntry}>
          <Text style={styles.tocRecipe}>{recipe.title}</Text>
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
  if (recipe.servings) meta.push(`${recipe.servings} servings`);

  const primaryImage = recipe.image_urls[0];

  if (primaryImage) {
    return (
      <Page size="LETTER" style={styles.recipeImagePage}>
        <Image src={primaryImage} style={styles.recipeFullImage} />
        <View style={styles.recipeImageGradient} />
        <View style={styles.recipeImageText}>
          <Text style={styles.recipeImageTitle}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={styles.recipeImageMeta}>{meta.join('  ·  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER">
      <View style={styles.recipeNoImage}>
        <Text style={styles.recipeNoImageTitle}>{recipe.title}</Text>
        <View style={styles.recipeNoImageRule} />
      </View>
    </Page>
  );
}

function RecipeContentPage({ recipe }: { recipe: CookbookRecipe }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);
  const allIngredients = ingredientGroups.flatMap(g => g.items);

  return (
    <Page size="LETTER" style={styles.contentPage}>
      <View style={styles.ingredientBand}>
        <Text style={styles.ingredientLabel}>INGREDIENTS</Text>
        <View style={styles.ingredientFlow}>
          {allIngredients.map((ing, i) => {
            const qty = formatQuantity(ing.quantity);
            const unit = ing.unit ?? '';
            return (
              <Text key={i} style={styles.ingredientItem}>
                {qty} {unit} {ing.ingredient}
              </Text>
            );
          })}
        </View>
      </View>

      <View style={styles.stepsSection}>
        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={styles.stepWrap} wrap={false}>
              <Text style={styles.ghostNumber}>{step.step_number}</Text>
              <Text style={styles.stepText}>{instruction}</Text>
              {step.timer_minutes && step.timer_minutes > 0 && (
                <Text style={styles.stepTimer}>⏱ {formatDuration(step.timer_minutes)}</Text>
              )}
            </View>
          );
        })}
      </View>

      {recipe.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>NOTES</Text>
          <Text style={styles.notesText}>{recipe.notes}</Text>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>ChefsBook</Text>
        <Text style={styles.footerText}>{truncate(recipe.title, 40)}</Text>
        <Text style={styles.footerText} render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  );
}

function BackPage({ chefsHatBase64 }: { chefsHatBase64?: string | null }) {
  return (
    <Page size="LETTER" style={styles.backPage}>
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backHat} />}
      <Text style={styles.backWordmark}>ChefsBook</Text>
      <Text style={styles.backTagline}>Your recipes, beautifully collected.</Text>
      <Text style={styles.backUrl}>chefsbk.app</Text>
    </Page>
  );
}

export function StudioDocument({ cookbook, recipes, chefsHatBase64 }: CookbookPdfOptions) {
  const tocPages = Math.ceil(recipes.length / 20);
  const startPage = 3 + tocPages;

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} />

      {/* Blank page after cover */}
      <Page size="LETTER" style={{ backgroundColor: DARK_BG }} />

      <TOCPage recipes={recipes} startPage={startPage} />

      {recipes.map((recipe) => (
        <React.Fragment key={recipe.id}>
          <RecipeImagePage recipe={recipe} />
          <RecipeContentPage recipe={recipe} />
        </React.Fragment>
      ))}

      <BackPage chefsHatBase64={chefsHatBase64} />
    </Document>
  );
}

export default StudioDocument;
