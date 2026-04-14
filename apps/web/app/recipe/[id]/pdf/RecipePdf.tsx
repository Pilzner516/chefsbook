import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';

const RED = '#ce2b37';
const GREY = '#7a6a5a';
const MUTED = '#9a8a7a';
const DARK = '#1a1a1a';
const BORDER = '#e8e0d0';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 50, fontFamily: 'Helvetica', fontSize: 11, color: DARK },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logoText: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  logoRed: { color: RED },
  headerUrl: { fontSize: 9, color: MUTED },
  headerLine: { borderBottomWidth: 1.5, borderBottomColor: RED, marginBottom: 16 },

  // Hero image
  heroImage: { width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, marginBottom: 14 },

  // Title + meta
  title: { fontSize: 28, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  metaRow: { fontSize: 11, color: GREY, marginBottom: 10 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginVertical: 10 },
  description: { fontSize: 12, color: '#4a4a4a', lineHeight: 1.6, marginBottom: 12 },

  // Attribution
  attribution: { fontSize: 10, color: GREY, fontStyle: 'italic', marginBottom: 4 },

  // Section
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: RED, letterSpacing: 1.2, marginTop: 16, marginBottom: 4 },
  sectionLine: { borderBottomWidth: 1, borderBottomColor: RED, marginBottom: 8, opacity: 0.5 },

  // Ingredients
  groupLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: DARK, marginTop: 8, marginBottom: 4 },
  ingredient: { fontSize: 11, marginBottom: 3, paddingLeft: 8 },

  // Steps
  stepWrap: { marginBottom: 8 },
  stepText: { fontSize: 11, lineHeight: 1.6 },
  stepNum: { fontFamily: 'Helvetica-Bold', color: RED },
  timer: { fontSize: 10, color: GREY },

  // Notes
  notes: { fontSize: 11, color: GREY, fontStyle: 'italic', lineHeight: 1.5, marginTop: 4 },

  // Footer
  footer: { position: 'absolute', bottom: 28, left: 50, right: 50, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: MUTED },
});

interface Props {
  recipe: RecipeWithDetails;
  imageBase64: string | null;
  originalSubmitter: string | null;
  sharedBy: string | null;
  includeComments?: boolean;
}

export function RecipePdfDocument({ recipe, imageBase64, originalSubmitter, sharedBy, includeComments = true }: Props) {
  const metaParts: string[] = [];
  if (recipe.cuisine) metaParts.push(recipe.cuisine);
  if (recipe.course) metaParts.push(recipe.course);
  if (recipe.total_minutes) metaParts.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) metaParts.push(`${recipe.servings} servings`);

  // Group ingredients by group_label
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

  const footerAttribution = originalSubmitter ? `Original recipe by @${originalSubmitter}` : '';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow} fixed>
          <Text style={s.logoText}><Text style={s.logoRed}>Chefs</Text>Book</Text>
          <Text style={s.headerUrl}>chefsbk.app</Text>
        </View>
        <View style={s.headerLine} fixed />

        {/* Hero image */}
        {imageBase64 && (
          <Image src={imageBase64} style={s.heroImage} />
        )}

        {/* Title */}
        <Text style={s.title}>{recipe.title}</Text>

        {/* Metadata */}
        {metaParts.length > 0 && (
          <Text style={s.metaRow}>{metaParts.join('  ·  ')}</Text>
        )}

        <View style={s.divider} />

        {/* Description */}
        {recipe.description && (
          <Text style={s.description}>{recipe.description}</Text>
        )}

        {/* Attribution */}
        {originalSubmitter && (
          <Text style={s.attribution}>Original recipe by @{originalSubmitter}</Text>
        )}
        {sharedBy && (
          <Text style={s.attribution}>Shared by @{sharedBy}</Text>
        )}

        {/* Ingredients */}
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

        {/* Steps */}
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

        {/* Notes */}
        {recipe.notes && (
          <View>
            <Text style={s.sectionTitle}>Notes</Text>
            <View style={s.sectionLine} />
            <Text style={s.notes}>{recipe.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Saved with ChefsBook · chefsbk.app</Text>
          <Text style={s.footerText}>
            {footerAttribution}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
