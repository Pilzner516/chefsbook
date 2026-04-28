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
  groupIngredients,
  formatDuration,
  formatQuantity,
  truncate,
  fixTimerCharacter,
} from './types';

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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
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
  twoColumnLayout: {
    flexDirection: 'row',
    flex: 1,
  },
  leftColumn: {
    width: '38%',
    backgroundColor: CREAM_DARK,
    padding: 16,
    marginRight: 16,
    alignSelf: 'flex-start', // shrink to content height
  },
  rightColumn: {
    width: '62%',
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

function CoverPage({ cookbook, chefsHatBase64 }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size="LETTER" style={styles.coverPage}>
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
          <Text style={styles.coverFooterText}>Created with ChefsBook</Text>
          <Text style={styles.coverFooterUrl}>chefsbk.app</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.coverPage}>
      <View style={styles.coverFrame} />
      <View style={styles.coverNoCover}>
        {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.coverHatIcon} />}
        <Text style={styles.coverTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
        <View style={styles.coverDivider} />
        <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
        <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
      </View>
      <View style={styles.coverFooter}>
        <Text style={styles.coverFooterText}>Created with ChefsBook</Text>
        <Text style={styles.coverFooterUrl}>chefsbk.app</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage }: { recipes: CookbookRecipe[]; startPage: number }) {
  return (
    <Page size="LETTER" style={styles.tocPage}>
      <Text style={styles.tocTitle}>Contents</Text>
      <View style={styles.tocDivider} />
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
        <View style={styles.recipeImageOverlay}>
          <Text style={styles.recipeImageTitle}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={styles.recipeImageMeta}>{meta.join('  ·  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.recipeNoImagePage}>
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
  const secondImage = recipe.image_urls[1];

  return (
    <Page size="LETTER" style={styles.contentPage}>
      <View style={styles.twoColumnLayout}>
        <View style={styles.leftColumn}>
          <Text style={styles.sectionLabel}>INGREDIENTS</Text>
          {ingredientGroups.map((group, gi) => (
            <View key={gi}>
              {group.label && <Text style={styles.groupLabel}>{group.label}</Text>}
              {group.items.map((ing, i) => {
                const qty = formatQuantity(ing.quantity);
                const unit = ing.unit ?? '';
                const prep = ing.preparation ? `, ${ing.preparation}` : '';
                return (
                  <Text key={i} style={styles.ingredient}>
                    •  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.rightColumn}>
          <Text style={styles.sectionLabel}>STEPS</Text>
          {recipe.steps.map((step) => {
            const instruction = fixTimerCharacter(step.instruction);
            return (
              <View key={step.step_number} style={styles.stepWrap} wrap={false}>
                <Text style={styles.stepNum}>{step.step_number}</Text>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>{instruction}</Text>
                  {step.timer_minutes && step.timer_minutes > 0 && (
                    <Text style={styles.stepTimer}>{formatDuration(step.timer_minutes)}</Text>
                  )}
                </View>
              </View>
            );
          })}

          {secondImage && <Image src={secondImage} style={styles.secondImage} />}
        </View>
      </View>

      {recipe.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.sectionLabel}>NOTES</Text>
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
      <Text style={styles.forewordLabel}>F O R E W O R D</Text>
      <View style={styles.forewordRule} />
      <Text style={styles.forewordText}>{foreword}</Text>
      <Text style={styles.forewordAuthor}>— {authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64 }: { chefsHatBase64?: string | null }) {
  return (
    <Page size="LETTER" style={styles.backPage}>
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backHat} />}
      <Text style={styles.backWordmark}>ChefsBook</Text>
      <Text style={styles.backTagline}>Your recipes, beautifully collected.</Text>
      <View style={styles.backDivider} />
      <Text style={styles.backBlurb}>
        This cookbook was created with ChefsBook — the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={styles.backUrl}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function TrattoriaDocument({ cookbook, recipes, chefsHatBase64 }: CookbookPdfOptions) {
  const tocPages = Math.ceil(recipes.length / 25);
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

export default TrattoriaDocument;
