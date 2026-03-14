import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ref as dbRef, set } from 'firebase/database';
import { rtdb } from '../lib/firebase';

interface Incident {
  threat_type: string;
  zone: string;
  lat: number;
  lng: number;
  timestamp: number;
  threat_id: string;
}

interface EvacuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  onLog?: (msg: string) => void;
}

const CHECKLIST_ITEMS = [
  'Zone sealed — perimeter established',
  'Emergency services contacted',
  'Evacuation route cleared',
  'Nearest hospital notified',
  'Evidence buffer locked',
  'Incident commander assigned',
];

const EvacuationModal = ({ isOpen, onClose, incident, onLog }: EvacuationModalProps) => {
  const [checked, setChecked] = useState<boolean[]>(new Array(6).fill(false));
  const [elapsed, setElapsed] = useState(0);

  // Elapsed time counter
  useEffect(() => {
    if (!isOpen || !incident) return;
    setChecked(new Array(6).fill(false));
    const start = incident.timestamp;
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOpen, incident?.timestamp]);

  if (!incident) return null;

  const completedCount = checked.filter(Boolean).length;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const toggleItem = (i: number) => {
    setChecked(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const handleResolve = async () => {
    try {
      await set(dbRef(rtdb, `alerts/${incident.threat_id}/status`), 'RESOLVED');
    } catch { /* silent */ }
    onLog?.('INCIDENT RESOLVED \u2014 OPERATOR CONFIRMED');
    onClose();
  };

  const handleShare = async () => {
    const text = `SAFEZONE AI INCIDENT\n${incident.threat_type}\nZone: ${incident.zone}\nGPS: ${incident.lat}, ${incident.lng}\nTime: ${new Date(incident.timestamp).toISOString()}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'SafeZone AI \u2014 Incident', text }); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        onLog?.('LOCATION COPIED TO CLIPBOARD');
      } catch { /* silent */ }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center text-gray-200 font-sans"
          style={{ zIndex: 10000 }}
        >
         <div className="w-full h-full flex flex-col" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Red Banner */}
          <div className="bg-[#EF4444] py-3 px-6 flex items-center justify-between shrink-0">
            <span className="font-mono font-bold text-white tracking-widest text-sm">
              ⚠ EVACUATION PROTOCOL ACTIVATED
            </span>
            <span className="font-mono text-white/80 text-xs">
              INCIDENT DURATION: {mins}m {secs.toString().padStart(2, '0')}s
            </span>
          </div>

          {/* Incident Details Row */}
          <div className="bg-[#0a0e1a] border-b border-[#1a2535] px-6 py-3 flex items-center gap-6 font-mono text-[11px] shrink-0">
            <span className="text-white font-bold">{incident.threat_type}</span>
            <span className="text-gray-400">Zone: {incident.zone}</span>
            <span className="text-gray-400">GPS: {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</span>
            <span className="text-gray-500">{new Date(incident.timestamp).toISOString().replace('T', ' ').substring(0, 19)}</span>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex gap-0 overflow-hidden">

            {/* Left — Map Section */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              <span className="font-mono text-[10px] tracking-widest text-[#EF4444] font-bold uppercase mb-3">
                INCIDENT LOCATION — LIVE COORDINATES
              </span>

              <div className="rounded-lg overflow-hidden" style={{ border: '2px solid #EF4444' }}>
                <iframe
                  title="Incident Map"
                  width="100%"
                  height="350"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${incident.lat},${incident.lng}&z=17&output=embed`}
                />
              </div>

              <p className="font-mono text-lg text-[#1D9E75] font-bold mt-4 tracking-wider">
                LAT: {incident.lat.toFixed(4)} | LNG: {incident.lng.toFixed(4)}
              </p>
            </div>

            {/* Right — Checklist */}
            <div className="w-96 border-l border-[#1a2535] bg-[#0a0e1a] p-6 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase">EVACUATION CHECKLIST</span>
                <span className="font-mono text-xs font-bold text-[#1D9E75]">
                  {completedCount}/{CHECKLIST_ITEMS.length} COMPLETE
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {CHECKLIST_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleItem(i)}
                    className="flex items-center gap-3 bg-[#0d1520] border border-[#1a2535] rounded-lg px-4 py-3 text-left transition-all duration-200 hover:border-[#1D9E75]/40 cursor-pointer"
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        borderColor: checked[i] ? '#1D9E75' : '#3a4555',
                        backgroundColor: checked[i] ? '#1D9E75' : 'transparent',
                      }}
                    >
                      {checked[i] && (
                        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs font-mono ${checked[i] ? 'text-[#1D9E75]' : 'text-gray-400'}`}>
                      {item}
                    </span>
                  </button>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-5 w-full h-1.5 bg-[#1a2535] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1D9E75] transition-all duration-300"
                  style={{ width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-[#060a12] border-t border-[#1a2535] px-6 py-4 flex items-center justify-center gap-4 shrink-0">
            <a
              href="tel:112"
              className="px-5 py-2.5 rounded-lg font-mono font-bold text-xs tracking-wider bg-[#EF4444] text-white hover:bg-red-600 transition-colors"
            >
              CONTACT EMERGENCY SERVICES
            </a>
            <button
              onClick={handleShare}
              className="px-5 py-2.5 rounded-lg font-mono font-bold text-xs tracking-wider bg-[#F59E0B] text-black hover:bg-amber-500 transition-colors"
            >
              SHARE LOCATION
            </button>
            <button
              onClick={handleResolve}
              className="px-5 py-2.5 rounded-lg font-mono font-bold text-xs tracking-wider bg-[#1D9E75] text-white hover:bg-emerald-600 transition-colors"
            >
              MARK RESOLVED
            </button>
          </div>
         </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EvacuationModal;
