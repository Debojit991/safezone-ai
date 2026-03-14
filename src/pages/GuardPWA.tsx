import { useEffect, useState, useRef } from 'react';
import { ref as dbRef, onValue, set } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { ShieldAlert, Shield, ExternalLink } from 'lucide-react';

interface AlertData {
  active: boolean;
  label: string;
  timestamp: number;
  zone?: string;
  gps?: [number, number];
  status?: string;
}

const playAlertAudio = () => {
  try {
    const ctx = new AudioContext();
    // 880Hz sine for 0.5s
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880;
    gain1.gain.value = 0.3;
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.5);

    // 660Hz sine for 0.3s after 0.55s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 660;
    gain2.gain.value = 0.3;
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.55);
    osc2.stop(ctx.currentTime + 0.85);

    setTimeout(() => ctx.close(), 1500);
  } catch { /* audio not supported */ }
};

const GuardPWA = () => {
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [status, setStatus] = useState<'ON_DUTY' | 'ACCEPTED' | 'ESCALATED'>('ON_DUTY');
  const [currentTime, setCurrentTime] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const alertTimeRef = useRef<number>(0);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  // Live time
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Elapsed time counter when alert active
  useEffect(() => {
    if (!alert || status !== 'ON_DUTY') return;
    const tick = () => setElapsed(Math.floor((Date.now() - alertTimeRef.current) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [alert, status]);

  // Listen for ALL alerts on rtdb /alerts — autonomous
  useEffect(() => {
    const alertsRef = dbRef(rtdb, 'alerts');
    const unsub = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Find any alert that is not RESOLVED
      const keys = Object.keys(data);
      for (const key of keys) {
        const a = data[key];
        if (a && a.active && a.status !== 'RESOLVED') {
          const alertData: AlertData = {
            active: true,
            label: a.label || key,
            timestamp: a.timestamp || Date.now(),
            zone: a.zone,
            gps: a.gps,
            status: a.status,
          };
          setAlert(alertData);
          setStatus('ON_DUTY');
          alertTimeRef.current = alertData.timestamp;

          // Vibrate
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 400]);
          }

          // Audio alert
          playAlertAudio();

          // Web Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⚠️ SAFEZONE AI ALERT', {
              body: `${alertData.label} detected. Respond immediately.`,
              icon: '/vite.svg',
            });
          }
          break;
        }
      }
    });

    // Also listen on legacy path
    const legacyRef = dbRef(rtdb, 'guards/3/alert');
    const unsub2 = onValue(legacyRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.active) {
        setAlert(data);
        setStatus('ON_DUTY');
        alertTimeRef.current = data.timestamp || Date.now();
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
        playAlertAudio();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('⚠️ SAFEZONE AI ALERT', {
            body: `${data.label} detected. Respond immediately.`,
            icon: '/vite.svg',
          });
        }
      }
    });

    return () => { unsub(); unsub2(); };
  }, []);

  const handleResponse = async (action: 'ACCEPTED' | 'ESCALATED') => {
    try {
      await set(dbRef(rtdb, 'guards/3/response'), action);
      setStatus(action);
    } catch { /* silent */ }
  };

  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;
  const gpsLat = alert?.gps?.[0] ?? 22.5726;
  const gpsLng = alert?.gps?.[1] ?? 88.3639;

  return (
    <div className={`min-h-screen text-gray-200 flex flex-col ${status === 'ON_DUTY' && alert ? 'bg-gradient-to-br from-[#1a0000] to-[#3d0000]' : 'bg-[#04070b]'}`}>
      {/* Show normal header/footer ONLY if not in active alert state */}
      {(!alert || status !== 'ON_DUTY') && (
        <>
          {/* Status Header */}
          <div className="bg-[#080c14] border-b border-[#1a2535] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-[#1D9E75]" />
              <div>
                <h1 className="text-sm font-bold tracking-widest text-white">SAFEZONE GUARD</h1>
                <p className="text-[10px] font-mono text-gray-500 tracking-wider">UNIT 3 — MOBILE RESPONSE</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'ESCALATED' ? 'bg-[#ef9f27]' : 'bg-[#1D9E75]'}`}></div>
              <span className="font-mono text-[10px] tracking-widest font-bold text-[#1D9E75]">● {status.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Live Time Bar */}
          <div className="bg-[#060a12] border-b border-[#1a2535] px-6 py-2 flex items-center justify-between font-mono text-[10px] text-gray-500 tracking-widest">
            <span>LIVE TIME: {currentTime}</span>
            <span>ENCRYPTION: AES-256</span>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center justify-center p-6 ${status === 'ON_DUTY' && alert ? 'w-full h-full' : ''}`}>
        {!alert ? (
          /* Waiting State */
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-24 h-24 rounded-full border-2 border-[#1D9E75]/30 flex items-center justify-center">
              <Shield className="w-12 h-12 text-[#1D9E75]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2 tracking-wider">GUARD 3 — ON DUTY</h2>
              <p className="text-gray-500 text-sm font-mono max-w-xs">
                Monitoring for alerts from SafeZone AI operator console
              </p>
            </div>

            {/* Live Clock */}
            <div className="bg-[#0f1520] border border-[#1a2535] rounded-lg px-8 py-4">
              <p className="text-white text-2xl font-bold font-mono tracking-wider">{currentTime}</p>
              <p className="text-gray-500 font-mono text-[10px] tracking-widest mt-1">LIVE CLOCK</p>
            </div>

            {/* Firebase connection status */}
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse shadow-[0_0_6px_#1D9E75]" />
              <span className="font-mono text-[10px] tracking-widest text-[#1D9E75] font-bold">CONNECTED TO FIREBASE</span>
            </div>

            {/* DEV TEST BUTTON — development only */}
            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  const mockAlert: AlertData = {
                    active: true,
                    label: 'TEST — Physical Assault',
                    timestamp: Date.now(),
                    zone: 'Zone A',
                    gps: [22.56, 88.36],
                    status: 'PENDING',
                  };
                  setAlert(mockAlert);
                  setStatus('ON_DUTY');
                  alertTimeRef.current = mockAlert.timestamp;
                  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
                  playAlertAudio();
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('⚠️ TEST ALERT', {
                      body: 'Test incident triggered manually.',
                      icon: '/vite.svg',
                    });
                  }
                }}
                className="mt-4 px-4 py-2 bg-[#e24b4a]/20 hover:bg-[#e24b4a]/40 border border-[#e24b4a]/40 text-[#e24b4a] text-[10px] tracking-widest font-bold rounded transition-colors font-mono"
              >
                ⚠ TEST ALERT
              </button>
            )}
          </div>
        ) : status === 'ON_DUTY' ? (
          /* Alert State — fullscreen red card */
          <div className="w-full h-full flex flex-col justify-between py-6">
            <div className="flex flex-col gap-6 text-center mt-4">
              <h1 className="text-2xl font-bold text-white uppercase tracking-widest">SAFEZONE AI — ALERT</h1>
              <h2 className="text-5xl font-bold text-white leading-tight">{alert.label}</h2>
              <div className="flex flex-col gap-2 text-center mt-2">
                {alert.zone && <p className="font-mono text-[#1D9E75] text-lg font-bold tracking-wider">ZONE: {alert.zone}</p>}
                <p className="font-mono text-[#1D9E75] text-lg font-bold tracking-wider">GPS: {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}</p>
              </div>
            </div>

            {/* Map image */}
            <div className="w-full mt-8 rounded-xl overflow-hidden shadow-2xl border-2 border-[#EF4444]/50">
              <img 
                src={`https://static-maps.yandex.ru/1.x/?ll=${gpsLng},${gpsLat}&size=400,200&z=16&l=map&pt=${gpsLng},${gpsLat},pm2rdm`}
                alt="Alert Map"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://dummyimage.com/400x200/ef4444/ffffff.png&text=MAP+API+UNAVAILABLE`;
                }}
              />
            </div>

            <div className="mt-auto flex flex-col gap-6 w-full pt-8">
              {/* Elapsed */}
              <p className="font-mono text-center text-gray-300 text-lg uppercase tracking-widest">
                Elapsed Time: <span className="text-white font-bold">{elapsedMin}m {elapsedSec.toString().padStart(2, '0')}s</span>
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleResponse('ACCEPTED')}
                  className="w-full bg-[#1D9E75] hover:bg-emerald-600 text-white rounded-xl py-6 font-bold text-xl tracking-wider transition-colors shadow-[0_4px_20px_rgba(29,158,117,0.5)]"
                >
                  ACCEPT
                </button>
                <button
                  onClick={() => handleResponse('ESCALATED')}
                  className="w-full bg-[#EF4444] hover:bg-red-600 text-white rounded-xl py-6 font-bold text-xl tracking-wider transition-colors shadow-[0_4px_20px_rgba(239,68,68,0.5)]"
                >
                  ESCALATE
                </button>
              </div>
            </div>
          </div>
        ) : status === 'ACCEPTED' ? (
          /* Accepted — En Route */
          <div className="flex flex-col items-center gap-6 text-center w-full max-w-md bg-[#0a2018] rounded-2xl p-8 border border-[#1D9E75]/30">
            <div className="w-16 h-16 rounded-full bg-[#1D9E75]/20 border-2 border-[#1D9E75] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#1D9E75]" />
            </div>
            <h2 className="text-3xl font-bold text-white uppercase tracking-wider">EN ROUTE TO INCIDENT</h2>
            <p className="text-gray-400 text-sm font-mono mt-2">Proceed to location. Command notified.</p>
            <p className="font-mono text-[#1D9E75] text-sm mt-4 tracking-wider">GPS: {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}</p>
            <a
              href={`https://maps.google.com/?q=${gpsLat},${gpsLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#1D9E75] hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg tracking-wider transition-colors mt-6 w-full justify-center shadow-[0_4px_14px_rgba(29,158,117,0.4)]"
            >
              <ExternalLink className="w-5 h-5" />
              OPEN IN MAPS
            </a>
            <p className="font-mono text-[10px] text-gray-500 tracking-widest mt-6">RESPONSE: ACCEPTED AT {currentTime}</p>
          </div>
        ) : (
          /* Escalated */
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#ef9f27]/10 border-2 border-[#ef9f27] flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-[#ef9f27]" />
            </div>
            <h2 className="text-xl font-bold text-white">Alert Escalated</h2>
            <p className="text-gray-500 text-sm font-mono">Supervisor notified. Stand by for further instructions.</p>
            <p className="font-mono text-[10px] text-gray-500 tracking-widest">RESPONSE: ESCALATED AT {currentTime}</p>
          </div>
        )}
      </div>

      {/* Footer ONLY when not in active alert state */}
      {(!alert || status !== 'ON_DUTY') && (
        <div className="h-14 bg-[#080c14] border-t border-[#1a2535] px-6 py-3 flex flex-col justify-center gap-1 shrink-0 w-full mb-0">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-[#1D9E75] font-bold">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              <span>GUARD 3</span>
            </div>
            <span>BADGE: 8-91X</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] tracking-widest text-gray-500">
            <span>SHIFT: {currentTime}</span>
            <span>LIVE CLOCK: {currentTime}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardPWA;
