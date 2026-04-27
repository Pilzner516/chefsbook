import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';

const RED = '#ce2b37';
const GREEN = '#009246';
const GREY = '#7a6a5a';
const MUTED = '#9a8a7a';
const DARK = '#1a1a1a';
const CREAM = '#faf7f0';
const BORDER = '#e8e0d0';

// Interior PDF: 8.5" × 11" with proper margins for perfect binding
const s = StyleSheet.create({
  page: {
    paddingTop: 54, // 0.75"
    paddingBottom: 54,
    paddingLeft: 63, // 0.875" inner margin
    paddingRight: 45, // 0.625" outer margin
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    backgroundColor: '#ffffff',
  },
  // Title page
  titlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  bookTitle: { fontSize: 36, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 12, color: DARK },
  bookSubtitle: { fontSize: 18, color: GREY, textAlign: 'center', marginBottom: 32 },
  bookAuthor: { fontSize: 14, color: MUTED, textAlign: 'center', marginTop: 40 },
  logoFooter: { position: 'absolute', bottom: 60, fontSize: 10, color: MUTED },
  logoRed: { color: RED },

  // TOC
  tocTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 24, color: RED },
  tocEntry: { flexDirection: 'row', marginBottom: 8 },
  tocRecipe: { flex: 1, fontSize: 11 },
  tocPage: { fontSize: 11, color: MUTED },
  tocDots: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: BORDER, borderBottomStyle: 'dotted', marginHorizontal: 8, marginBottom: 2 },

  // Recipe page
  recipeHero: { width: '100%', height: 180, objectFit: 'cover', borderRadius: 6, marginBottom: 12 },
  recipeTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 6, color: DARK },
  metaRow: { fontSize: 9, color: GREY, marginBottom: 8 },
  description: { fontSize: 10, color: '#4a4a4a', lineHeight: 1.5, marginBottom: 10 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginVertical: 8 },

  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: RED, letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  sectionLine: { borderBottomWidth: 1, borderBottomColor: RED, marginBottom: 6, opacity: 0.4 },

  ingredient: { fontSize: 9, marginBottom: 2, paddingLeft: 6 },
  groupLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2 },

  stepWrap: { marginBottom: 6 },
  stepText: { fontSize: 9, lineHeight: 1.5 },
  stepNum: { fontFamily: 'Helvetica-Bold', color: RED },

  notes: { fontSize: 9, color: GREY, fontStyle: 'italic', lineHeight: 1.4, marginTop: 4 },

  pageNumber: { position: 'absolute', bottom: 30, right: 45, fontSize: 9, color: MUTED },

  // Back page
  backPage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 12, color: MUTED, textAlign: 'center' },
});

interface CookbookInteriorProps {
  title: string;
  subtitle?: string;
  authorName: string;
  recipes: RecipeWithDetails[];
  recipeImages: Record<string, string | null>;
}

export function CookbookInteriorDocument({
  title,
  subtitle,
  authorName,
  recipes,
  recipeImages,
}: CookbookInteriorProps) {
  // Calculate page numbers (rough estimate: ~2 pages per recipe)
  const tocStartPage = 3;
  const tocPages = Math.ceil(recipes.length / 25);
  const recipeStartPage = tocStartPage + tocPages;

  return (
    <Document>
      {/* Title Page */}
      <Page size="LETTER" style={s.page}>
        <View style={s.titlePage}>
          <Text style={s.bookTitle}>{title}</Text>
          {subtitle && <Text style={s.bookSubtitle}>{subtitle}</Text>}
          <Text style={s.bookAuthor}>by {authorName}</Text>
          <Text style={s.logoFooter}>
            Created with <Text style={s.logoRed}>Chefs</Text>Book
          </Text>
        </View>
      </Page>

      {/* Blank page (back of title page) */}
      <Page size="LETTER" style={s.page}>
        <View style={{ flex: 1 }} />
      </Page>

      {/* Table of Contents */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.tocTitle}>Contents</Text>
        {recipes.map((recipe, idx) => (
          <View key={recipe.id} style={s.tocEntry}>
            <Text style={s.tocRecipe}>{recipe.title}</Text>
            <View style={s.tocDots} />
            <Text style={s.tocPage}>{recipeStartPage + idx * 2}</Text>
          </View>
        ))}
        <Text style={s.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Recipe Pages */}
      {recipes.map((recipe, idx) => {
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
            {image && <Image src={image} style={s.recipeHero} />}
            <Text style={s.recipeTitle}>{recipe.title}</Text>
            {metaParts.length > 0 && <Text style={s.metaRow}>{metaParts.join('  ·  ')}</Text>}
            {recipe.description && <Text style={s.description}>{recipe.description}</Text>}
            <View style={s.divider} />

            {recipe.ingredients.length > 0 && (
              <View>
                <Text style={s.sectionTitle}>Ingredients</Text>
                <View style={s.sectionLine} />
                {ingredientGroups.map((group, gi) => (
                  <View key={gi}>
                    {group.label && <Text style={s.groupLabel}>{group.label}</Text>}
                    {group.items.map((ing, i) => {
                      const qty = ing.quantity ? formatQuantity(ing.quantity) : '';
                      const unit = ing.unit ?? '';
                      const prep = ing.preparation ? `, ${ing.preparation}` : '';
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

            {recipe.steps.length > 0 && (
              <View>
                <Text style={s.sectionTitle}>Steps</Text>
                <View style={s.sectionLine} />
                {recipe.steps.map((step) => (
                  <View key={step.step_number} style={s.stepWrap} wrap={false}>
                    <Text style={s.stepText}>
                      <Text style={s.stepNum}>{step.step_number}.  </Text>
                      {step.instruction}
                      {step.timer_minutes ? `  ⏱ ${formatDuration(step.timer_minutes)}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {recipe.notes && (
              <View>
                <Text style={s.sectionTitle}>Notes</Text>
                <View style={s.sectionLine} />
                <Text style={s.notes}>{recipe.notes}</Text>
              </View>
            )}

            <Text style={s.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
          </Page>
        );
      })}

      {/* Back Page */}
      <Page size="LETTER" style={s.page}>
        <View style={s.backPage}>
          <Text style={s.backText}>Created with ChefsBook</Text>
          <Text style={[s.backText, { marginTop: 4 }]}>chefsbk.app</Text>
        </View>
      </Page>
    </Document>
  );
}

// Cover styles
const coverStyles = {
  classic: {
    bg: CREAM,
    titleColor: DARK,
    subtitleColor: GREY,
    authorColor: MUTED,
    accentColor: RED,
    fontFamily: 'Times-Bold',
  },
  modern: {
    bg: '#1a1a1a',
    titleColor: '#ffffff',
    subtitleColor: '#cccccc',
    authorColor: '#888888',
    accentColor: RED,
    fontFamily: 'Helvetica-Bold',
  },
  minimal: {
    bg: '#ffffff',
    titleColor: DARK,
    subtitleColor: GREY,
    authorColor: MUTED,
    accentColor: DARK,
    fontFamily: 'Helvetica',
  },
};

interface CookbookCoverProps {
  title: string;
  subtitle?: string;
  authorName: string;
  coverStyle: 'classic' | 'modern' | 'minimal';
  pageCount: number;
  spineWidth: number; // in points (72 pts = 1 inch)
}

export function CookbookCoverDocument({
  title,
  subtitle,
  authorName,
  coverStyle,
  pageCount,
  spineWidth,
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
    backCover: {
      position: 'absolute',
      left: bleed,
      top: bleed,
      width: coverWidth,
      height: coverHeight,
      padding: 54,
      justifyContent: 'flex-end',
    },
    spine: {
      position: 'absolute',
      left: bleed + coverWidth,
      top: bleed,
      width: spineWidth,
      height: coverHeight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    spineText: {
      fontSize: spineWidth > 30 ? 12 : 8,
      fontFamily: style.fontFamily,
      color: style.titleColor,
      transform: 'rotate(-90deg)',
    },
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
    frontTitle: {
      fontSize: 42,
      fontFamily: style.fontFamily,
      color: style.titleColor,
      textAlign: 'center',
      marginBottom: 16,
    },
    frontSubtitle: {
      fontSize: 18,
      color: style.subtitleColor,
      textAlign: 'center',
      marginBottom: 32,
    },
    frontAuthor: {
      fontSize: 14,
      color: style.authorColor,
      textAlign: 'center',
    },
    accentBar: {
      position: 'absolute',
      top: 60,
      left: 60,
      right: 60,
      height: 4,
      backgroundColor: style.accentColor,
    },
    backText: {
      fontSize: 11,
      color: style.subtitleColor,
      marginBottom: 20,
    },
    backLogo: {
      fontSize: 10,
      color: style.authorColor,
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
      color: style.authorColor,
    },
  });

  return (
    <Document>
      <Page size={{ width: totalWidth + bleed * 2, height: coverHeight + bleed * 2 }} style={cs.page}>
        {/* Back Cover */}
        <View style={cs.backCover}>
          <Text style={cs.backText}>
            A collection of {pageCount > 10 ? Math.floor((pageCount - 4) / 2) : pageCount} recipes
          </Text>
          <Text style={cs.backText}>curated with love.</Text>
          <Text style={cs.backLogo}>Created with ChefsBook · chefsbk.app</Text>
          <View style={cs.barcodeArea}>
            <Text style={cs.barcodeText}>ISBN barcode area</Text>
          </View>
        </View>

        {/* Spine */}
        {spineWidth > 20 && (
          <View style={cs.spine}>
            <Text style={cs.spineText}>{title}</Text>
          </View>
        )}

        {/* Front Cover */}
        <View style={cs.frontCover}>
          {coverStyle === 'classic' && <View style={cs.accentBar} />}
          <Text style={cs.frontTitle}>{title}</Text>
          {subtitle && <Text style={cs.frontSubtitle}>{subtitle}</Text>}
          <Text style={cs.frontAuthor}>by {authorName}</Text>
        </View>
      </Page>
    </Document>
  );
}
