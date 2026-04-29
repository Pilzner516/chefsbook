'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FlipbookPreviewProps {
  pdfUrl: string | null;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}

const PAGE_WIDTH = 380;
const PAGE_HEIGHT = 492; // 8.5x11 ratio

export default function FlipbookPreview({
  pdfUrl,
  onClose,
  loading = false,
  error = null,
}: FlipbookPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  // -1 = closed (cover only), 0+ = spread index
  const [viewIndex, setViewIndex] = useState(-1);
  const [turning, setTurning] = useState<'forward' | 'backward' | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  const isClosed = viewIndex === -1;
  // When open, viewIndex 0 = pages 2-3, viewIndex 1 = pages 4-5, etc.
  // (page 1 is the cover, shown when closed)
  const leftPageNum = isClosed ? 0 : viewIndex * 2 + 2;
  const rightPageNum = isClosed ? 1 : viewIndex * 2 + 3;

  // Total spreads when open (excluding the closed cover view)
  const totalSpreads = Math.ceil((numPages - 1) / 2);

  const canGoBack = viewIndex >= 0; // Can go back to closed or previous spread
  const canGoForward = isClosed || viewIndex < totalSpreads - 1;

  const goForward = useCallback(() => {
    if (!canGoForward || turning) return;
    setTurning('forward');
    setTimeout(() => {
      setViewIndex((prev) => prev + 1);
      setTurning(null);
    }, 400);
  }, [canGoForward, turning]);

  const goBackward = useCallback(() => {
    if (!canGoBack || turning) return;
    setTurning('backward');
    setTimeout(() => {
      setViewIndex((prev) => prev - 1);
      setTurning(null);
    }, 400);
  }, [canGoBack, turning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goForward();
      if (e.key === 'ArrowLeft') goBackward();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goForward, goBackward, onClose]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPdfLoading(false);
  };

  const jumpToView = (index: number) => {
    if (index === viewIndex || turning) return;
    setViewIndex(index);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
        <div className="text-white text-center">
          <svg className="w-12 h-12 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-lg font-medium">Generating PDF Preview...</p>
          <p className="text-sm text-white/60 mt-2">This may take a moment</p>
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
        <div className="text-white text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-lg font-medium mb-2">Preview Generation Failed</p>
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // No PDF URL yet
  if (!pdfUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
        <p className="text-white">No preview available</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  const getPageLabel = () => {
    if (isClosed) return 'Cover';
    if (leftPageNum <= numPages && rightPageNum <= numPages) {
      return `Pages ${leftPageNum}-${rightPageNum} of ${numPages}`;
    }
    if (leftPageNum <= numPages) {
      return `Page ${leftPageNum} of ${numPages}`;
    }
    return `${numPages} pages`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <style>{flipbookStyles}</style>

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div className="text-white/70 text-sm">
          8.5 x 11 in &middot; Letter / Lulu standard &middot; Actual PDF Preview
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

      {/* PDF Document */}
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center gap-3 text-white">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading PDF...
          </div>
        }
        error={
          <div className="text-red-400 text-center">
            <p>Failed to load PDF</p>
            <p className="text-sm text-white/60 mt-1">Check the console for details</p>
          </div>
        }
      >
        {/* Closed book - just show cover */}
        {!pdfLoading && numPages > 0 && isClosed && (
          <div
            className="relative cursor-pointer"
            onClick={goForward}
            title="Click to open"
          >
            <div
              className="relative bg-white shadow-2xl overflow-hidden rounded-r-sm"
              style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
            >
              <Page
                pageNumber={1}
                width={PAGE_WIDTH}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
              <span className="text-white/80 text-sm bg-black/50 px-3 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                Click to open
              </span>
            </div>
          </div>
        )}

        {/* Open book - show spread */}
        {!pdfLoading && numPages > 0 && !isClosed && (
          <div
            className="relative flex"
            style={{
              perspective: '1200px',
              perspectiveOrigin: 'center center',
            }}
          >
            {/* Left page */}
            <div
              className={`relative bg-white shadow-lg overflow-hidden ${turning === 'backward' ? 'page-turning-back' : ''}`}
              style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
            >
              {leftPageNum <= numPages && (
                <Page
                  pageNumber={leftPageNum}
                  width={PAGE_WIDTH}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              )}
            </div>

            {/* Spine */}
            <div className="w-1 bg-gray-300" />

            {/* Right page */}
            <div
              className={`relative bg-white shadow-lg overflow-hidden ${turning === 'forward' ? 'page-turning-forward' : ''}`}
              style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
            >
              {rightPageNum <= numPages && (
                <Page
                  pageNumber={rightPageNum}
                  width={PAGE_WIDTH}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              )}
            </div>
          </div>
        )}
      </Document>

      {/* Navigation buttons */}
      {!pdfLoading && numPages > 0 && (
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
          <span className="text-white/70 text-sm min-w-[140px] text-center">
            {getPageLabel()}
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
      )}

      {/* Thumbnail strip */}
      {!pdfLoading && numPages > 0 && (
        <div className="flex gap-1 mt-4 p-2 bg-black/50 rounded-lg max-w-full overflow-x-auto">
          {/* Cover thumbnail */}
          <button
            onClick={() => jumpToView(-1)}
            className={`flex-shrink-0 border-2 rounded transition-all ${
              viewIndex === -1
                ? 'border-white scale-110'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <div
              className="bg-gray-700 rounded-sm flex items-center justify-center"
              style={{ width: 24, height: 32 }}
            >
              <span className="text-[6px] text-white/80">Cover</span>
            </div>
          </button>
          {/* Spread thumbnails */}
          {Array.from({ length: totalSpreads }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => jumpToView(idx)}
              className={`flex-shrink-0 border-2 rounded transition-all ${
                idx === viewIndex
                  ? 'border-white scale-110'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className="bg-white rounded-sm flex"
                style={{ width: 36, height: 24 }}
              >
                <div className="w-1/2 bg-gray-100 text-[6px] flex items-center justify-center text-gray-400">
                  {idx * 2 + 2}
                </div>
                <div className="w-px bg-gray-300" />
                <div className="w-1/2 bg-gray-100 text-[6px] flex items-center justify-center text-gray-400">
                  {idx * 2 + 3}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const flipbookStyles = `
  .page-turning-forward {
    animation: flipForward 0.4s ease-in-out;
  }

  .page-turning-back {
    animation: flipBackward 0.4s ease-in-out;
  }

  @keyframes flipForward {
    0% { transform: rotateY(0deg); }
    50% { transform: rotateY(-15deg); }
    100% { transform: rotateY(0deg); }
  }

  @keyframes flipBackward {
    0% { transform: rotateY(0deg); }
    50% { transform: rotateY(15deg); }
    100% { transform: rotateY(0deg); }
  }
`;
