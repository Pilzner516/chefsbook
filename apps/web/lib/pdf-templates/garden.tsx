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
import { getStrings, type BookStrings } from './book-strings';

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

function CoverPage({ cookbook, chefsHatBase64, strings, pageSize }: { cookbook: CookbookPdfOptions['cookbook']; chefsHatBase64?: string | null; strings: BookStrings; pageSize: PageSizeKey }) {
  if (cookbook.cover_image_url) {
    return (
      <Page size={getPageSize(pageSize)} style={styles.coverPage}>
        <Text style={styles.coverTitle}>{cookbook.title}</Text>
        {cookbook.subtitle && <Text style={styles.coverSubtitle}>{cookbook.subtitle}</Text>}
        <View style={styles.coverImageContainer}>
          <Image src={cookbook.cover_image_url} style={styles.coverImage} />
        </View>
        <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
        <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
        <Text style={styles.coverUrl}>chefsbk.app</Text>
      </Page>
    );
  }

  return (
    <Page size={getPageSize(pageSize)}>
      <View style={styles.coverNoImage}>
        <View style={styles.coverTopBar} />
        <Text style={styles.coverNoImageTitle}>{cookbook.title}</Text>
        <View style={styles.coverRule} />
        {cookbook.subtitle && <Text style={styles.coverNoImageSubtitle}>{cookbook.subtitle}</Text>}
        <Text style={styles.coverAuthor}>by {cookbook.author_name}</Text>
        <Text style={styles.cookbookLine}>A ChefsBook Cookbook</Text>
      </View>
    </Page>
  );
}

function TOCPage({ recipes, startPage, strings, pageSize }: { recipes: CookbookRecipe[]; startPage: number; strings: BookStrings; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.tocPage}>
      <View style={styles.tocTopRule} />
      <Text style={styles.tocLabel}>{strings.contents.toUpperCase()}</Text>
      {recipes.map((recipe, idx) => (
        <View key={recipe.id} style={styles.tocEntry}>
          <Text style={styles.tocRecipe}>{recipe.title}</Text>
          <Text style={styles.tocPageNum}>{startPage + idx * 2}</Text>
        </View>
      ))}
    </Page>
  );
}

function RecipePage({ recipe, strings, pageSize }: { recipe: CookbookRecipe; strings: BookStrings; pageSize: PageSizeKey }) {
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(recipe.cuisine);
  if (recipe.course) meta.push(recipe.course);
  if (recipe.total_minutes) meta.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) meta.push(`${recipe.servings} ${strings.servings}`);

  const primaryImage = recipe.image_urls[0];
  const ingredientGroups = groupIngredients(recipe.ingredients);

  if (primaryImage) {
    return (
      <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
        <View style={styles.recipeImageTop}>
          <Image src={primaryImage} style={styles.recipeImage} />
          <View style={styles.recipeImageFrame} />
        </View>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          {meta.length > 0 && <Text style={styles.recipeMeta}>{meta.join('  ·  ')}</Text>}
        </View>
      </Page>
    );
  }

  return (
    <Page size={getPageSize(pageSize)}>
      <View style={styles.recipeNoImage}>
        <Text style={styles.recipeNoImageTitle}>{recipe.title}</Text>
        {meta.length > 0 && <Text style={styles.recipeNoImageMeta}>{meta.join('  ·  ')}</Text>}
      </View>
    </Page>
  );
}

// Additional image pages (for images beyond the first one)
function AdditionalImagePage({ imageUrl, recipeTitle, pageSize }: { imageUrl: string; recipeTitle: string; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
      <View style={styles.recipeImageTop}>
        <Image src={imageUrl} style={styles.recipeImage} />
        <View style={styles.recipeImageFrame} />
      </View>
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeMeta}>{recipeTitle}</Text>
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
        <View style={styles.recipeImageTop}>
          <Image src={customPage.image_url} style={styles.recipeImage} />
          <View style={styles.recipeImageFrame} />
        </View>
        {customPage.caption && (
          <View style={styles.recipeHeader}>
            <Text style={styles.recipeMeta}>{customPage.caption}</Text>
          </View>
        )}
      </Page>
    );
  }

  if (customPage.layout === 'text_only') {
    return (
      <Page size={getPageSize(pageSize)} style={styles.contentPage}>
        <Text style={styles.forewordText}>{customPage.text}</Text>
      </Page>
    );
  }

  // image_and_text layout
  return (
    <Page size={getPageSize(pageSize)} style={styles.recipeImagePage}>
      {hasImage && (
        <View style={styles.recipeImageTop}>
          <Image src={customPage.image_url} style={styles.recipeImage} />
          <View style={styles.recipeImageFrame} />
        </View>
      )}
      <View style={styles.recipeHeader}>
        {customPage.caption && <Text style={styles.recipeMeta}>{customPage.caption}</Text>}
        {hasText && <Text style={{ ...styles.recipeMeta, marginTop: 8 }}>{customPage.text}</Text>}
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
          <Text style={{ fontSize: 10, fontFamily: 'Inter', fontWeight: 600, color: accentColor }}>Chef's Notes</Text>
          <Text style={{ fontSize: 8, marginLeft: 4, color: MUTED }}>✎</Text>
        </View>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, marginBottom: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, height: 24 }} />
        ))}
      </View>
    );
  }

  if (fillType === 'quote' && fillContent?.quoteText) {
    return (
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: BORDER, width: '60%', marginBottom: 16 }} />
        <Text style={{ fontSize: 36, color: accentColor, marginBottom: 4 }}>"</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter', fontWeight: 300, fontStyle: 'italic', textAlign: 'center', maxWidth: '80%', lineHeight: 1.6, color: DARK }}>
          {fillContent.quoteText}
        </Text>
        {fillContent.quoteAttribution && (
          <Text style={{ fontSize: 10, fontFamily: 'Inter', fontWeight: 300, color: MUTED, marginTop: 12 }}>
            — {fillContent.quoteAttribution}
          </Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, width: '60%', marginTop: 16 }} />
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
          <Text style={{ fontSize: 11, fontFamily: 'Inter', fontWeight: 300, color: DARK, textAlign: 'center', maxWidth: '80%', lineHeight: 1.5 }}>
            {fillContent.customText}
          </Text>
        )}
      </View>
    );
  }

  return null;
}

function RecipeContentPage({ recipe, strings, pageSize }: { recipe: CookbookRecipe; strings: BookStrings; pageSize: PageSizeKey }) {
  const ingredientGroups = groupIngredients(recipe.ingredients);

  return (
    <Page size={getPageSize(pageSize)} style={styles.contentPage}>
      <Text style={styles.sectionLabel}>{strings.ingredients.toUpperCase()}</Text>
      <View style={styles.sectionRule} />

      {ingredientGroups.map((group, gi) => (
        <View key={gi}>
          {group.items.map((ing, i) => {
            const qty = formatQuantity(ing.quantity);
            const unit = ing.unit ?? '';
            const prep = ing.preparation ? `, ${ing.preparation}` : '';
            return (
              <View key={i} style={styles.ingredientItem}>
                <Text style={styles.ingredientBullet}>–</Text>
                <Text style={styles.ingredientText}>
                  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.stepsSection}>
        <Text style={styles.sectionLabel}>{strings.steps.toUpperCase()}</Text>
        <View style={styles.sectionRule} />

        {recipe.steps.map((step) => {
          const instruction = fixTimerCharacter(step.instruction);
          return (
            <View key={step.step_number} style={styles.stepWrap} wrap={false} minPresenceAhead={40}>
              <Text style={styles.stepNum}>{step.step_number}</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepText}>{instruction}</Text>
                {step.timer_minutes && step.timer_minutes > 0 && (
                  <Text style={styles.stepTimer}>({formatDuration(step.timer_minutes)})</Text>
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

      <FillZone fillType={recipe.fillType} fillContent={recipe.fillContent} accentColor={GREEN} />

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>ChefsBook</Text>
        <Text style={styles.footerText}>{truncate(recipe.title, 40)}</Text>
        <Text style={styles.footerText} render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  );
}

function ForewordPage({ foreword, authorName, strings, pageSize }: { foreword: string; authorName: string; strings: BookStrings; pageSize: PageSizeKey }) {
  const forewordLabel = strings.foreword.toUpperCase().split('').join(' ');
  return (
    <Page size={getPageSize(pageSize)} style={styles.forewordPage}>
      <Text style={styles.forewordLabel}>{forewordLabel}</Text>
      <View style={styles.forewordRule} />
      <Text style={styles.forewordText}>{foreword}</Text>
      <Text style={styles.forewordAuthor}>— {authorName}</Text>
    </Page>
  );
}

function BackPage({ chefsHatBase64, strings, pageSize }: { chefsHatBase64?: string | null; strings: BookStrings; pageSize: PageSizeKey }) {
  return (
    <Page size={getPageSize(pageSize)} style={styles.backPage}>
      <View style={styles.backTopBar} />
      {chefsHatBase64 && <Image src={chefsHatBase64} style={styles.backHat} />}
      <Text style={styles.backWordmark}>ChefsBook</Text>
      <Text style={styles.backTagline}>{strings.tagline}</Text>
      <View style={styles.backDivider} />
      <Text style={styles.backBlurb}>
        This cookbook was created with ChefsBook — the app that helps you save, organise, and share the recipes that matter most. Import from any website, scan handwritten cards, or create your own. Your collection, always with you.
      </Text>
      <Text style={styles.backUrl}>Discover ChefsBook at chefsbk.app</Text>
    </Page>
  );
}

export function GardenDocument({ cookbook, recipes, chefsHatBase64, language }: CookbookPdfOptions) {
  const strings = getStrings(language ?? 'en');
  const pageSize = cookbook.pageSize ?? 'letter';
  const tocPages = Math.ceil(recipes.length / 20);
  const hasForeword = cookbook.foreword && cookbook.foreword.trim().length > 0;
  const startPage = 3 + tocPages + (hasForeword ? 1 : 0);

  return (
    <Document>
      <CoverPage cookbook={cookbook} chefsHatBase64={chefsHatBase64} strings={strings} pageSize={pageSize} />

      {/* Blank page after cover */}
      <Page size={getPageSize(pageSize)} style={{ backgroundColor: WHITE }} />

      <TOCPage recipes={recipes} startPage={startPage} strings={strings} pageSize={pageSize} />

      {/* Foreword page if text provided */}
      {hasForeword && (
        <ForewordPage foreword={cookbook.foreword!} authorName={cookbook.author_name} strings={strings} pageSize={pageSize} />
      )}

      {recipes.map((recipe) => (
        <React.Fragment key={recipe.id}>
          <RecipePage recipe={recipe} strings={strings} pageSize={pageSize} />
          {/* Render additional image pages (images beyond the first one) */}
          {recipe.image_urls.slice(1).map((imageUrl, imgIdx) => (
            <AdditionalImagePage key={`${recipe.id}-img-${imgIdx}`} imageUrl={imageUrl} recipeTitle={recipe.title} pageSize={pageSize} />
          ))}
          <RecipeContentPage recipe={recipe} strings={strings} pageSize={pageSize} />
          {/* Render custom pages after content page */}
          {recipe.custom_pages?.map((cp) => (
            <CustomPageComponent key={cp.id} customPage={cp} pageSize={pageSize} />
          ))}
        </React.Fragment>
      ))}

      <BackPage chefsHatBase64={chefsHatBase64} strings={strings} pageSize={pageSize} />
    </Document>
  );
}

export default GardenDocument;
