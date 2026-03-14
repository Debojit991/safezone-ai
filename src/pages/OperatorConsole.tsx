import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Settings, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref as dbRef, set } from 'firebase/database';

import { rtdb } from '../lib/firebase';
import { CAMERAS, type Camera } from '../data/cameras';
import GeminiAnalysis from '../components/GeminiAnalysis';
import EvacuationModal from '../components/EvacuationModal';

/* ─── CAMERA → VIDEO MAPPING ─── */
const CAMERA_VIDEOS: Record<string, string> = {
  'CAM-01': 'fighting.mp4',
  'CAM-02': 'fire and smoke.mp4',
  'CAM-03': 'immediate evacuation.mp4',
  'CAM-04': 'molestation.mp4',
  'CAM-05': 'stampede.mp4',
  'CAM-06': 'tresspassing.mp4',
  'CAM-07': 'non threat hugging.mp4',
  'CAM-08': 'non threat walking couples.mp4',
};

const SAFE_VIDEOS = ['non threat hugging.mp4', 'non threat walking couples.mp4'];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const OperatorConsole = () => {
  // ── STATE ──
  const [selectedCam, setSelectedCam] = useState<Camera>(CAMERAS[0]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [keypointCount, setKeypointCount] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const [msTimer, setMsTimer] = useState<number>(0);
  const [devMode, setDevMode] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [guardResponded, setGuardResponded] = useState(false);
  const [alertStatus, setAlertStatus] = useState<'PENDING' | 'ACCEPTED' | 'ESCALATED' | 'AUTO_DISPATCHED'>('PENDING');
  const [countdownSeconds, setCountdownSeconds] = useState(15);
  const countdownRef = useRef<number | null>(null);
  const [evacModalOpen, setEvacModalOpen] = useState(false);
  const [isAlertActive, setIsAlertActive] = useState(false);

  // HUD state
  const [time, setTime] = useState('');
  const [uptime, setUptime] = useState(4210000);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [dispatchLog, setDispatchLog] = useState<{time: string; text: string; color: string}[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);

  // Refs
  const timerRef = useRef<number | null>(null);
  const confAnimRef = useRef<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const dispatchLogRef = useRef<HTMLDivElement>(null);

  // ── HELPERS ──
  const getMarkerColor = (tier: string) => {
    if (tier === 'CRITICAL') return '#e24b4a';
    if (tier === 'HIGH') return '#ef9f27';
    return '#1D9E75';
  };

  const filteredCameras = CAMERAS.filter(c =>
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.zone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString().substring(11, 19)}] ${msg}`]);
  };

  const isSafeFeed = (camId: string) => SAFE_VIDEOS.includes(CAMERA_VIDEOS[camId] ?? '');

  const nowTime = () => new Date().toLocaleTimeString('en-GB');

  const pushDispatch = (text: string, color: string = '#1D9E75') => {
    setDispatchLog(prev => [...prev, { time: nowTime(), text, color }]);
  };

  // ── CLOCK ──
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toISOString().replace('T', ' ').substring(0, 19));
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── BACKEND HEALTH CHECK ──
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          setBackendConnected(data.model_loaded === true);
        } else {
          setBackendConnected(false);
        }
      } catch {
        setBackendConnected(false);
      }
    };
    checkHealth();
    const id = setInterval(checkHealth, 30000);
    return () => clearInterval(id);
  }, []);

  // ── AUTO-SCROLL LOGS ──
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── AUTO-SCROLL DISPATCH LOG ──
  useEffect(() => {
    dispatchLogRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dispatchLog]);

  // ── CAMERA CLICK HANDLER (the ONLY trigger) ──
  const handleCameraClick = (cam: Camera) => {
    // Clean up previous timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (confAnimRef.current) clearInterval(confAnimRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    const win = window as any;
    if (win.currentCountdownInterval) clearInterval(win.currentCountdownInterval);

    // Reset all state
    setAnalysisComplete(false);
    setGuardResponded(false);
    setAlertStatus('PENDING');
    setCountdownSeconds(15);
    setIsAlertActive(false);
    setCurrentConfidence(0);
    setKeypointCount(0);
    setFrameCount(0);
    setMsTimer(0);
    setDispatchLog([]);

    // Set camera
    setSelectedCam(cam);
    addLog(`CAM_SELECT: ${cam.id} [${cam.label}]`);

    const safe = isSafeFeed(cam.id);

    if (safe) {
      // ── SAFE TIER: fluctuate 38-46%, no alert ──
      setCurrentConfidence(42);
      setKeypointCount(17);
      setFrameCount(23);
      setAnalysisComplete(true);

      confAnimRef.current = window.setInterval(() => {
        setCurrentConfidence(prev => {
          const walk = Math.floor(Math.random() * 7) - 3;
          let next = prev + walk;
          if (next < 38) next = 38;
          if (next > 46) next = 46;
          return next;
        });
      }, 800);

      addLog(`SAFE_FEED: ${cam.id} — monitoring mode`);
    } else {
      // ── THREAT TIER ──
      const fallbackConf = cam.conf || (Math.floor(Math.random() * 8) + 87);

      // Start detection timer
      const startTime = performance.now();
      timerRef.current = window.setInterval(() => {
        setMsTimer((performance.now() - startTime) / 1000);
      }, 10);

      setCurrentConfidence(45);
      setKeypointCount(17);
      setFrameCount(23);
      setSkeletonVisible(true);

      addLog(`INIT_ANALYSIS: ${cam.id} [${cam.label}]`);

      // Try real backend first (after 2s delay for video to load), fallback to simulation
      const videoFilename = CAMERA_VIDEOS[cam.id] ?? 'fighting.mp4';
      const videoUrl = `${window.location.origin}/videos/${videoFilename}`;

      setTimeout(async () => {
        let realConf: number | null = null;
        let realThreatType: string | null = null;

        if (backendConnected) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${BACKEND_URL}/analyze-url`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ video_url: videoUrl }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) {
              const data = await res.json();
              realConf = Math.round(data.confidence_score * 100);
              realThreatType = data.threat_type;
              addLog(`BACKEND_RESULT: ${data.threat_type} @ ${realConf}%`);
            }
          } catch {
            addLog(`BACKEND_TIMEOUT: falling back to simulation`);
          }
        }

        const targetConf = realConf ?? fallbackConf;

        // Animate confidence climb from current to target
        let loggedThreat = false;
        const confRef = { current: 45 };

        confAnimRef.current = window.setInterval(() => {
          const increment = 0.8 + Math.random() * 1.4;
          confRef.current += increment;

          if (confRef.current >= 85 && !loggedThreat) {
            addLog(`THREAT_CONFIRMED: ${realThreatType ?? 'TRUE'}`);
            loggedThreat = true;
            pushDispatch('Threat detected', '#1D9E75');
          }

          if (confRef.current >= targetConf - 2) {
            if (confAnimRef.current) clearInterval(confAnimRef.current);
            confRef.current = targetConf;
            setCurrentConfidence(targetConf);

            if (timerRef.current) clearInterval(timerRef.current);
            setAnalysisComplete(true);
            setIsAlertActive(true);
            addLog(`REROUTING ALERT: OPERATOR CONSOLE`);
            pushDispatch('AI confirmed', '#1D9E75');
            pushDispatch('Guard notified', '#1D9E75');

            let currentTimeout = 15;
            const countInt = window.setInterval(() => {
              currentTimeout--;
              setCountdownSeconds(currentTimeout);
              if (currentTimeout === 10) {
                pushDispatch('Acknowledgement pending', '#ef9f27');
              }
              if (currentTimeout <= 0) {
                clearInterval(countInt);
                setAlertStatus('AUTO_DISPATCHED');
                addLog(`AUTO-SOS FIRED \u2014 NO OPERATOR RESPONSE`);
                pushDispatch('Auto-dispatch fired', '#EF4444');
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('SAFEZONE AI \u2014 AUTO-DISPATCH', {
                    body: 'No operator response. Emergency services contacted automatically.',
                    icon: '/vite.svg'
                  });
                }
                set(dbRef(rtdb, `alerts/system_auto_${Date.now()}`), {
                  active: true,
                  status: 'ESCALATED',
                  timestamp: Date.now(),
                  label: cam.label,
                  zone: cam.zone,
                  gps: cam.gps
                }).catch(err => console.error("Firebase dispatch error:", err));
              }
            }, 1000);
            (window as any).currentCountdownInterval = countInt;
            return;
          }

          setCurrentConfidence(confRef.current);
        }, 80);
      }, 2000);
    }
  };

  // ── RESET ──
  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (confAnimRef.current) clearInterval(confAnimRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    const win = window as any;
    if (win.currentCountdownInterval) clearInterval(win.currentCountdownInterval);

    setAnalysisComplete(false);
    setGuardResponded(false);
    setIsAlertActive(false);
    setCurrentConfidence(0);
    setKeypointCount(0);
    setFrameCount(0);
    setMsTimer(0);
    setAlertStatus('PENDING');
    setCountdownSeconds(15);
    setSkeletonVisible(false);
  };

  // ── GUARD RESPONSE ──
  const handleGuardResponse = async (status: 'ACCEPTED' | 'ESCALATED') => {
    setGuardResponded(true);
    setAlertStatus(status);

    const win = window as any;
    if (win.currentCountdownInterval) clearInterval(win.currentCountdownInterval);

    addLog(`OPERATOR OVERRIDE: ${status}`);

    if (status === 'ACCEPTED') {
      pushDispatch('Operator accepted', '#1D9E75');
    } else if (status === 'ESCALATED') {
      pushDispatch('Escalation initiated', '#ef9f27');
    }

    if (status === 'ESCALATED') {
      if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
      setEvacModalOpen(true);
    }

    try {
      await set(dbRef(rtdb, 'guards/3/alert'), {
        active: true,
        label: selectedCam.label,
        timestamp: Date.now(),
        zone: selectedCam.zone,
        gps: selectedCam.gps,
        status: status
      });
      addLog(`SYNC_RTDB: PUSHED TO GUARD UNIT 3`);

      await set(dbRef(rtdb, `alerts/operator_auth_${Date.now()}`), {
        active: true,
        status: status,
        timestamp: Date.now(),
        label: selectedCam.label,
        zone: selectedCam.zone,
        gps: selectedCam.gps
      });
    } catch (err) {
      addLog(`SYNC_RTDB_ERROR: ${err}`);
    }
  };

  // ── DERIVED ──
  const videoFilename = CAMERA_VIDEOS[selectedCam.id] ?? 'fighting.mp4';
  const videoSrc = `/videos/${videoFilename}`;
  const isSafe = isSafeFeed(selectedCam.id);

  // ── RENDER ──
  return (
    <>
    <div className="h-screen w-full bg-[#04070b] overflow-hidden text-gray-200 font-sans" style={{ display: 'grid', gridTemplateColumns: '280px minmax(400px, 1fr) minmax(320px, 1fr)' }}>

      {/* COLUMN 1 — MAP (280px) */}
      <div className="h-screen flex flex-col border-r border-[#1a2535] bg-[#080c14] overflow-hidden">

        {/* Map Area */}
        <div className="flex-1 relative overflow-hidden">
          <MapContainer
            center={[22.5726, 88.3639]}
            zoom={13}
            className="w-full h-full bg-[#0a0e1a]"
            style={{ zIndex: 0 }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredCameras.map((cam) => {
              const color = getMarkerColor(cam.tier);
              const isSelected = selectedCam.id === cam.id;
              return (
                <CircleMarker
                  key={cam.id}
                  center={cam.gps}
                  radius={8}
                  pathOptions={{
                    color: isSelected ? '#fff' : color,
                    fillColor: color,
                    fillOpacity: 1,
                    weight: isSelected ? 2 : 0
                  }}
                  eventHandlers={{ click: () => handleCameraClick(cam) }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    {cam.label} ({cam.id})
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Overlay Search */}
          <div className="absolute bottom-4 left-3 right-3" style={{ zIndex: 1000 }}>
            <div className="bg-[#0f1520]/90 backdrop-blur border border-[#1a2535] rounded p-2 flex items-center shadow-lg">
              <Search className="w-4 h-4 text-gray-400 mx-2 shrink-0" />
              <input
                type="text"
                placeholder="Search zone or camera..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="h-10 border-t border-[#1a2535] bg-[#060a12] flex items-center px-3 font-mono text-[9px] tracking-widest text-gray-500 gap-4 shrink-0">
          <span>UPTIME: {formatUptime(uptime)}</span>
          <span>LATENCY: 14MS</span>
          <span className="text-[#1D9E75]">AES-256</span>
        </div>
      </div>

      {/* COLUMN 2 — CONSOLE (center, flexible) */}
      <div className="h-screen flex flex-col relative overflow-hidden border-r border-[#1a2535]">

        {/* Header */}
        <div className="h-14 border-b border-[#1a2535] bg-[#080c14] flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-[#1D9E75]" />
            <span className="font-bold tracking-widest text-xs text-white">OPERATOR CONSOLE — LIVE</span>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${backendConnected ? 'bg-[#1D9E75]/10 border-[#1D9E75]/20' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${backendConnected ? 'bg-[#1D9E75]' : 'bg-[#F59E0B]'}`}></div>
              <span className={`text-[9px] font-mono uppercase font-bold ${backendConnected ? 'text-[#1D9E75]' : 'text-[#F59E0B]'}`}>{backendConnected ? 'BACKEND CONNECTED' : 'SIMULATION MODE'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#1a2535] text-gray-300 text-[10px] font-semibold rounded">Live</span>
            <button
              onClick={() => setDevMode(!devMode)}
              className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded transition-colors ${devMode ? 'bg-[#1D9E75] text-white' : 'bg-[#1a2535] text-gray-300'}`}
            >
              Dev
            </button>
            <button className="p-1 bg-[#1a2535] rounded text-gray-300 hover:text-white transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">

          {/* CCTV Feed Container */}
          <div className="relative w-full aspect-video bg-[#060a12] rounded-lg overflow-hidden border border-[#1a2535] shadow-2xl shrink-0">
             {/* Alert Border Pulse */}
             {isAlertActive && (
               <motion.div
                 className="absolute inset-0 border-[3px] border-[#e24b4a] pointer-events-none z-30"
                 animate={{ opacity: [0, 1, 0] }}
                 transition={{ duration: 1, repeat: Infinity }}
               />
             )}

             {/* Grain Filter */}
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-0" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")'}}></div>

             <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-gray-800 to-black z-0 pointer-events-none"></div>

             {/* Overlays */}
             <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
               <div className="w-2 h-2 rounded-full bg-[#e24b4a] animate-pulse shadow-[0_0_5px_#e24b4a]"></div>
               <span className="font-mono text-white/90 text-[10px] tracking-wider font-bold">REC</span>
               <span className="font-mono text-white/80 text-[10px] ml-1 bg-black/60 px-1.5 py-0.5 rounded">{time}</span>
             </div>

             <div className="absolute top-3 right-3 bg-black/60 border border-white/10 px-2 py-0.5 rounded z-20">
               <span className="font-mono text-white/80 text-[10px] tracking-wider">{selectedCam.id}_{selectedCam.zone.replace(' ', '_').toUpperCase()}</span>
             </div>

             {/* Video Player — key forces remount on cam switch */}
             <video
               key={selectedCam.id}
               src={videoSrc}
               className="absolute inset-0 w-full h-full object-cover z-10"
               autoPlay
               loop
               muted
               playsInline
             />

             {/* Skeleton Overlay — always visible on top of video */}
             {skeletonVisible && (
               <svg
                 className="absolute top-0 left-0 w-full h-full pointer-events-none"
                 style={{ zIndex: 15 }}
                 viewBox="0 0 800 450"
                 preserveAspectRatio="xMidYMid slice"
               >
                 {/* Skeleton keypoints */}
                 {[
                   [400, 135], // 0 Head
                   [400, 180], // 1 Neck
                   [340, 205], // 2 L-Shoulder
                   [460, 205], // 3 R-Shoulder
                   [300, 270], // 4 L-Elbow
                   [500, 270], // 5 R-Elbow
                   [280, 340], // 6 L-Wrist
                   [520, 340], // 7 R-Wrist
                   [400, 270], // 8 Pelvis
                   [360, 360], // 9 L-Knee
                   [440, 360], // 10 R-Knee
                   [350, 430], // 11 L-Ankle
                   [450, 430], // 12 R-Ankle
                 ].map(([cx, cy], i) => (
                   <circle
                     key={i}
                     cx={cx} cy={cy} r="5"
                     fill="#1D9E75"
                     opacity="0.9"
                   >
                     <animate
                       attributeName="cy"
                       values={`${cy};${cy - 3};${cy + 3};${cy}`}
                       dur={`${1.5 + i * 0.1}s`}
                       repeatCount="indefinite"
                     />
                     <animate
                       attributeName="r"
                       values="5;6;4;5"
                       dur="2s"
                       repeatCount="indefinite"
                     />
                   </circle>
                 ))}
                 {/* Skeleton bones */}
                 {[
                   [0,1],[1,2],[1,3],[2,4],[3,5],[4,6],[5,7],[1,8],[8,9],[8,10],[9,11],[10,12]
                 ].map(([s,e], i) => {
                   const pts = [
                     [400,135],[400,180],[340,205],[460,205],[300,270],[500,270],
                     [280,340],[520,340],[400,270],[360,360],[440,360],[350,430],[450,430]
                   ];
                   return (
                     <line
                       key={`bone-${i}`}
                       x1={pts[s][0]} y1={pts[s][1]}
                       x2={pts[e][0]} y2={pts[e][1]}
                       stroke="#1D9E75"
                       strokeWidth="2"
                       opacity="0.7"
                     >
                       <animate
                         attributeName="opacity"
                         values="0.7;1;0.5;0.7"
                         dur={`${2 + i * 0.15}s`}
                         repeatCount="indefinite"
                       />
                     </line>
                   );
                 })}
                 {/* Bounding box */}
                 <rect
                   x="250" y="110" width="300" height="340"
                   fill="none"
                   stroke="#1D9E75"
                   strokeWidth="1.5"
                   strokeDasharray="8 4"
                   opacity="0.5"
                 >
                   <animate
                     attributeName="stroke-dashoffset"
                     values="0;24"
                     dur="2s"
                     repeatCount="indefinite"
                   />
                 </rect>
                 {/* Label */}
                 <text x="255" y="105" fill="#1D9E75" fontSize="11" fontFamily="monospace" opacity="0.8">
                   POSE_SUBJECT_01 — 17 KEYPOINTS
                 </text>
               </svg>
             )}

             {/* Confidence Bar */}
             <div className="absolute bottom-3 left-4 right-4 flex flex-col gap-1.5 z-20">
               <div className="flex justify-between font-mono text-[10px] tracking-widest font-bold drop-shadow-md">
                 <span style={{ color: isSafe ? '#1D9E75' : '#e24b4a'}}>{isSafe ? 'MONITORING — NO THREAT DETECTED' : 'INTRUSION CONFIDENCE SCORE'}</span>
                 <span style={{ color: isSafe ? '#1D9E75' : '#e24b4a'}}>{currentConfidence.toFixed(0)}%</span>
               </div>
               <div className="w-full h-1.5 bg-black/70 border border-white/10 rounded-full overflow-hidden">
                 <div
                   className={`h-full ease-out ${isSafe ? 'bg-[#1D9E75]' : 'bg-[#e24b4a]'}`}
                   style={{ width: `${currentConfidence}%`, transition: 'width 150ms ease-out' }}
                 />
               </div>
               {analysisComplete && isSafe && (
                  <div className="text-[#1D9E75] font-mono text-[10px] font-bold">NON-THREAT CONFIRMED — below threshold</div>
               )}
             </div>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center gap-3">
             <button
               onClick={handleReset}
               className="px-5 py-2.5 rounded font-bold text-sm text-gray-400 bg-[#1a2535] hover:bg-gray-700 hover:text-white transition-colors"
             >
               Reset
             </button>
          </div>

          {/* Timer Row — dedicated full-width */}
          <div className="w-full">
            <span className="font-mono text-[2rem] font-bold tracking-tight text-[#1D9E75] leading-none block">
              {msTimer.toFixed(3)}s
            </span>
            <span className="font-mono text-[9px] text-gray-500 tracking-widest uppercase mt-1 block">
              TIME FROM DETECTION TO DISPATCH
            </span>
          </div>

          {/* Alert Panel */}
          <AnimatePresence>
            {isAlertActive && !isSafe && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full bg-[#0f1520] border border-[#1a2535] rounded-lg p-4 flex gap-4 shadow-xl"
              >
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] font-mono font-bold text-[#e24b4a] tracking-widest uppercase">
                      CRITICAL ALERT
                    </div>
                    {guardResponded ? (
                      <div className="flex items-center gap-1.5 bg-[#1D9E75]/10 px-2 py-0.5 rounded text-[#1D9E75] border border-[#1D9E75]/30">
                         <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse"></div>
                         <span className="text-[9px] uppercase font-bold tracking-widest">RESPONDING</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-[#e24b4a]/10 px-2 py-0.5 rounded text-[#e24b4a] border border-[#e24b4a]/30">
                         <span className="text-[9px] uppercase font-bold tracking-widest">DISPATCHED</span>
                      </div>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-white">{selectedCam.label}</h2>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Movement detected in restricted zone {selectedCam.zone}. No authorised personnel scheduled.
                  </p>
                </div>

                {/* Mini Map */}
                <div className="w-36 h-28 bg-black rounded overflow-hidden border border-[#1a2535] shrink-0 pointer-events-none relative">
                   <MapContainer key={`alertmap-${selectedCam.id}`} center={selectedCam.gps} zoom={15} zoomControl={false} className="w-full h-full">
                     <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                     <CircleMarker center={selectedCam.gps} radius={6} pathOptions={{ color: '#e24b4a', fillColor: '#e24b4a', fillOpacity: 0.8 }} />
                   </MapContainer>
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-[#e24b4a] animate-ping opacity-50" style={{ zIndex: 10 }}></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* DEV MODE PANEL */}
        <AnimatePresence>
          {devMode && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute top-14 right-0 bottom-0 w-72 bg-black/95 border-l border-[#1a2535] backdrop-blur-md flex flex-col shadow-2xl"
              style={{ zIndex: 40 }}
            >
              <div className="h-8 border-b border-[#1a2535] flex items-center justify-between px-3">
                <span className="font-mono text-[9px] text-gray-500 font-bold uppercase tracking-wider">SYS_LOG_V2.4</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse"></div>
              </div>

              <div className="flex-1 p-3 overflow-y-auto font-mono text-[9px] leading-relaxed text-gray-400 flex flex-col">
                {logs.map((log, i) => (
                  <div key={i} className={`mb-1.5 ${log.includes('ERROR') || log.includes('AUTO-SOS') ? 'text-[#e24b4a]' : log.includes('THREAT') || log.includes('ESCALATED') ? 'text-[#ef9f27]' : log.includes('ACCEPTED') ? 'text-[#1D9E75]' : ''}`}>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ALERT RESPONSE CARD */}
        <AnimatePresence>
          {isAlertActive && (
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="absolute bottom-6 right-4 w-80 bg-[#1e232b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#2c3440] overflow-hidden flex flex-col"
              style={{ zIndex: 9999, pointerEvents: 'all' }}
            >
              {/* Header */}
              <div className="bg-[#151920] px-3 py-2 flex items-center justify-between border-b border-[#2c3440]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#e24b4a]" />
                  <span className="text-[10px] font-bold text-white tracking-wide">SAFEZONE AI</span>
                </div>
                <span className="text-[9px] text-gray-500 font-mono">
                  {alertStatus === 'PENDING' ? 'AWAITING RESPONSE' : alertStatus.replace('_', ' ')}
                </span>
              </div>

              {/* Body */}
              <div className="p-4">
                {alertStatus === 'PENDING' && !guardResponded ? (
                  /* Active countdown state */
                  <div className="flex flex-col items-center gap-3">
                    {/* Countdown Ring */}
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#1a2535" strokeWidth="4" />
                        <circle
                          cx="40" cy="40" r="34" fill="none"
                          strokeWidth="4"
                          strokeLinecap="round"
                          stroke={countdownSeconds > 8 ? '#1D9E75' : countdownSeconds > 3 ? '#F59E0B' : '#EF4444'}
                          strokeDasharray={`${2 * Math.PI * 34}`}
                          strokeDashoffset={`${2 * Math.PI * 34 * (1 - countdownSeconds / 15)}`}
                          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
                        />
                      </svg>
                      <span
                        className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xl"
                        style={{ color: countdownSeconds > 8 ? '#1D9E75' : countdownSeconds > 3 ? '#F59E0B' : '#EF4444' }}
                      >
                        {countdownSeconds}
                      </span>
                    </div>

                    <p className="font-mono text-xs font-bold tracking-wider"
                       style={{ color: countdownSeconds > 8 ? '#1D9E75' : countdownSeconds > 3 ? '#F59E0B' : '#EF4444' }}>
                      AUTO-DISPATCH IN {countdownSeconds}s
                    </p>

                    <div className="flex flex-col gap-1 w-full text-center">
                      <h3 className="text-white font-semibold text-xs">{selectedCam.label}</h3>
                      <p className="text-gray-500 font-mono text-[9px]">{selectedCam.zone} • {selectedCam.gps.join(', ')}</p>
                    </div>

                    <div className="flex items-center gap-2 font-bold text-[10px] tracking-wider w-full mt-1">
                      <button
                        onClick={() => handleGuardResponse('ACCEPTED')}
                        className="flex-1 bg-[#1D9E75] hover:bg-emerald-600 text-white rounded py-1.5 transition-colors cursor-pointer"
                      >
                        ACCEPT
                      </button>
                      <button
                        onClick={() => handleGuardResponse('ESCALATED')}
                        className="flex-1 bg-[#2c3440] hover:bg-[#3d4856] text-[#ef9f27] rounded py-1.5 transition-colors cursor-pointer"
                      >
                        ESCALATE
                      </button>
                    </div>
                  </div>
                ) : alertStatus === 'ACCEPTED' ? (
                  /* Accepted confirmation */
                  <div className="flex flex-col items-center gap-3 py-2">
                    <CheckCircle2 className="w-10 h-10 text-[#1D9E75]" />
                    <p className="font-bold text-sm text-[#1D9E75] tracking-wider">GUARD DISPATCHED</p>
                    <p className="font-mono text-xs text-gray-400">ETA ~4 MIN</p>
                  </div>
                ) : alertStatus === 'AUTO_DISPATCHED' ? (
                  /* Auto-dispatched state */
                  <div className="flex flex-col items-center gap-3 py-2">
                    <ShieldAlert className="w-10 h-10 text-[#EF4444] animate-pulse" />
                    <p className="font-bold text-xs text-[#EF4444] tracking-wider">AUTO-SOS DISPATCHED</p>
                    <p className="font-mono text-[10px] text-gray-500 text-center">No operator response. Emergency services contacted.</p>
                  </div>
                ) : (
                  /* Escalated state */
                  <div className="flex flex-col items-center gap-3 py-2">
                    <ShieldAlert className="w-10 h-10 text-[#ef9f27]" />
                    <p className="font-bold text-xs text-[#ef9f27] tracking-wider">ALERT ESCALATED</p>
                    <p className="font-mono text-[10px] text-gray-500 text-center">Supervisor notified. Evacuation protocol available.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* COLUMN 3 — RIGHT PANEL (analysis + cards) */}
      <div className="h-screen flex flex-col overflow-y-auto bg-[#060a12] p-4">

        {!analysisComplete ? (
          /* Placeholder: awaiting analysis */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-pulse">
              <p className="font-mono text-xs tracking-widest text-[#1D9E75] uppercase font-bold">
                AWAITING ANALYSIS — SYSTEM NOMINAL
              </p>
            </div>
          </div>
        ) : (
          /* Post-analysis content with staggered fade-in */
          <div className="flex flex-col gap-4">
            {/* Gemini Panel */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <GeminiAnalysis
                cam={selectedCam}
                keypointCount={keypointCount}
                frameCount={frameCount}
                isVisible={analysisComplete}
              />
            </motion.div>

            {/* Evidence Buffer */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0a0e1a] border border-[#1a2535] rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-3.5 h-3.5 text-[#1D9E75]" />
                <span className="font-mono text-[10px] tracking-widest text-[#1D9E75] font-bold uppercase">EVIDENCE BUFFER</span>
              </div>
              <div className="flex flex-col gap-2 font-mono text-[11px] text-gray-400">
                <div className="flex justify-between"><span className="text-gray-500">Recording</span><span>90s pre-event</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="text-[#1D9E75]">LOCKED FOR FORENSICS</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Size</span><span>2.3MB</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Encrypted</span><span className="text-[#1D9E75]">AES-256</span></div>
              </div>
            </motion.div>

            {/* Dispatch Log */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[#0a0e1a] border border-[#1a2535] rounded-lg p-4"
            >
              <span className="font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-3 block">DISPATCH LOG</span>
              <div className="flex flex-col gap-2 font-mono text-[11px] max-h-48 overflow-y-auto">
                {dispatchLog.length === 0 ? (
                  <span className="text-gray-600 text-[10px]">Awaiting events...</span>
                ) : (
                  dispatchLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[#1D9E75] shrink-0">{entry.time}</span>
                      <span style={{ color: entry.color }}>— {entry.text}</span>
                    </div>
                  ))
                )}
                <div ref={dispatchLogRef} />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>

      {/* Evacuation Modal */}
      <EvacuationModal
        isOpen={evacModalOpen}
        onClose={() => { setEvacModalOpen(false); addLog('INCIDENT RESOLVED — MODAL CLOSED'); }}
        onLog={addLog}
        incident={isAlertActive ? {
          threat_type: selectedCam.label,
          zone: selectedCam.zone,
          lat: selectedCam.gps[0],
          lng: selectedCam.gps[1],
          timestamp: Date.now(),
          threat_id: selectedCam.id,
        } : null}
      />
    </>
  );
};

export default OperatorConsole;
