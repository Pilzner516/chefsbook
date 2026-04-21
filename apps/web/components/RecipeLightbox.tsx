'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface RecipeLightboxProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function RecipeLightbox({ images, isOpen, onClose }: RecipeLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to first image when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const showNavigation = images.length > 1;

  const lightboxContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.92)' }}
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[10000] w-10 h-10 flex items-center justify-center text-white hover:text-white/80 transition-colors text-3xl"
        aria-label="Close lightbox"
      >
        ×
      </button>

      {/* Left arrow */}
      {showNavigation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-[10000] w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-2xl backdrop-blur-sm transition-colors"
          aria-label="Previous image"
        >
          ←
        </button>
      )}

      {/* Right arrow */}
      {showNavigation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-[10000] w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-2xl backdrop-blur-sm transition-colors"
          aria-label="Next image"
        >
          →
        </button>
      )}

      {/* Image */}
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <img
          src={images[currentIndex]}
          alt={`Recipe image ${currentIndex + 1}`}
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }}
        />

        {/* Counter */}
        {showNavigation && (
          <div className="mt-4 text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(lightboxContent, document.body);
}
