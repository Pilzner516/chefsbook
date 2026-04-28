'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookLayout,
  BookCard,
  RecipeCard,
  CoverCard,
  ForewordCard,
  computePageMap,
  getRecipeCards,
} from '@/lib/book-layout';
import { getStrings, type BookStrings } from '@/lib/pdf-templates/book-strings';
import { proxyIfNeeded } from '@/lib/recipeImage';
import type { QualityResult, QualityTier } from '@/lib/print-quality';

interface FlipbookPreviewProps {
  layout: BookLayout;
  onClose: () => void;
  imageQualities: Record<string, QualityResult>;
  templateStyle: string;
}

interface PageContent {
  type: 'cover' | 'foreword' | 'toc' | 'recipe-image' | 'recipe-content' | 'index' | 'back' | 'blank';
  card?: BookCard;
  pageIndex?: number;
  recipePart?: number;
}

const PAGE_WIDTH = 340;
const PAGE_HEIGHT = 440;

export default function FlipbookPreview({
  layout,
  onClose,
  imageQualities,
  templateStyle,
}: FlipbookPreviewProps) {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [turning, setTurning] = useState<'forward' | 'backward' | null>(null);
  const strings = getStrings(layout.language);

  const pages = useMemo(() => buildPageList(layout), [layout]);
  const pageMap = useMemo(() => computePageMap(layout), [layout]);
  const totalSpreads = Math.ceil(pages.length / 2);

  const leftPageIndex = spreadIndex * 2;
  const rightPageIndex = spreadIndex * 2 + 1;
  const leftPage = pages[leftPageIndex];
  const rightPage = pages[rightPageIndex];

  const canGoBack = spreadIndex > 0;
  const canGoForward = spreadIndex < totalSpreads - 1;

  const goForward = useCallback(() => {
    if (!canGoForward || turning) return;
    setTurning('forward');
  }, [canGoForward, turning]);

  const goBackward = useCallback(() => {
    if (!canGoBack || turning) return;
    setTurning('backward');
  }, [canGoBack, turning]);

  const handleAnimationEnd = useCallback(() => {
    if (turning === 'forward') {
      setSpreadIndex((prev) => prev + 1);
    } else if (turning === 'backward') {
      setSpreadIndex((prev) => prev - 1);
    }
    setTurning(null);
  }, [turning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goForward();
      if (e.key === 'ArrowLeft') goBackward();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goForward, goBackward, onClose]);

  const jumpToSpread = (index: number) => {
    if (index === spreadIndex || turning) return;
    setSpreadIndex(index);
  };

  const palette = getTemplatePalette(templateStyle);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <style>{flipbookStyles}</style>

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div className="text-white/70 text-sm">
          8.5 x 11 in &middot; Letter / Lulu standard &middot; ~42% scale
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white p-2"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Book spread */}
      <div
        className="relative flex"
        style={{
          perspective: '1200px',
          perspectiveOrigin: 'center center',
        }}
      >
        {/* Left page */}
        <div
          className="relative bg-white shadow-lg"
          style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        >
          {leftPage && (
            <PageRenderer
              content={leftPage}
              strings={strings}
              palette={palette}
              layout={layout}
              pageMap={pageMap}
              imageQualities={imageQualities}
            />
          )}
        </div>

        {/* Spine */}
        <div className="w-1 bg-gray-300" />

        {/* Right page */}
        <div
          className="relative bg-white shadow-lg"
          style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        >
          {rightPage && (
            <PageRenderer
              content={rightPage}
              strings={strings}
              palette={palette}
              layout={layout}
              pageMap={pageMap}
              imageQualities={imageQualities}
            />
          )}
        </div>

        {/* Turning leaf (forward) */}
        {turning === 'forward' && rightPage && (
          <div
            className="absolute turning-leaf-forward"
            style={{
              left: PAGE_WIDTH + 4,
              top: 0,
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              transformStyle: 'preserve-3d',
              transformOrigin: 'left center',
            }}
            onAnimationEnd={handleAnimationEnd}
          >
            {/* Front face (current right page) */}
            <div className="leaf-front bg-white">
              <PageRenderer
                content={rightPage}
                strings={strings}
                palette={palette}
                layout={layout}
                pageMap={pageMap}
                imageQualities={imageQualities}
              />
            </div>
            {/* Back face (next left page) */}
            <div className="leaf-back bg-white">
              {pages[rightPageIndex + 1] && (
                <PageRenderer
                  content={pages[rightPageIndex + 1]}
                  strings={strings}
                  palette={palette}
                  layout={layout}
                  pageMap={pageMap}
                  imageQualities={imageQualities}
                />
              )}
            </div>
          </div>
        )}

        {/* Turning leaf (backward) */}
        {turning === 'backward' && leftPage && (
          <div
            className="absolute turning-leaf-backward"
            style={{
              left: 0,
              top: 0,
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              transformStyle: 'preserve-3d',
              transformOrigin: 'right center',
            }}
            onAnimationEnd={handleAnimationEnd}
          >
            {/* Front face (current left page) */}
            <div className="leaf-front bg-white">
              <PageRenderer
                content={leftPage}
                strings={strings}
                palette={palette}
                layout={layout}
                pageMap={pageMap}
                imageQualities={imageQualities}
              />
            </div>
            {/* Back face (previous right page) */}
            <div className="leaf-back bg-white">
              {pages[leftPageIndex - 1] && (
                <PageRenderer
                  content={pages[leftPageIndex - 1]}
                  strings={strings}
                  palette={palette}
                  layout={layout}
                  pageMap={pageMap}
                  imageQualities={imageQualities}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-8 mt-6">
        <button
          onClick={goBackward}
          disabled={!canGoBack || !!turning}
          className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-2"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-white/70 text-sm">
          {spreadIndex + 1} / {totalSpreads}
        </span>
        <button
          onClick={goForward}
          disabled={!canGoForward || !!turning}
          className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-2"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-1 mt-4 p-2 bg-black/50 rounded-lg max-w-full overflow-x-auto">
        {Array.from({ length: totalSpreads }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => jumpToSpread(idx)}
            className={`flex-shrink-0 border-2 rounded transition-all ${
              idx === spreadIndex
                ? 'border-white scale-110'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <div
              className="bg-white rounded-sm flex"
              style={{ width: 32, height: 20 }}
            >
              <div className="w-1/2 bg-gray-100" />
              <div className="w-px bg-gray-300" />
              <div className="w-1/2 bg-gray-100" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function buildPageList(layout: BookLayout): PageContent[] {
  const pages: PageContent[] = [];

  for (const card of layout.cards) {
    switch (card.type) {
      case 'cover':
        pages.push({ type: 'cover', card });
        break;
      case 'foreword':
        pages.push({ type: 'foreword', card });
        break;
      case 'toc':
        pages.push({ type: 'toc', card });
        break;
      case 'recipe':
        for (let i = 0; i < card.pages.length; i++) {
          const page = card.pages[i];
          if (page.kind === 'image') {
            pages.push({ type: 'recipe-image', card, pageIndex: i });
          } else if (page.kind === 'content') {
            pages.push({ type: 'recipe-content', card, pageIndex: i, recipePart: page.part });
          } else {
            pages.push({ type: 'recipe-content', card, pageIndex: i });
          }
        }
        break;
      case 'index':
        pages.push({ type: 'index', card });
        break;
      case 'back':
        pages.push({ type: 'back', card });
        break;
    }
  }

  if (pages.length % 2 !== 0) {
    pages.push({ type: 'blank' });
  }

  return pages;
}

interface PageRendererProps {
  content: PageContent;
  strings: BookStrings;
  palette: TemplatePalette;
  layout: BookLayout;
  pageMap: Record<string, number>;
  imageQualities: Record<string, QualityResult>;
}

function PageRenderer({
  content,
  strings,
  palette,
  layout,
  pageMap,
  imageQualities,
}: PageRendererProps) {
  switch (content.type) {
    case 'cover':
      return <CoverPagePreview card={content.card as CoverCard} strings={strings} palette={palette} />;
    case 'foreword':
      return <ForewordPagePreview card={content.card as ForewordCard} strings={strings} palette={palette} />;
    case 'toc':
      return <TocPagePreview layout={layout} pageMap={pageMap} strings={strings} palette={palette} />;
    case 'recipe-image':
      return (
        <RecipeImagePagePreview
          card={content.card as RecipeCard}
          pageIndex={content.pageIndex!}
          strings={strings}
          palette={palette}
          imageQualities={imageQualities}
        />
      );
    case 'recipe-content':
      return (
        <RecipeContentPagePreview
          card={content.card as RecipeCard}
          part={content.recipePart}
          strings={strings}
          palette={palette}
        />
      );
    case 'index':
      return <IndexPagePreview layout={layout} pageMap={pageMap} strings={strings} palette={palette} />;
    case 'back':
      return <BackPagePreview palette={palette} strings={strings} />;
    case 'blank':
      return <div className="w-full h-full bg-gray-50" />;
    default:
      return null;
  }
}

function CoverPagePreview({
  card,
  strings,
  palette,
}: {
  card: CoverCard;
  strings: BookStrings;
  palette: TemplatePalette;
}) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-3 text-center"
      style={{ backgroundColor: palette.coverBg, color: palette.coverText }}
    >
      {card.image_url && (
        <img
          src={proxyIfNeeded(card.image_url)}
          alt=""
          className="w-16 h-16 object-cover rounded mb-2"
        />
      )}
      <h1 className="text-sm font-bold leading-tight">{card.title}</h1>
      {card.subtitle && <p className="text-[8px] mt-0.5 opacity-80">{card.subtitle}</p>}
      <p className="text-[7px] mt-1 opacity-60">by {card.author}</p>
    </div>
  );
}

function ForewordPagePreview({
  card,
  strings,
  palette,
}: {
  card: ForewordCard;
  strings: BookStrings;
  palette: TemplatePalette;
}) {
  return (
    <div className="w-full h-full p-3 flex flex-col" style={{ backgroundColor: palette.pageBg }}>
      <h2 className="text-[8px] font-semibold mb-2 tracking-widest" style={{ color: palette.accent }}>
        {strings.foreword.toUpperCase()}
      </h2>
      <p className="text-[6px] italic leading-relaxed" style={{ color: palette.text }}>
        {card.text || 'No foreword written yet.'}
      </p>
    </div>
  );
}

function TocPagePreview({
  layout,
  pageMap,
  strings,
  palette,
}: {
  layout: BookLayout;
  pageMap: Record<string, number>;
  strings: BookStrings;
  palette: TemplatePalette;
}) {
  const recipes = getRecipeCards(layout);

  return (
    <div className="w-full h-full p-3" style={{ backgroundColor: palette.pageBg }}>
      <h2 className="text-[9px] font-bold mb-2" style={{ color: palette.accent }}>
        {strings.contents}
      </h2>
      <div className="space-y-0.5">
        {recipes.slice(0, 12).map((recipe) => (
          <div key={recipe.id} className="flex justify-between text-[5px]" style={{ color: palette.text }}>
            <span className="truncate flex-1 pr-1">{recipe.display_name}</span>
            <span className="text-[5px] opacity-60">{pageMap[recipe.id]}</span>
          </div>
        ))}
        {recipes.length > 12 && (
          <p className="text-[5px] opacity-50" style={{ color: palette.text }}>
            ...and {recipes.length - 12} more
          </p>
        )}
      </div>
    </div>
  );
}

function RecipeImagePagePreview({
  card,
  pageIndex,
  strings,
  palette,
  imageQualities,
}: {
  card: RecipeCard;
  pageIndex: number;
  strings: BookStrings;
  palette: TemplatePalette;
  imageQualities: Record<string, QualityResult>;
}) {
  const page = card.pages[pageIndex];
  const imageUrl = page?.kind === 'image' ? page.image_url : undefined;
  const quality = imageUrl ? imageQualities[imageUrl] : undefined;

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: palette.pageBg }}>
      {imageUrl ? (
        <img src={proxyIfNeeded(imageUrl)} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <span className="text-[8px] text-gray-400">No image</span>
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 p-2"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
      >
        <h3 className="text-[8px] font-bold text-white truncate">{card.display_name}</h3>
      </div>
      {quality && quality.tier !== 'excellent' && (
        <div className="absolute top-1 right-1">
          <QualityDot tier={quality.tier} />
        </div>
      )}
    </div>
  );
}

function RecipeContentPagePreview({
  card,
  part,
  strings,
  palette,
}: {
  card: RecipeCard;
  part?: number;
  strings: BookStrings;
  palette: TemplatePalette;
}) {
  return (
    <div className="w-full h-full p-2" style={{ backgroundColor: palette.pageBg }}>
      <h3 className="text-[7px] font-bold mb-1 truncate" style={{ color: palette.accent }}>
        {card.display_name} {part && part > 1 && `(${part})`}
      </h3>
      <div className="flex gap-2">
        <div className="w-1/3">
          <h4 className="text-[5px] font-semibold mb-0.5" style={{ color: palette.text }}>
            {strings.ingredients.toUpperCase()}
          </h4>
          <div className="space-y-px">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-1 bg-gray-200 rounded-sm" style={{ width: `${60 + i * 8}%` }} />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <h4 className="text-[5px] font-semibold mb-0.5" style={{ color: palette.text }}>
            {strings.steps.toUpperCase()}
          </h4>
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-0.5">
                <span className="text-[4px] w-2" style={{ color: palette.accent }}>{i}.</span>
                <div className="flex-1 h-1 bg-gray-200 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexPagePreview({
  layout,
  pageMap,
  strings,
  palette,
}: {
  layout: BookLayout;
  pageMap: Record<string, number>;
  strings: BookStrings;
  palette: TemplatePalette;
}) {
  const recipes = getRecipeCards(layout).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );

  return (
    <div className="w-full h-full p-3" style={{ backgroundColor: palette.pageBg }}>
      <h2 className="text-[9px] font-bold mb-2" style={{ color: palette.accent }}>
        {strings.index}
      </h2>
      <div className="space-y-0.5">
        {recipes.slice(0, 15).map((recipe) => (
          <div key={recipe.id} className="flex justify-between text-[5px]" style={{ color: palette.text }}>
            <span className="truncate flex-1 pr-1">{recipe.display_name}</span>
            <span className="text-[5px] opacity-60">{pageMap[recipe.id]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackPagePreview({
  palette,
  strings,
}: {
  palette: TemplatePalette;
  strings: BookStrings;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white">
      <div className="text-lg font-bold">ChefsBook</div>
      <p className="text-[6px] opacity-60 mt-1">{strings.tagline}</p>
    </div>
  );
}

function QualityDot({ tier }: { tier: QualityTier }) {
  const colors: Record<QualityTier, string> = {
    excellent: 'bg-green-500',
    acceptable: 'bg-amber-500',
    poor: 'bg-red-500',
  };
  return <div className={`w-2 h-2 rounded-full ${colors[tier]}`} />;
}

interface TemplatePalette {
  coverBg: string;
  coverText: string;
  pageBg: string;
  accent: string;
  text: string;
}

function getTemplatePalette(style: string): TemplatePalette {
  const palettes: Record<string, TemplatePalette> = {
    classic: {
      coverBg: '#1a1a1a',
      coverText: '#ffffff',
      pageBg: '#faf7f0',
      accent: '#ce2b37',
      text: '#1a1a1a',
    },
    modern: {
      coverBg: '#ffffff',
      coverText: '#1a1a1a',
      pageBg: '#ffffff',
      accent: '#ce2b37',
      text: '#1a1a1a',
    },
    minimal: {
      coverBg: '#f5f5f5',
      coverText: '#333333',
      pageBg: '#ffffff',
      accent: '#666666',
      text: '#333333',
    },
    heritage: {
      coverBg: '#2d1810',
      coverText: '#f5e6d3',
      pageBg: '#faf5ef',
      accent: '#8b4513',
      text: '#2d1810',
    },
    nordic: {
      coverBg: '#1e3a4c',
      coverText: '#e8f1f5',
      pageBg: '#f8fafb',
      accent: '#2d5a7b',
      text: '#1e3a4c',
    },
    bbq: {
      coverBg: '#2c1810',
      coverText: '#f5e0c0',
      pageBg: '#fdf6ec',
      accent: '#b8860b',
      text: '#2c1810',
    },
    garden: {
      coverBg: '#1a3c1a',
      coverText: '#e8f5e8',
      pageBg: '#f5faf5',
      accent: '#228b22',
      text: '#1a3c1a',
    },
    trattoria: {
      coverBg: '#faf7f0',
      coverText: '#ce2b37',
      pageBg: '#faf7f0',
      accent: '#ce2b37',
      text: '#1a1a1a',
    },
    studio: {
      coverBg: '#0a0a0a',
      coverText: '#ffffff',
      pageBg: '#1a1a1a',
      accent: '#ffffff',
      text: '#e5e5e5',
    },
  };

  return palettes[style] || palettes.classic;
}

const flipbookStyles = `
  .turning-leaf-forward {
    animation: flipForward 0.65s cubic-bezier(.645,.045,.355,1) forwards;
  }

  .turning-leaf-backward {
    animation: flipBackward 0.65s cubic-bezier(.645,.045,.355,1) forwards;
  }

  @keyframes flipForward {
    from { transform: rotateY(0deg); }
    to { transform: rotateY(-180deg); }
  }

  @keyframes flipBackward {
    from { transform: rotateY(0deg); }
    to { transform: rotateY(180deg); }
  }

  .leaf-front, .leaf-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    overflow: hidden;
  }

  .leaf-back {
    transform: rotateY(180deg);
  }
`;
