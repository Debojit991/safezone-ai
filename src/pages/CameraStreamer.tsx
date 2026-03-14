import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const CameraStreamer = () => {
  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [threatLevel, setThreatLevel] = useState('MONITORING');
  const [confidence, setConfidence] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [streamError, setStreamError] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [uptime, setUptime] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock
  useEffect(() => {
    const tick = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-GB'));
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    setStreamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsStreaming(true);

      // Start frame capture interval
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        const base64 = dataUrl.split(',')[1];

        const t0 = Date.now();
        try {
          const res = await fetch(`${BACKEND_URL}/analyze-frame`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: base64 }),
            signal: AbortSignal.timeout(3000),
          });

          if (res.ok) {
            const data = await res.json();
            const elapsed = Date.now() - t0;
            setLatencyMs(elapsed);
            setThreatLevel(data.threat_detected ? 'THREAT DETECTED' : 'MONITORING');
            setConfidence(Number((data.confidence_score * 100).toFixed(0)));
            setFramesAnalyzed(prev => prev + 1);
            setStreamError('');
          }
        } catch {
          // Silently ignore timeout / network errors
        }
      }, 300);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : 'Camera access denied');
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    setThreatLevel('MONITORING');
    setConfidence(0);
  };

  const formatUptime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const isThreat = threatLevel === 'THREAT DETECTED';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-mono select-none">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a0e1a] border-b border-white/10">
        <div className="flex items-center gap-3">
          {isStreaming && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#e24b4a] animate-pulse shadow-[0_0_8px_#e24b4a]" />
              <span className="text-[#e24b4a] text-xs font-bold tracking-wider">REC</span>
            </div>
          )}
          <span
            className="text-[11px] tracking-[0.2em] font-bold uppercase"
            style={{ color: '#1D9E75', textShadow: '0 0 12px rgba(29,158,117,0.4)' }}
          >
            SAFEZONE AI — CAMERA NODE
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-[#1D9E75] text-xs tracking-wider">{currentTime}</span>
          <span className="text-white/50 text-[10px] tracking-wider">UP {formatUptime(uptime)}</span>
          <span className="text-white/70 text-[10px] tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded">
            CAM-LIVE-01
          </span>
        </div>
      </div>

      {/* ── MAIN VIDEO AREA ── */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {/* Live Video */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover absolute inset-0"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />

        {/* Hidden Canvas for frame capture */}
        <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />

        {/* Overlay scanlines on video */}
        {isStreaming && (
          <>
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03] z-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
              }}
            />
            {/* Pulsing border on threat */}
            {isThreat && (
              <div className="absolute inset-0 border-[3px] border-[#e24b4a] pointer-events-none z-20 animate-pulse" />
            )}
            {/* Top-left overlay info */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
              <span className="text-[10px] tracking-wider text-white/60">
                RESOLUTION: 1280×720 | FPS: ~3.3
              </span>
              <span className="text-[10px] tracking-wider text-white/60">
                ENCODER: JPEG Q50 | TRANSPORT: HTTPS
              </span>
            </div>
          </>
        )}

        {/* Offline Card */}
        {!isStreaming && (
          <div className="flex flex-col items-center gap-6 bg-[#0a0e1a] border border-[#1a2535] rounded-xl p-10 z-10">
            <div className="w-20 h-20 rounded-full border-2 border-[#1D9E75]/30 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[#1D9E75] text-sm font-bold tracking-wider mb-1">CAMERA NODE OFFLINE</p>
              <p className="text-white/40 text-xs tracking-wider">Grant camera access to begin live streaming</p>
            </div>
            <button
              onClick={startCamera}
              className="px-8 py-3 bg-[#1D9E75] hover:bg-emerald-600 text-white font-bold text-sm tracking-wider rounded-lg transition-all shadow-[0_0_20px_rgba(29,158,117,0.3)] hover:shadow-[0_0_30px_rgba(29,158,117,0.5)]"
            >
              ▶ START CAMERA
            </button>
          </div>
        )}

        {/* Error display */}
        {streamError && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-[#e24b4a]/20 border border-[#e24b4a]/50 px-4 py-2 rounded">
            <span className="text-[#e24b4a] text-xs tracking-wider">{streamError}</span>
          </div>
        )}
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a0e1a] border-t border-white/10">
        {/* Streaming status */}
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <>
              <div className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse shadow-[0_0_6px_#1D9E75]" />
              <span className="text-[#1D9E75] text-[10px] tracking-widest font-bold">STREAMING TO CONSOLE</span>
            </>
          ) : (
            <span className="text-white/30 text-[10px] tracking-widest">OFFLINE</span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <span className="text-white/50 text-[10px] tracking-wider">
            FRAMES: <span className="text-white/80">{framesAnalyzed}</span>
          </span>
          <span className="text-white/50 text-[10px] tracking-wider">
            LATENCY: <span className="text-white/80">{latencyMs} MS</span>
          </span>

          {/* Threat badge */}
          <div
            className="flex items-center gap-2 px-3 py-1 rounded border text-[10px] tracking-widest font-bold"
            style={{
              color: isThreat ? '#e24b4a' : '#1D9E75',
              borderColor: isThreat ? 'rgba(226,75,74,0.4)' : 'rgba(29,158,117,0.3)',
              backgroundColor: isThreat ? 'rgba(226,75,74,0.1)' : 'rgba(29,158,117,0.1)',
              boxShadow: isThreat ? '0 0 12px rgba(226,75,74,0.2)' : '0 0 12px rgba(29,158,117,0.15)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: isThreat ? '#e24b4a' : '#1D9E75' }}
            />
            {threatLevel} {confidence > 0 && `— ${confidence}%`}
          </div>
        </div>

        {/* Stop button */}
        {isStreaming && (
          <button
            onClick={stopCamera}
            className="px-4 py-1.5 bg-[#e24b4a]/20 hover:bg-[#e24b4a]/40 border border-[#e24b4a]/40 text-[#e24b4a] text-[10px] tracking-widest font-bold rounded transition-colors"
          >
            ■ STOP
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraStreamer;
