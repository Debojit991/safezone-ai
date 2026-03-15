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
  'CAM-04': 'fighting.mp4',
  'CAM-11': 'molestation.mp4',
  'CAM-23': 'immediate evacuation.mp4',
  'CAM-07': 'fire and smoke.mp4',
  'CAM-31': 'stampede.mp4',
  'CAM-02': 'tresspassing.mp4',
  'CAM-18': 'immediate evacuation.mp4',
  'CAM-19': 'fire and smoke.mp4',
  'CAM-09': 'non threat walking couples.mp4',
};

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
  const [evacModalOpen, setEvacModalOpen] = useState(false);
  const [isAlertActive, setIsAlertActive] = useState(false);

  // HUD state
  const [time, setTime] = useState('');
  const [uptime, setUptime] = useState(4210000);
  const [searchQuery, setSearchQuery] = useState('');
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [skeletonOffsets, setSkeletonOffsets] = useState<{dx: number; dy: number}[]>(
    Array.from({ length: 13 }, () => ({ dx: 0, dy: 0 }))
  );
  const [realKeypointPositions, setRealKeypointPositions] = useState<{x: number; y: number; confidence: number}[]>([]);
  const [dispatchLog, setDispatchLog] = useState<{time: string; text: string; color: string}[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);

  // ── CONFIDENCE SYSTEM (rewritten) ──
  const [confidenceDisplay, setConfidenceDisplay] = useState(0);
  const [, setAlertTriggered] = useState(false);
  const confidenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetConfRef = useRef<number>(90);
  const loggedThreatRef = useRef(false);

  // Other Refs
  const timerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const dispatchLogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const precomputedRef = useRef<{ frame_time: number; keypoints: { x: number; y: number; confidence: number }[] }[]>([]);
  const skeletonSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const livePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live camera state
  const [liveFrameSrc, setLiveFrameSrc] = useState('');
  const [liveCameraActive, setLiveCameraActive] = useState(false);
  const [fireDetected, setFireDetected] = useState(false);
  const [liveCamOverride, setLiveCamOverride] = useState<Partial<Camera> | null>(null);
  const liveTimerStartedRef = useRef(false);

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

  const isSafeFeed = (cam: Camera) => cam.tier === 'SAFE';

  const getVideoKeyfileName = (videoFilename: string): string => {
    if (videoFilename === 'molestation.mp4') return 'fighting_keypoints.json';
    return videoFilename.replace(/ /g, '_').replace(/\.mp4$/i, '') + '_keypoints.json';
  };

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
        const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(8000) });
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

  // ── CLEANUP: prevent memory leaks ──
  useEffect(() => {
    return () => {
      if (confidenceIntervalRef.current) clearInterval(confidenceIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (skeletonSyncRef.current) clearInterval(skeletonSyncRef.current);
      if (livePollingRef.current) clearInterval(livePollingRef.current);
    };
  }, []);

  // Stale frame detection — if liveFrameSrc hasn't updated in 8s, clear it
  const lastFrameTimestampRef = useRef<number>(0);
  useEffect(() => {
    if (!liveFrameSrc) return;
    lastFrameTimestampRef.current = Date.now();
    const check = setTimeout(() => {
      if (liveFrameSrc && Date.now() - lastFrameTimestampRef.current >= 8000) {
        setLiveFrameSrc('');
      }
    }, 8100);
    return () => clearTimeout(check);
  }, [liveFrameSrc]);

  // Poll backend to detect if live camera is active
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/live-keypoints`, {
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) { setLiveCameraActive(false); return; }
        const data = await res.json();
        console.log('LIVE-KEYPOINTS RESPONSE:', JSON.stringify(data).substring(0, 200));
        const hasFrame = data && typeof data === 'object' && !data.message && Object.keys(data).length > 2;
        setLiveCameraActive(hasFrame);
      } catch {
        setLiveCameraActive(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── SKELETON ANIMATION ──
  useEffect(() => {
    if (!skeletonVisible) {
      setSkeletonOffsets(Array.from({ length: 13 }, () => ({ dx: 0, dy: 0 })));
      return;
    }
    const id = setInterval(() => {
      setSkeletonOffsets(prev => prev.map(p => {
        let ndx = p.dx + (Math.random() * 12 - 6);
        let ndy = p.dy + (Math.random() * 12 - 6);
        if (ndx > 20) ndx = 20;
        if (ndx < -20) ndx = -20;
        if (ndy > 20) ndy = 20;
        if (ndy < -20) ndy = -20;
        return { dx: ndx, dy: ndy };
      }));
    }, 200);
    return () => clearInterval(id);
  }, [skeletonVisible]);

  // ── CAMERA CLICK HANDLER (the ONLY trigger) ──
  const handleCameraClick = (cam: Camera) => {
    // 1. Clear any existing confidence interval
    if (confidenceIntervalRef.current) {
      clearInterval(confidenceIntervalRef.current);
      confidenceIntervalRef.current = null;
    }
    // Clear other timers
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    if (skeletonSyncRef.current) { clearInterval(skeletonSyncRef.current); skeletonSyncRef.current = null; }
    if (livePollingRef.current) { clearInterval(livePollingRef.current); livePollingRef.current = null; }
    precomputedRef.current = [];
    setLiveFrameSrc('');

    // ── CAM-LIVE SPECIAL BRANCH ──
    if (cam.id === 'CAM-LIVE') {
      setAlertTriggered(false);
      setAnalysisComplete(false);
      setGuardResponded(false);
      setAlertStatus('PENDING');
      setCountdownSeconds(15);
      setIsAlertActive(false);
      setKeypointCount(0);
      setFrameCount(0);
      setMsTimer(0);
      setDispatchLog([]);
      setSkeletonVisible(false);
      setRealKeypointPositions([]);
      setLiveFrameSrc('');
      loggedThreatRef.current = false;
      liveTimerStartedRef.current = false;
      setConfidenceDisplay(0);
      setLiveCamOverride(null);
      setSelectedCam(cam);
      addLog(`CAM_SELECT: ${cam.id} [${cam.label}]`);

      // Start live polling interval — do NOT start timer/skeleton until feed arrives
      let feedStarted = false;
      livePollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/live-keypoints`, {
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return;
          const data = await res.json();

          // If backend says no frames analyzed, clear stale frame
          if (data.message === 'no frames analyzed yet') {
            setLiveFrameSrc('');
            return;
          }

          // First time we get real frame data — activate skeleton
          if (!feedStarted && data.frame_base64 && data.frame_base64.length > 0) {
            feedStarted = true;
            setSkeletonVisible(true);
            // Do NOT start timer here — only start on confirmed threat
          }

          // Update live frame image
          if (data.frame_base64) {
            setLiveFrameSrc(`data:image/jpeg;base64,${data.frame_base64}`);
          }

          // Update keypoints
          if (data.persons && data.persons.length > 0) {
            const kps = data.persons[0].keypoints_normalized;
            if (Array.isArray(kps) && kps.length === 17) {
              setRealKeypointPositions(kps);
            }
          }

          // Update confidence
          if (typeof data.confidence_score === 'number') {
            setConfidenceDisplay(data.confidence_score * 100);
          }

          // Update keypoint/frame counts
          if (data.detected_persons) {
            setKeypointCount(17);
            setFrameCount(prev => prev + 1);
          }

          // ── Unified threat / fire detection ──
          const isThreat = data.threat_detected
            && data.threat_type !== 'SAFE'
            && data.threat_type !== 'UNKNOWN'
            && data.threat_type !== 'GENERAL_THREAT'
            && data.confidence_score > 0.80;
          const isFireExplicit = data.fire_detected === true;

          // Set fire badge state
          if (isFireExplicit) {
            setFireDetected(true);
          } else {
            setFireDetected(false);
          }

          if ((isThreat || isFireExplicit) && !loggedThreatRef.current) {
            loggedThreatRef.current = true;
            setIsAlertActive(true);
            setAnalysisComplete(true);

            // Per-threat liveCamOverride for Gemini panel
            if (data.threat_type === 'FIGHTING') {
              setConfidenceDisplay(88);
              setLiveCamOverride({ conf: 88, label: 'Physical Assault' });
              addLog(`LIVE_THREAT: FIGHTING @ 88%`);
              pushDispatch('Fighting detected — dispatch guards', '#e24b4a');
            } else if (data.threat_type === 'PERSON_COLLAPSE') {
              setConfidenceDisplay(91);
              setLiveCamOverride({ conf: 91, label: 'Person Collapse' });
              addLog(`LIVE_THREAT: PERSON_COLLAPSE @ 91%`);
              pushDispatch('Person collapsed — dispatch medical', '#e24b4a');
            } else if (data.threat_type === 'FIRE_DETECTED' || isFireExplicit) {
              setConfidenceDisplay(94);
              setLiveCamOverride({ conf: 94, label: 'Fire Hazard' });
              addLog(`FIRE_DETECTED: fire=${data.fire_detected} smoke=${data.smoke_detected}`);
              pushDispatch('Fire detected — auto-dispatch', '#ef9f27');
            } else {
              setConfidenceDisplay(Math.round(data.confidence_score * 100));
              setLiveCamOverride({ conf: Math.round(data.confidence_score * 100), label: data.threat_type });
              addLog(`LIVE_THREAT: ${data.threat_type} @ ${Math.round(data.confidence_score * 100)}%`);
              pushDispatch('Threat detected', '#e24b4a');
            }

            // Start timer on first confirmed threat
            if (!liveTimerStartedRef.current) {
              liveTimerStartedRef.current = true;
              const startTime = performance.now();
              timerRef.current = window.setInterval(() => {
                setMsTimer((performance.now() - startTime) / 1000);
              }, 10);
            }

            // Start 15-second countdown
            countdownIntervalRef.current = setInterval(() => {
              setCountdownSeconds(prev => {
                if (prev <= 1) {
                  if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }
        } catch {
          // Silently ignore network errors
        }
      }, 3000);

      return; // Skip normal camera logic
    }

    // 2. Reset state
    setAlertTriggered(false);
    setAnalysisComplete(false);
    setGuardResponded(false);
    setAlertStatus('PENDING');
    setCountdownSeconds(15);
    setIsAlertActive(false);
    setKeypointCount(0);
    setFrameCount(0);
    setMsTimer(0);
    setDispatchLog([]);
    setSkeletonVisible(false);
    setRealKeypointPositions([]);
    loggedThreatRef.current = false;

    // 3. Set confidenceDisplay to 45
    setConfidenceDisplay(45);

    // 4. Set the active camera
    setSelectedCam(cam);
    addLog(`CAM_SELECT: ${cam.id} [${cam.label}]`);

    const safe = isSafeFeed(cam);

    if (safe) {
      // ── SAFE CAMERA: float confidence between 38-44 ──
      setConfidenceDisplay(41);
      setKeypointCount(17);
      setFrameCount(23);
      setAnalysisComplete(true);
      addLog(`SAFE_FEED: ${cam.id} \u2014 monitoring mode`);

      confidenceIntervalRef.current = setInterval(() => {
        setConfidenceDisplay(prev => {
          const walk = (Math.random() * 3) - 1.5; // -1.5 to +1.5
          let next = prev + walk;
          if (next < 38) next = 38;
          if (next > 44) next = 44;
          return next;
        });
      }, 800);
    } else {
      // ── THREAT CAMERA ──
      const target = cam.conf || (Math.floor(Math.random() * 8) + 87);
      targetConfRef.current = target;

      // Start detection timer
      const startTime = performance.now();
      timerRef.current = window.setInterval(() => {
        setMsTimer((performance.now() - startTime) / 1000);
      }, 10);

      setKeypointCount(17);
      setFrameCount(23);
      setSkeletonVisible(true);
      addLog(`INIT_ANALYSIS: ${cam.id} [${cam.label}]`);

      // Fetch pre-computed keypoints JSON for this video
      const vfn = CAMERA_VIDEOS[cam.id] ?? 'fighting.mp4';
      fetch(`/fallbacks/${getVideoKeyfileName(vfn)}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => { precomputedRef.current = Array.isArray(data) ? data : []; })
        .catch(() => { precomputedRef.current = []; });

      // Try real backend analysis (non-blocking)
      if (backendConnected) {
        const fullVideoUrl = `${window.location.origin}/videos/${CAMERA_VIDEOS[cam.id] ?? 'fighting.mp4'}`;
        fetch(`${BACKEND_URL}/analyze-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_url: fullVideoUrl }),
          signal: AbortSignal.timeout(3000),
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              addLog(`BACKEND_RESULT: ${data.threat_type} @ ${Math.round(data.confidence_score * 100)}%`);
              // Store real keypoints from first detected person
              if (data.persons && data.persons.length > 0) {
                const kps = data.persons[0].keypoints_normalized;
                if (Array.isArray(kps) && kps.length === 17) {
                  setRealKeypointPositions(kps.map((k: {x: number; y: number; confidence: number}) => ({
                    x: k.x,
                    y: k.y,
                    confidence: k.confidence,
                  })));
                  addLog(`KEYPOINTS_LOADED: 17 real keypoints from backend`);
                }
              }
            }
          })
          .catch(() => {
            addLog(`BACKEND_TIMEOUT: falling back to simulation`);
          });
      }

      // 5. After 500ms delay, start the 80ms confidence climb interval
      setTimeout(() => {
        // Start skeleton sync interval (100ms)
        skeletonSyncRef.current = setInterval(() => {
          if (precomputedRef.current.length === 0 || !videoRef.current) return;
          const currentTime = videoRef.current.currentTime;
          let closest = precomputedRef.current[0];
          let minDiff = Math.abs(closest.frame_time - currentTime);
          for (let i = 1; i < precomputedRef.current.length; i++) {
            const diff = Math.abs(precomputedRef.current[i].frame_time - currentTime);
            if (diff < minDiff) {
              minDiff = diff;
              closest = precomputedRef.current[i];
            }
          }
          if (closest.keypoints && closest.keypoints.length === 17) {
            setRealKeypointPositions(closest.keypoints);
          }
        }, 100);

        confidenceIntervalRef.current = setInterval(() => {
          setConfidenceDisplay(prev => {
            const increment = Math.random() * 1.4 + 0.8; // 0.8 to 2.2
            const next = prev + increment;

            // Log when passing 85%
            if (next >= 85 && !loggedThreatRef.current) {
              loggedThreatRef.current = true;
              addLog(`THREAT_CONFIRMED: TRUE`);
              pushDispatch('Threat detected', '#1D9E75');
            }

            // Snap when within 2% of target
            if (next >= targetConfRef.current - 2) {
              // Clear this interval
              if (confidenceIntervalRef.current) {
                clearInterval(confidenceIntervalRef.current);
                confidenceIntervalRef.current = null;
              }

              // Snap to exact target
              const final = targetConfRef.current;

              // Stop ms timer
              if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

              // Trigger alert
              setAlertTriggered(true);
              setAnalysisComplete(true);
              setIsAlertActive(true);
              addLog(`REROUTING ALERT: OPERATOR CONSOLE`);
              pushDispatch('AI confirmed', '#1D9E75');
              pushDispatch('Guard notified', '#1D9E75');

              // Start 15s countdown
              let currentTimeout = 15;
              countdownIntervalRef.current = setInterval(() => {
                currentTimeout--;
                setCountdownSeconds(currentTimeout);
                if (currentTimeout === 10) {
                  pushDispatch('Acknowledgement pending', '#ef9f27');
                }
                if (currentTimeout <= 0) {
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
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
                  }).catch(err => console.error('Firebase dispatch error:', err));
                }
              }, 1000);

              return final; // snap to exact target
            }

            return next;
          });
        }, 80);
      }, 500);
    }
  };

  // ── RESET ──
  const handleReset = () => {
    if (confidenceIntervalRef.current) { clearInterval(confidenceIntervalRef.current); confidenceIntervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    if (livePollingRef.current) { clearInterval(livePollingRef.current); livePollingRef.current = null; }

    setAnalysisComplete(false);
    setGuardResponded(false);
    setIsAlertActive(false);
    setConfidenceDisplay(0);
    setAlertTriggered(false);
    setKeypointCount(0);
    setFrameCount(0);
    setMsTimer(0);
    setAlertStatus('PENDING');
    setCountdownSeconds(15);
    setSkeletonVisible(false);
    setDispatchLog([]);
    setRealKeypointPositions([]);
    setLiveFrameSrc('');
    setFireDetected(false);
    setLiveCamOverride(null);
    liveTimerStartedRef.current = false;
    if (skeletonSyncRef.current) { clearInterval(skeletonSyncRef.current); skeletonSyncRef.current = null; }
    precomputedRef.current = [];
    loggedThreatRef.current = false;
  };

  // ── GUARD RESPONSE ──
  const handleGuardResponse = async (status: 'ACCEPTED' | 'ESCALATED') => {
    setGuardResponded(true);
    setAlertStatus(status);

    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }

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
  const isSafe = isSafeFeed(selectedCam);

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
            {/* Live camera marker — only when camera is actively streaming */}
            {liveCameraActive && (
              <CircleMarker
                center={[22.5726, 88.3639]}
                radius={10}
                pathOptions={{
                  color: '#1D9E75',
                  fillColor: '#1D9E75',
                  fillOpacity: 0.8,
                  weight: 2,
                }}
                eventHandlers={{ click: () => handleCameraClick({
                  id: 'CAM-LIVE', label: 'Live Camera Feed', zone: 'Zone LIVE',
                  gps: [22.5726, 88.3639], tier: 'CRITICAL', clip: 'live', conf: 0, time: 0
                } as Camera) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  LIVE FEED ACTIVE
                </Tooltip>
              </CircleMarker>
            )}
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

             {/* Video Player / Live Frame — key forces remount on cam switch */}
             {selectedCam.id === 'CAM-LIVE' ? (
               <div className="absolute inset-0 w-full h-full z-10 bg-black flex items-center justify-center">
                 {liveFrameSrc ? (
                   <img
                     key="live-frame"
                     src={liveFrameSrc}
                     alt="Live camera feed"
                     className="w-full h-full object-cover"
                   />
                 ) : (
                   <div className="text-center">
                     <div className="w-3 h-3 rounded-full bg-[#1D9E75] animate-pulse mx-auto mb-2" />
                     <span className="font-mono text-[10px] tracking-widest text-[#1D9E75]">FEED INTERRUPTED — RECONNECTING…</span>
                   </div>
                 )}
                 {/* Fire detection badge */}
                 {fireDetected && (
                   <div className="absolute top-10 left-3 z-30 flex items-center gap-1.5 px-2 py-1 rounded border border-orange-500 animate-pulse"
                     style={{ background: 'rgba(255,100,0,0.2)' }}
                   >
                     <span className="font-mono font-bold text-[11px] tracking-wider" style={{ color: '#ff6400' }}>🔥 FIRE DETECTED</span>
                   </div>
                 )}
               </div>
             ) : (
               <video
                 ref={videoRef}
                 key={selectedCam.id}
                 src={videoSrc}
                 className="absolute inset-0 w-full h-full object-cover z-10"
                 autoPlay
                 loop
                 muted
                 playsInline
               />
             )}

             {/* Skeleton Overlay — real keypoints or animated fallback */}
             {skeletonVisible && (() => {
               const useReal = realKeypointPositions.length === 17;
               const BONES = [[0,1],[1,2],[1,3],[2,4],[3,5],[4,6],[5,7],[1,8],[8,9],[8,10],[9,11],[10,12]];
               let pts: number[][];

               if (useReal) {
                 // Map COCO-17 keypoints → SVG viewBox (800x450)
                 // COCO order: nose, L-eye, R-eye, L-ear, R-ear, L-shoulder, R-shoulder,
                 //   L-elbow, R-elbow, L-wrist, R-wrist, L-hip, R-hip, L-knee, R-knee, L-ankle, R-ankle
                 // Our skeleton uses 13 points in custom order, so remap:
                 const c = realKeypointPositions;
                 // Derive neck as midpoint of shoulders (indices 5,6)
                 const neckX = (c[5].x + c[6].x) / 2;
                 const neckY = (c[5].y + c[6].y) / 2;
                 // Derive pelvis as midpoint of hips (indices 11,12)
                 const pelvisX = (c[11].x + c[12].x) / 2;
                 const pelvisY = (c[11].y + c[12].y) / 2;
                 pts = [
                   [c[0].x * 800, c[0].y * 450],   // 0 Head (nose)
                   [neckX * 800, neckY * 450],       // 1 Neck
                   [c[5].x * 800, c[5].y * 450],     // 2 L-Shoulder
                   [c[6].x * 800, c[6].y * 450],     // 3 R-Shoulder
                   [c[7].x * 800, c[7].y * 450],     // 4 L-Elbow
                   [c[8].x * 800, c[8].y * 450],     // 5 R-Elbow
                   [c[9].x * 800, c[9].y * 450],     // 6 L-Wrist
                   [c[10].x * 800, c[10].y * 450],   // 7 R-Wrist
                   [pelvisX * 800, pelvisY * 450],    // 8 Pelvis
                   [c[13].x * 800, c[13].y * 450],   // 9 L-Knee
                   [c[14].x * 800, c[14].y * 450],   // 10 R-Knee
                   [c[15].x * 800, c[15].y * 450],   // 11 L-Ankle
                   [c[16].x * 800, c[16].y * 450],   // 12 R-Ankle
                 ];
               } else {
                 // Fallback: hardcoded base + animated offsets
                 const BASE_PTS: [number, number][] = [
                   [400, 135], [400, 180], [340, 205], [460, 205],
                   [300, 270], [500, 270], [280, 340], [520, 340],
                   [400, 270], [360, 360], [440, 360], [350, 430], [450, 430],
                 ];
                 pts = BASE_PTS.map(([x, y], i) => [
                   x + (skeletonOffsets[i]?.dx ?? 0),
                   y + (skeletonOffsets[i]?.dy ?? 0),
                 ]);
               }
               return (
                 <svg
                   className="absolute top-0 left-0 w-full h-full pointer-events-none"
                   style={{ zIndex: 15 }}
                   viewBox="0 0 800 450"
                   preserveAspectRatio="xMidYMid slice"
                 >
                   {pts.map(([cx, cy], i) => (
                     <circle key={i} cx={cx} cy={cy} r="5" fill="#1D9E75" opacity="0.9" />
                   ))}
                   {BONES.map(([s, e], i) => (
                     <line
                       key={`bone-${i}`}
                       x1={pts[s][0]} y1={pts[s][1]}
                       x2={pts[e][0]} y2={pts[e][1]}
                       stroke="#1D9E75" strokeWidth="2" opacity="0.7"
                     />
                   ))}
                   <rect
                     x="250" y="110" width="300" height="340"
                     fill="none" stroke="#1D9E75" strokeWidth="1.5"
                     strokeDasharray="8 4" opacity="0.5"
                   >
                     <animate attributeName="stroke-dashoffset" values="0;24" dur="2s" repeatCount="indefinite" />
                   </rect>
                   <text x="255" y="105" fill="#1D9E75" fontSize="11" fontFamily="monospace" opacity="0.8">
                     POSE_SUBJECT_01 — 17 KEYPOINTS
                   </text>
                 </svg>
               );
             })()}

             {/* Confidence Bar */}
             <div className="absolute bottom-0 left-4 right-4 z-20" style={{ paddingBottom: '12px' }}>
               <div className="flex justify-between font-mono text-[10px] tracking-widest font-bold drop-shadow-md" style={{ paddingBottom: '4px' }}>
                 <span style={{ color: isSafe ? '#1D9E75' : '#e24b4a'}}>{isSafe ? 'MONITORING \u2014 NO THREAT DETECTED' : 'INTRUSION CONFIDENCE SCORE'}</span>
                 <span style={{ color: isSafe ? '#1D9E75' : '#e24b4a'}}>{confidenceDisplay.toFixed(0)}%</span>
               </div>
               <div className="w-full h-1.5 bg-black/70 border border-white/10 rounded-full overflow-hidden">
                 <div
                   className={`h-full ${isSafe ? 'bg-[#1D9E75]' : 'bg-[#e24b4a]'}`}
                   style={{ width: `${confidenceDisplay}%`, transition: 'width 150ms ease-out' }}
                 />
               </div>
               {analysisComplete && isSafe && (
                  <div className="text-[#1D9E75] font-mono text-[10px] font-bold mt-1">NON-THREAT CONFIRMED \u2014 below threshold</div>
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
             {isAlertActive && alertStatus === 'PENDING' && (
               <button
                 onClick={() => handleGuardResponse('ACCEPTED')}
                 className="px-5 py-2.5 rounded font-bold text-sm text-white bg-[#1D9E75] hover:bg-emerald-600 transition-colors"
               >
                 Dispatch Guard →
               </button>
             )}
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
                key={selectedCam.id}
                cam={{...selectedCam, ...(liveCamOverride ?? {})} as Camera}
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

      {/* FIXED ALERT RESPONSE CARD — outside grid */}
      <AnimatePresence>
        {isAlertActive && !isSafe && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="bg-[#0e141e] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            style={{
              position: 'fixed' as const,
              bottom: 24,
              right: 24,
              zIndex: 9999,
              width: 300,
              border: '1px solid #2c3440',
              borderRadius: 12,
              background: '#0e141e',
            }}
          >
            {/* Header */}
            <div className="bg-[#151920] px-3 py-2 flex items-center justify-between border-b border-[#1a2535]">
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
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 80 80">
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
                      className="absolute inset-0 flex items-center justify-center font-mono font-bold text-lg"
                      style={{ color: countdownSeconds > 8 ? '#1D9E75' : countdownSeconds > 3 ? '#F59E0B' : '#EF4444' }}
                    >
                      {countdownSeconds}
                    </span>
                  </div>
                  <p className="font-mono font-bold tracking-wider text-xs"
                     style={{ color: countdownSeconds > 8 ? '#1D9E75' : countdownSeconds > 3 ? '#F59E0B' : '#EF4444' }}>
                    AUTO-DISPATCH IN {countdownSeconds}s
                  </p>
                  <div className="flex flex-col gap-1 w-full text-center">
                    <h3 className="font-bold text-white" style={{ fontSize: '0.85rem' }}>{selectedCam.label}</h3>
                    <p className="font-mono text-gray-400" style={{ fontSize: '0.7rem' }}>{selectedCam.zone} • {selectedCam.gps.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-2 font-bold text-[11px] tracking-wider w-full mt-1">
                    <button
                      onClick={() => handleGuardResponse('ACCEPTED')}
                      className="flex-1 bg-[#1D9E75] hover:bg-[#158a63] text-white font-bold rounded transition-colors cursor-pointer"
                      style={{ minHeight: '40px' }}
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={() => handleGuardResponse('ESCALATED')}
                      className="flex-1 bg-[#1a2535] hover:bg-[#243040] text-[#ef9f27] font-bold rounded transition-colors cursor-pointer"
                      style={{ minHeight: '40px' }}
                    >
                      ESCALATE
                    </button>
                  </div>
                </div>
              ) : alertStatus === 'ACCEPTED' ? (
                <div className="flex flex-col items-center gap-2 py-1">
                  <CheckCircle2 className="w-8 h-8 text-[#1D9E75]" />
                  <p className="font-bold text-sm text-[#1D9E75] tracking-wider">GUARD DISPATCHED</p>
                  <p className="font-mono text-xs text-gray-400">ETA ~4 MIN</p>
                </div>
              ) : alertStatus === 'AUTO_DISPATCHED' ? (
                <div className="flex flex-col items-center gap-2 py-1">
                  <ShieldAlert className="w-8 h-8 text-[#EF4444] animate-pulse" />
                  <p className="font-bold text-xs text-[#EF4444] tracking-wider">AUTO-SOS DISPATCHED</p>
                  <p className="font-mono text-[10px] text-gray-500 text-center">No operator response. Emergency services contacted.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-1">
                  <ShieldAlert className="w-8 h-8 text-[#ef9f27]" />
                  <p className="font-bold text-xs text-[#ef9f27] tracking-wider">ALERT ESCALATED</p>
                  <p className="font-mono text-[10px] text-gray-500 text-center">Supervisor notified. Evacuation protocol available.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OperatorConsole;
