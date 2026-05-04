'use client';

import { use, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCookingSession } from '@chefsbook/db';
import { generateChefBriefing } from '@chefsbook/ai';

function speakChef(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 1.0;
  window.speechSynthesis.speak(utt);
}

function BriefingContent({ menuId }: { menuId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasSpokeRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setError('No session found. Go back and set up again.');
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const session = await getCookingSession(sessionId!);
        if (!session) {
          setError('Session not found.');
          setLoading(false);
          return;
        }

        const text = await generateChefBriefing(session.plan);
        setBriefing(text);
        setLoading(false);

        if (!hasSpokeRef.current) {
          hasSpokeRef.current = true;
          // Small delay so browser voice list is ready
          setTimeout(() => speakChef(text), 400);
        }
      } catch (err) {
        console.error('Failed to generate briefing:', err);
        setError('Could not generate briefing. Please try again.');
        setLoading(false);
      }
    }

    load();
  }, [sessionId]);

  const handleStartCooking = () => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    router.push(`/dashboard/menus/${menuId}/cook/active?session=${sessionId}`);
  };

  const handleReplay = () => {
    if (briefing) speakChef(briefing);
  };

  return (
    <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center px-6 py-12">
      {/* Chef icon */}
      <div className="text-5xl mb-6">👨‍🍳</div>

      {loading && (
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white/60 text-sm">Briefing in progress...</p>
        </div>
      )}

      {error && (
        <div className="max-w-lg text-center">
          <p className="text-red-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push(`/dashboard/menus/${menuId}/cook`)}
            className="px-6 py-3 border border-white/30 text-white rounded-input text-sm hover:bg-white/10 transition"
          >
            Back to Setup
          </button>
        </div>
      )}

      {briefing && !loading && (
        <div className="max-w-xl w-full text-center">
          <p className="text-white text-xl font-medium leading-relaxed tracking-wide mb-10">
            {briefing}
          </p>

          {/* Replay */}
          <button
            onClick={handleReplay}
            className="mb-6 flex items-center gap-2 mx-auto text-white/50 hover:text-white/80 transition text-sm"
            aria-label="Replay briefing"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
            Replay
          </button>

          {/* Start cooking CTA */}
          <button
            onClick={handleStartCooking}
            className="w-full py-4 bg-cb-green text-white rounded-card text-lg font-bold hover:opacity-90 transition"
          >
            Start cooking
          </button>
        </div>
      )}
    </div>
  );
}

export default function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: menuId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#111] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <BriefingContent menuId={menuId} />
    </Suspense>
  );
}
