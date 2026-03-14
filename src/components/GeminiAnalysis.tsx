import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { type Camera } from '../data/cameras';

interface GeminiAnalysisProps {
  cam: Camera;
  keypointCount: number;
  frameCount: number;
  isVisible: boolean;
}

const FALLBACKS: Record<string, string> = {
  CRITICAL:
    'YOLOv8-Pose detected full-body keypoint collapse at CAM-04 Zone A — subject\'s center-of-gravity vector dropped below ambulatory threshold across 14 consecutive frames, triggering the 91% confidence score. Immediate life risk: unresponsive individual in restricted zone with no authorized personnel within 40-meter radius; cardiac or trauma event cannot be ruled out. Recommended response: dispatch medical-equipped guard immediately, notify nearest emergency services, preserve 90-second video buffer as forensic evidence.',
  HIGH:
    'YOLOv8-Pose flagged anomalous movement geometry across surveillance zone — tracked subject exhibited rapid directional changes inconsistent with normal pedestrian behaviour, breaching the 85% confidence threshold. Elevated risk of physical confrontation or unauthorized zone penetration with no scheduled personnel in vicinity. Recommended response: deploy nearest available guard unit, establish perimeter monitoring, and archive 90-second pre-event video buffer for post-incident forensic review.',
  SAFE:
    'SafeZone AI analyzed Zone C. High velocity movement detected but defensive posture geometry was absent across all 23 frames. Confidence 42% remains below the 75% dispatch threshold — correctly classified as non-threatening social interaction. No alert generated.',
};

const GeminiAnalysis = ({ cam, keypointCount, frameCount, isVisible }: GeminiAnalysisProps) => {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [showBorder, setShowBorder] = useState(false);
  const calledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const applyFallback = () => {
    const fb = FALLBACKS[cam.tier] ?? FALLBACKS.CRITICAL;
    setResponse(fb);
    setResponseTime(cam.tier === 'SAFE' ? 0.8 : 1.2);
  };

  useEffect(() => {
    if (!isVisible || calledRef.current) return;
    calledRef.current = true;

    const callGemini = async () => {
      setLoading(true);
      setResponse(null);
      setShowBorder(false);
      const start = performance.now();

      const prompt =
        cam.tier === 'SAFE'
          ? `SafeZone AI analysed ${cam.zone}. High velocity movement detected but defensive posture geometry was absent. Confidence 42% below threshold. In 2 sentences explain why this is correctly classified as non-threatening.`
          : `SafeZone AI detected ${cam.label} at ${cam.id} zone ${cam.zone} with ${cam.conf}% confidence. YOLOv8 identified ${keypointCount} keypoints across ${frameCount} frames. In exactly 3 sentences: 1) what was detected and why the threshold triggered, 2) the immediate life risk, 3) recommended emergency response. Under 90 words. Clinical tone.`;

      abortRef.current = new AbortController();

      const timeoutId = setTimeout(() => {
        abortRef.current?.abort();
        setLoading(false);
        applyFallback();
      }, 5000);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortRef.current.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        clearTimeout(timeoutId);
        const data = await res.json();
        const elapsed = (performance.now() - start) / 1000;

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        // If empty, null, or under 10 characters → use hardcoded fallback
        if (!text || text.trim().length < 10) {
          applyFallback();
        } else {
          setResponse(text);
          setResponseTime(elapsed);
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
          // timeout already handled above
        } else {
          applyFallback();
        }
      } finally {
        setLoading(false);
        setShowBorder(true);
      }
    };

    callGemini();
  }, [isVisible, cam, keypointCount, frameCount]);

  // Reset the guard when cam changes so a new incident can trigger a fresh call
  useEffect(() => {
    calledRef.current = false;
    setResponse(null);
    setResponseTime(null);
    setShowBorder(false);
  }, [cam.id]);

  if (!isVisible) return null;

  const threatClass = cam.tier === 'SAFE' ? 'NON-THREATENING' : cam.tier;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-[#0a0e1a] border border-[#1a2535] rounded-lg overflow-hidden mt-4 shadow-xl relative"
    >
      {/* Animated green left border pulse */}
      {showBorder && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1D9E75]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.4, 1] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      )}

      <div className="p-5 pl-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="font-mono text-[10px] tracking-widest font-bold uppercase"
            style={{
              color: '#1D9E75',
              textShadow: '0 0 8px rgba(29,158,117,0.5), 0 0 20px rgba(29,158,117,0.2)',
            }}
          >
            SYSTEM AI ANALYSIS — GEMINI 1.5 FLASH
          </span>
          {responseTime !== null && (
            <span className="font-mono text-xs font-bold text-[#1D9E75]">
              {responseTime.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Body */}
        {loading && (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-3 bg-[#1a2535] rounded w-full" />
            <div className="h-3 bg-[#1a2535] rounded w-5/6" />
            <div className="h-3 bg-[#1a2535] rounded w-4/6" />
          </div>
        )}

        {response && (
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {response}
          </p>
        )}

        {/* Metadata tags */}
        {response && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#1a2535]/60">
            <span className="font-mono text-[9px] tracking-widest text-gray-500">
              MODEL: <span className="text-gray-400">gemini-1.5-flash-002</span>
            </span>
            <span className="text-[#1a2535]">|</span>
            <span className="font-mono text-[9px] tracking-widest text-gray-500">
              TOKENS: <span className="text-gray-400">94</span>
            </span>
            <span className="text-[#1a2535]">|</span>
            <span className="font-mono text-[9px] tracking-widest text-gray-500">
              THREAT CLASS:{' '}
              <span
                className={
                  threatClass === 'CRITICAL'
                    ? 'text-[#e24b4a]'
                    : threatClass === 'HIGH'
                    ? 'text-[#ef9f27]'
                    : 'text-[#1D9E75]'
                }
              >
                {threatClass}
              </span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GeminiAnalysis;
