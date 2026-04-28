import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';

// Register Google Fonts for award-winning cookbook design
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXHXbtXK-F2qO0g.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXHXQNPK-F2qO0g.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXHXedPK-F2qO0g.ttf', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_pqLR2dJ-F2qY0g.ttf', fontWeight: 400, fontStyle: 'italic' },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_gCOR2dJ-F2qY0g.ttf', fontWeight: 600, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_0ew.ttf', fontWeight: 300 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_0ew.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZNhjp-Ek-_0ew.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_0ew.ttf', fontWeight: 600 },
  ],
});

// Colour palette per pdf-design.md
const RED = '#ce2b37';      // --cb-red: pomodoro
const GREEN = '#009246';    // --cb-green: basil
const DARK = '#1a1a1a';     // --cb-black: near-black
const CREAM = '#faf7f0';    // --cb-cream: warm cream page background
const CREAM_DARK = '#f0ece0'; // --cb-cream-dark: TOC background
const MUTED = '#7a6a5a';    // --cb-muted: warm brown-grey
const BORDER = '#ddd8cc';   // --cb-border: warm light border

// Chef hat icon as base64 for embedding in PDF
const CHEF_HAT_URL = 'https://chefsbk.app/images/chefs-hat.png';

// Interior PDF: 8.5" × 11" with proper margins for perfect binding per Lulu specs
const s = StyleSheet.create({
  page: {
    paddingTop: 54, // 0.75"
    paddingBottom: 54,
    paddingLeft: 63, // 0.875" inner margin
    paddingRight: 45, // 0.625" outer margin
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 11,
    color: DARK,
    backgroundColor: CREAM, // Warm cream, NOT white
  },

  // Title page — full-page design per pdf-design.md
  titlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    position: 'relative',
  },
  titlePageFrame: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 1,
    borderColor: RED,
  },
  chefsHatIcon: {
    width: 60,
    height: 60,
    marginBottom: 24,
  },
  bookTitle: {
    fontSize: 52,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 12,
    color: DARK,
  },
  bookSubtitle: {
    fontSize: 22,
    fontFamily: 'Playfair Display',
    fontWeight: 400,
    fontStyle: 'italic',
    color: MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },
  titleDivider: {
    width: 120,
    height: 1,
    backgroundColor: RED,
    marginVertical: 20,
  },
  bookAuthor: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
    textAlign: 'center',
    marginTop: 16,
  },
  logoFooter: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },
  logoRed: { color: RED },

  // TOC — per pdf-design.md
  tocPage: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingLeft: 63,
    paddingRight: 45,
    fontFamily: 'Inter',
    fontSize: 11,
    color: DARK,
    backgroundColor: CREAM_DARK, // Slightly darker cream for TOC
  },
  tocTitle: {
    fontSize: 38,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    marginBottom: 12,
    color: RED,
  },
  tocDivider: {
    height: 1,
    backgroundColor: RED,
    marginBottom: 24,
    width: '100%',
  },
  tocEntry: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  tocRecipe: {
    fontSize: 13,
    fontFamily: 'Playfair Display',
    fontWeight: 400,
  },
  tocDots: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 300,
    letterSpacing: 2,
    color: BORDER,
    marginHorizontal: 8,
    marginBottom: 1,
  },
  tocPageNumber: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: MUTED,
  },

  // Recipe page — per pdf-design.md
  recipeHero: {
    width: '100%',
    height: 280, // 280pt max per spec
    objectFit: 'cover',
    marginBottom: 16,
  },
  recipeHeroShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  recipeTitle: {
    fontSize: 30,
    fontFamily: 'Playfair Display',
    fontWeight: 700,
    marginBottom: 6,
    color: DARK,
  },
  metaRow: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: MUTED,
    marginBottom: 12,
  },
  description: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 300,
    color: DARK,
    lineHeight: 1.6,
    marginBottom: 16,
  },
  sectionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    marginBottom: 16,
  },

  // Section labels — Inter 9pt SemiBold ALL CAPS
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: RED,
    marginBottom: 8,
  },

  // Ingredients
  ingredientGroup: {
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 600,
    marginBottom: 4,
  },
  ingredient: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: 400,
    marginBottom: 3,
    paddingLeft: 4,
  },

  // Steps
  stepsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  stepWrap: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  stepNum: {
    width: 24,
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
    lineHeight: 1.6,
  },
  stepTimer: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: 400,
    fontStyle: 'italic',
    color: GREEN,
    marginTop: 4,
    paddingLeft: 0,
  },

  // Notes
  notesContainer: {
    marginTop: 16,
  },
  notes: {
    fontSize: 10.5,
    fontFamily: 'Inter',
    fontWeight: 400,
    fontStyle: 'italic',
    color: DARK,
    lineHeight: 1.5,
  },

  // Running footer — 3 columns per pdf-design.md
  runningFooter: {
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
  },
  footerRight: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: DARK,
  },

  // Legacy page number (kept for blank pages)
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 45,
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: MUTED,
  },

  // Back page — per pdf-design.md
  backPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
  },
  backHatIcon: {
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
  backUrl: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 400,
    color: RED,
  },
});

interface CookbookInteriorProps {
  title: string;
  subtitle?: string;
  authorName: string;
  recipes: RecipeWithDetails[];
  recipeImages: Record<string, string | null>;
  coverStyle?: 'classic' | 'modern' | 'minimal';
  chefsHatBase64?: string | null;
}

// Helper to truncate recipe title for footer (max 40 chars)
function truncateTitle(title: string, maxLen = 40): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '…';
}

// Helper to generate dotted leader string
function generateDots(count = 80): string {
  return ' . '.repeat(count);
}

// Helper to fix timer character bug (ñ → ⏱)
function fixTimerCharacter(text: string): string {
  return text.replace(/ñ\s*(\d)/g, '⏱ $1');
}

// Helper to normalize bullet characters (- → •)
function normalizeBullet(text: string): string {
  return text.replace(/^-\s*/gm, '• ');
}

export function CookbookInteriorDocument({
  title,
  subtitle,
  authorName,
  recipes,
  recipeImages,
  coverStyle = 'classic',
  chefsHatBase64,
}: CookbookInteriorProps) {
  // Calculate page numbers (rough estimate: ~2 pages per recipe)
  const tocStartPage = 3;
  const tocPages = Math.ceil(recipes.length / 25);
  const recipeStartPage = tocStartPage + tocPages;

  return (
    <Document>
      {/* Title Page — per pdf-design.md */}
      <Page size="LETTER" style={s.page}>
        <View style={s.titlePage}>
          {/* Classic style: inset red border frame */}
          {coverStyle === 'classic' && <View style={s.titlePageFrame} />}

          {/* Chef hat icon */}
          {chefsHatBase64 && (
            <Image src={chefsHatBase64} style={s.chefsHatIcon} />
          )}

          <Text style={s.bookTitle}>{title}</Text>
          {subtitle && <Text style={s.bookSubtitle}>{subtitle}</Text>}

          {/* Thin red divider line */}
          <View style={s.titleDivider} />

          <Text style={s.bookAuthor}>by {authorName}</Text>

          {/* Footer branding */}
          <View style={s.logoFooter}>
            <Text style={s.logoText}>
              Created with <Text style={s.logoRed}>Chefs</Text>Book
            </Text>
            <Text style={[s.logoText, { marginTop: 4 }]}>chefsbk.app</Text>
          </View>
        </View>
      </Page>

      {/* Blank page (back of title page) */}
      <Page size="LETTER" style={s.page}>
        <View style={{ flex: 1 }} />
      </Page>

      {/* Table of Contents — per pdf-design.md */}
      <Page size="LETTER" style={s.tocPage}>
        <Text style={s.tocTitle}>Contents</Text>
        <View style={s.tocDivider} />
        {recipes.map((recipe, idx) => (
          <View key={recipe.id} style={s.tocEntry}>
            <Text style={s.tocRecipe}>{recipe.title}</Text>
            <Text style={s.tocDots}>{generateDots()}</Text>
            <Text style={s.tocPageNumber}>{recipeStartPage + idx * 2}</Text>
          </View>
        ))}
        <Text style={s.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Recipe Pages — per pdf-design.md */}
      {recipes.map((recipe) => {
        const image = recipeImages[recipe.id];
        const metaParts: string[] = [];
        if (recipe.cuisine) metaParts.push(recipe.cuisine);
        if (recipe.course) metaParts.push(recipe.course);
        if (recipe.total_minutes) metaParts.push(formatDuration(recipe.total_minutes));
        if (recipe.servings) metaParts.push(`${recipe.servings} servings`);

        // Group ingredients
        const ingredientGroups: { label: string | null; items: typeof recipe.ingredients }[] = [];
        let currentGroup: string | null = null;
        let currentItems: typeof recipe.ingredients = [];
        for (const ing of recipe.ingredients) {
          if (ing.group_label !== currentGroup) {
            if (currentItems.length > 0) ingredientGroups.push({ label: currentGroup, items: currentItems });
            currentGroup = ing.group_label;
            currentItems = [ing];
          } else {
            currentItems.push(ing);
          }
        }
        if (currentItems.length > 0) ingredientGroups.push({ label: currentGroup, items: currentItems });

        return (
          <Page key={recipe.id} size="LETTER" style={s.page}>
            {/* Recipe photo — full width, 280pt max height */}
            {image && <Image src={image} style={s.recipeHero} />}

            {/* Recipe title — Playfair Display Bold 30pt */}
            <Text style={s.recipeTitle}>{recipe.title}</Text>

            {/* Meta row — cuisine · course · time · servings */}
            {metaParts.length > 0 && (
              <Text style={s.metaRow}>{metaParts.join('  ·  ')}</Text>
            )}

            {/* Description — Inter Light 11pt */}
            {recipe.description && (
              <Text style={s.description}>{recipe.description}</Text>
            )}

            <View style={s.sectionDivider} />

            {/* INGREDIENTS section */}
            {recipe.ingredients.length > 0 && (
              <View>
                <Text style={s.sectionLabel}>INGREDIENTS</Text>
                {ingredientGroups.map((group, gi) => (
                  <View key={gi} style={s.ingredientGroup}>
                    {group.label && <Text style={s.groupLabel}>{group.label}</Text>}
                    {group.items.map((ing, i) => {
                      const qty = ing.quantity ? formatQuantity(ing.quantity) : '';
                      const unit = ing.unit ?? '';
                      const prep = ing.preparation ? `, ${ing.preparation}` : '';
                      // Always use • bullet, never dash
                      return (
                        <Text key={i} style={s.ingredient}>
                          •  {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={s.sectionDivider} />

            {/* STEPS section */}
            {recipe.steps.length > 0 && (
              <View style={s.stepsContainer}>
                <Text style={s.sectionLabel}>STEPS</Text>
                {recipe.steps.map((step) => {
                  // Fix timer character bug (ñ → ⏱)
                  const instruction = fixTimerCharacter(step.instruction);
                  return (
                    <View key={step.step_number} style={s.stepWrap} wrap={false}>
                      <Text style={s.stepNum}>{step.step_number}</Text>
                      <View style={s.stepContent}>
                        <Text style={s.stepText}>{instruction}</Text>
                        {/* Timer on separate line, green italic */}
                        {step.timer_minutes && step.timer_minutes > 0 && (
                          <Text style={s.stepTimer}>
                            ⏱ {formatDuration(step.timer_minutes)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* NOTES section */}
            {recipe.notes && (
              <View style={s.notesContainer}>
                <View style={s.sectionDivider} />
                <Text style={s.sectionLabel}>NOTES</Text>
                <Text style={s.notes}>{recipe.notes}</Text>
              </View>
            )}

            {/* Running footer — 3 columns per pdf-design.md */}
            <View style={s.runningFooter} fixed>
              <Text style={s.footerLeft}>ChefsBook</Text>
              <Text style={s.footerCenter}>{truncateTitle(recipe.title)}</Text>
              <Text style={s.footerRight} render={({ pageNumber }) => `${pageNumber}`} />
            </View>
          </Page>
        );
      })}

      {/* Back Page — per pdf-design.md */}
      <Page size="LETTER" style={s.page}>
        <View style={s.backPage}>
          {/* Chef hat icon — large, 80pt */}
          {chefsHatBase64 && (
            <Image src={chefsHatBase64} style={s.backHatIcon} />
          )}

          {/* Wordmark — Playfair Bold 32pt */}
          <Text style={s.backWordmark}>ChefsBook</Text>

          {/* Tagline — Inter Light 14pt, muted */}
          <Text style={s.backTagline}>Your recipes, beautifully collected.</Text>

          {/* URL — Inter Regular 12pt, red */}
          <Text style={s.backUrl}>chefsbk.app</Text>
        </View>
      </Page>
    </Document>
  );
}

// Cover styles — per pdf-design.md
const coverStyles = {
  classic: {
    bg: CREAM,
    titleColor: DARK,
    subtitleColor: MUTED,
    authorColor: MUTED,
    accentColor: RED,
    spineBg: RED,
    spineTextColor: '#ffffff',
  },
  modern: {
    bg: '#1a1a1a',
    titleColor: '#ffffff',
    subtitleColor: CREAM,
    authorColor: '#888888',
    accentColor: RED,
    spineBg: '#1a1a1a',
    spineTextColor: '#ffffff',
  },
  minimal: {
    bg: '#ffffff',
    titleColor: DARK,
    subtitleColor: MUTED,
    authorColor: MUTED,
    accentColor: RED,
    spineBg: '#ffffff',
    spineTextColor: DARK,
  },
};

interface CookbookCoverProps {
  title: string;
  subtitle?: string;
  authorName: string;
  coverStyle: 'classic' | 'modern' | 'minimal';
  pageCount: number;
  spineWidth: number; // in points (72 pts = 1 inch)
  chefsHatBase64?: string | null;
}

export function CookbookCoverDocument({
  title,
  subtitle,
  authorName,
  coverStyle,
  pageCount,
  spineWidth,
  chefsHatBase64,
}: CookbookCoverProps) {
  const style = coverStyles[coverStyle] || coverStyles.classic;

  // Cover dimensions: back + spine + front
  // Each cover is 8.5" wide, total width = 17" + spine
  const coverWidth = 612; // 8.5" in points
  const coverHeight = 792; // 11" in points
  const totalWidth = coverWidth * 2 + spineWidth;
  const bleed = 9; // 0.125" bleed

  const cs = StyleSheet.create({
    page: {
      width: totalWidth + bleed * 2,
      height: coverHeight + bleed * 2,
      backgroundColor: style.bg,
      position: 'relative',
    },
    // Back cover
    backCover: {
      position: 'absolute',
      left: bleed,
      top: bleed,
      width: coverWidth,
      height: coverHeight,
      padding: 54,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backHatIcon: {
      width: 60,
      height: 60,
      marginBottom: 20,
    },
    backText: {
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 300,
      color: style.subtitleColor,
      textAlign: 'center',
      marginBottom: 8,
    },
    backLogo: {
      fontSize: 11,
      fontFamily: 'Inter',
      fontWeight: 400,
      color: style.authorColor,
      textAlign: 'center',
      marginTop: 16,
    },
    backUrl: {
      fontSize: 12,
      fontFamily: 'Inter',
      fontWeight: 400,
      color: RED,
      textAlign: 'center',
      marginTop: 4,
    },
    barcodeArea: {
      position: 'absolute',
      bottom: 54,
      right: 54,
      width: 120,
      height: 60,
      borderWidth: 0.5,
      borderColor: style.authorColor,
      justifyContent: 'center',
      alignItems: 'center',
    },
    barcodeText: {
      fontSize: 8,
      fontFamily: 'Inter',
      fontWeight: 300,
      color: style.authorColor,
    },
    // Spine — per pdf-design.md
    spine: {
      position: 'absolute',
      left: bleed + coverWidth,
      top: bleed,
      width: spineWidth,
      height: coverHeight,
      backgroundColor: style.spineBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    spineText: {
      fontSize: spineWidth > 30 ? 12 : 8,
      fontFamily: 'Playfair Display',
      fontWeight: 700,
      color: style.spineTextColor,
      transform: 'rotate(-90deg)',
    },
    spineFooter: {
      position: 'absolute',
      bottom: 24,
      fontSize: 8,
      fontFamily: 'Inter',
      fontWeight: 300,
      color: style.spineTextColor,
      transform: 'rotate(-90deg)',
    },
    // Front cover — per pdf-design.md
    frontCover: {
      position: 'absolute',
      left: bleed + coverWidth + spineWidth,
      top: bleed,
      width: coverWidth,
      height: coverHeight,
      padding: 72,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Classic style: inset red border frame
    frontFrame: {
      position: 'absolute',
      top: 24,
      left: 24,
      right: 24,
      bottom: 24,
      borderWidth: 1,
      borderColor: RED,
    },
    // Minimal style: red accent bar at top
    accentBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 12,
      backgroundColor: RED,
    },
    frontHatIcon: {
      width: 50,
      height: 50,
      marginBottom: 24,
    },
    frontTitle: {
      fontSize: 42,
      fontFamily: 'Playfair Display',
      fontWeight: 700,
      color: style.titleColor,
      textAlign: 'center',
      marginBottom: 12,
    },
    frontSubtitle: {
      fontSize: 18,
      fontFamily: 'Playfair Display',
      fontWeight: 400,
      fontStyle: 'italic',
      color: style.subtitleColor,
      textAlign: 'center',
      marginBottom: 24,
    },
    frontDivider: {
      width: 80,
      height: 1,
      backgroundColor: style.accentColor,
      marginVertical: 16,
    },
    frontAuthor: {
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 300,
      color: style.authorColor,
      textAlign: 'center',
    },
  });

  const recipeCount = pageCount > 10 ? Math.floor((pageCount - 4) / 2) : pageCount;

  return (
    <Document>
      <Page size={{ width: totalWidth + bleed * 2, height: coverHeight + bleed * 2 }} style={cs.page}>
        {/* Back Cover — centered branding per pdf-design.md */}
        <View style={cs.backCover}>
          {chefsHatBase64 && (
            <Image src={chefsHatBase64} style={cs.backHatIcon} />
          )}
          <Text style={cs.backText}>
            A collection of {recipeCount} recipes
          </Text>
          <Text style={cs.backText}>curated with love.</Text>
          <Text style={cs.backLogo}>Created with ChefsBook</Text>
          <Text style={cs.backUrl}>chefsbk.app</Text>
          <View style={cs.barcodeArea}>
            <Text style={cs.barcodeText}>ISBN barcode area</Text>
          </View>
        </View>

        {/* Spine — per pdf-design.md */}
        {spineWidth > 20 && (
          <View style={cs.spine}>
            <Text style={cs.spineText}>{title}</Text>
            <Text style={cs.spineFooter}>ChefsBook</Text>
          </View>
        )}

        {/* Front Cover — per pdf-design.md */}
        <View style={cs.frontCover}>
          {/* Classic style: inset border frame */}
          {coverStyle === 'classic' && <View style={cs.frontFrame} />}

          {/* Minimal style: red accent bar at top */}
          {coverStyle === 'minimal' && <View style={cs.accentBar} />}

          {/* Chef hat icon */}
          {chefsHatBase64 && (
            <Image src={chefsHatBase64} style={cs.frontHatIcon} />
          )}

          <Text style={cs.frontTitle}>{title}</Text>
          {subtitle && <Text style={cs.frontSubtitle}>{subtitle}</Text>}

          {/* Thin divider line */}
          <View style={cs.frontDivider} />

          <Text style={cs.frontAuthor}>by {authorName}</Text>
        </View>
      </Page>
    </Document>
  );
}
