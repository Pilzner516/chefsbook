import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e0d0',
  },
  logo: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  logoRed: {
    color: '#ce2b37',
  },
  url: {
    fontSize: 9,
    color: '#9a8a7a',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  meta: {
    fontSize: 10,
    color: '#7a6a5a',
    marginBottom: 12,
  },
  description: {
    fontSize: 11,
    color: '#4a4a4a',
    marginBottom: 16,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    color: '#ce2b37',
    letterSpacing: 1,
  },
  ingredient: {
    fontSize: 11,
    marginBottom: 3,
    paddingLeft: 8,
  },
  step: {
    fontSize: 11,
    marginBottom: 6,
    lineHeight: 1.5,
  },
  stepNumber: {
    fontFamily: 'Helvetica-Bold',
    color: '#ce2b37',
  },
  notes: {
    fontSize: 10,
    color: '#7a6a5a',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8e0d0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9a8a7a',
  },
});

interface Props {
  recipe: RecipeWithDetails;
  authorUsername: string | null;
  authorName: string | null;
}

export function RecipePdfDocument({ recipe, authorUsername, authorName }: Props) {
  const metaParts: string[] = [];
  if (recipe.cuisine) metaParts.push(recipe.cuisine);
  if (recipe.course) metaParts.push(recipe.course);
  if (recipe.total_minutes) metaParts.push(formatDuration(recipe.total_minutes));
  if (recipe.servings) metaParts.push(`Serves ${recipe.servings}`);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={styles.logoRed}>Chefs</Text>Book
          </Text>
          <Text style={styles.url}>chefsbk.app</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{recipe.title}</Text>
        {metaParts.length > 0 && (
          <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
        )}

        {/* Description */}
        {recipe.description && (
          <Text style={styles.description}>{recipe.description}</Text>
        )}

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ing, i) => {
              const qty = ing.quantity ? formatQuantity(ing.quantity) : '';
              const unit = ing.unit ?? '';
              const prep = ing.preparation ? `, ${ing.preparation}` : '';
              return (
                <Text key={i} style={styles.ingredient}>
                  • {qty} {unit} {ing.ingredient}{prep}{ing.optional ? ' (optional)' : ''}
                </Text>
              );
            })}
          </>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Steps</Text>
            {recipe.steps.map((step) => (
              <Text key={step.step_number} style={styles.step}>
                <Text style={styles.stepNumber}>{step.step_number}. </Text>
                {step.instruction}
              </Text>
            ))}
          </>
        )}

        {/* Notes */}
        {recipe.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{recipe.notes}</Text>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Shared from chefsbk.app</Text>
          {authorUsername && (
            <Text style={styles.footerText}>
              Recipe by @{authorUsername}
              {authorName ? ` (${authorName})` : ''}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
