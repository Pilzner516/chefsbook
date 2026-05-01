/**
 * MenuChapterPage — A chapter opening page for menu-based book organisation.
 * Used by all PDF templates when organisation = 'by_menu'.
 *
 * Each template imports this component and passes its accent colour and typography.
 */
import React from 'react';
import { Page, Text, View, Image } from '@react-pdf/renderer';
import type { ComputedLayout, TemplateSettings, BookStrings } from './engine/types';

export interface MenuChapterPageProps {
  menuTitle: string;
  occasion?: string;
  menuNotes?: string;
  recipeCount: number;
  chapterNumber: number;
  layout: ComputedLayout;
  settings: TemplateSettings;
  strings: BookStrings;
  chefsHatBase64?: string | null;
}

function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  let remaining = num;
  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

export function MenuChapterPage({
  menuTitle,
  occasion,
  menuNotes,
  recipeCount,
  chapterNumber,
  layout,
  settings,
  strings,
  chefsHatBase64,
}: MenuChapterPageProps) {
  const { palette, fonts } = settings;

  return (
    <Page
      size={{ width: layout.width, height: layout.height }}
      style={{
        backgroundColor: palette.background,
        paddingTop: layout.marginTop,
        paddingBottom: layout.marginBottom,
        paddingHorizontal: layout.marginOuter,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Chapter number in Roman numerals */}
      <Text
        style={{
          fontSize: layout.fontTitle * 0.6,
          fontFamily: fonts.heading,
          fontWeight: 300,
          color: palette.muted,
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginBottom: layout.sectionGap,
        }}
      >
        {strings.chapter || 'Chapter'} {toRoman(chapterNumber)}
      </Text>

      {/* Decorative divider above title */}
      <View
        style={{
          width: 60,
          height: 1.5,
          backgroundColor: palette.accent,
          marginBottom: layout.sectionGap,
        }}
      />

      {/* Menu title */}
      <Text
        style={{
          fontSize: layout.fontTitle * 0.85,
          fontFamily: fonts.heading,
          fontWeight: 700,
          color: palette.text,
          textAlign: 'center',
          marginBottom: layout.stepGap,
        }}
      >
        {menuTitle}
      </Text>

      {/* Occasion tag pill */}
      {occasion && (
        <View
          style={{
            backgroundColor: palette.accent + '20',
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
            marginBottom: layout.sectionGap,
          }}
        >
          <Text
            style={{
              fontSize: layout.fontCaption,
              fontFamily: fonts.body,
              fontWeight: 500,
              color: palette.accent,
            }}
          >
            {occasion}
          </Text>
        </View>
      )}

      {/* Menu notes */}
      {menuNotes && (
        <Text
          style={{
            fontSize: layout.fontBody,
            fontFamily: fonts.body,
            fontWeight: 300,
            color: palette.muted,
            textAlign: 'center',
            maxWidth: layout.contentWidth * 0.7,
            lineHeight: 1.6,
            marginBottom: layout.sectionGap,
          }}
        >
          {menuNotes}
        </Text>
      )}

      {/* Recipe count */}
      <Text
        style={{
          fontSize: layout.fontCaption,
          fontFamily: fonts.body,
          fontWeight: 400,
          color: palette.muted,
          marginTop: layout.sectionGap,
        }}
      >
        {recipeCount} {recipeCount === 1 ? (strings.recipe || 'Recipe') : (strings.recipes || 'Recipes')}
      </Text>

      {/* Decorative divider below count */}
      <View
        style={{
          width: 40,
          height: 1,
          backgroundColor: palette.muted + '40',
          marginTop: layout.sectionGap * 2,
        }}
      />

      {/* ChefsBook logo footer */}
      <View
        style={{
          position: 'absolute',
          bottom: layout.marginBottom,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        {chefsHatBase64 && (
          <Image
            src={chefsHatBase64}
            style={{
              width: 24,
              height: 24,
              marginBottom: 4,
              opacity: 0.5,
            }}
          />
        )}
        <Text
          style={{
            fontSize: 8,
            fontFamily: fonts.body,
            fontWeight: 300,
            color: palette.muted,
            opacity: 0.7,
          }}
        >
          ChefsBook
        </Text>
      </View>
    </Page>
  );
}
