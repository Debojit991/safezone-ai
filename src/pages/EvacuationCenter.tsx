import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Incident {
  id: string;
  type: string;
  zone: string;
  gps: [number, number];
  startTime: number;
  status: 'ESCALATED' | 'RESPONDING' | 'RESOLVED';
}

const MOCK_INCIDENTS: Incident[] = [
  { id: 'INC-001', type: 'Physical Threat', zone: 'Zone B', gps: [22.565, 88.37], startTime: Date.now() - 272000, status: 'RESPONDING' },
  { id: 'INC-002', type: 'Person Collapse', zone: 'Zone A', gps: [22.56, 88.36], startTime: Date.now() - 75000, status: 'ESCALATED' },
];

const PROTOCOLS = [
  {
    title: 'MEDICAL EMERGENCY',
    steps: ['Confirm victim consciousness and breathing', 'Contact emergency services (112)', 'Clear area and establish perimeter', 'Begin CPR if trained, await paramedics'],
  },
  {
    title: 'PHYSICAL THREAT',
    steps: ['Do not engage directly — observe from safe distance', 'Dispatch nearest armed response unit', 'Lock down entry/exit points in zone', 'Preserve evidence buffer and notify supervisor'],
  },
  {
    title: 'FIRE HAZARD',
    steps: ['Activate fire alarm and begin evacuation', 'Contact fire services immediately', 'Clear all personnel from affected zone', 'Shut off ventilation systems in zone'],
  },
];

const statusColor = (s: string) => s === 'ESCALATED' ? '#EF4444' : s === 'RESPONDING' ? '#F59E0B' : '#1D9E75';

const EvacuationCenter = () => {
  const [elapsed, setElapsed] = useState<Record<string, string>>({});

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const e: Record<string, string> = {};
      MOCK_INCIDENTS.forEach(inc => {
        const diff = Math.floor((now - inc.startTime) / 1000);
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        e[inc.id] = `${m}m ${s.toString().padStart(2, '0')}s`;
      });
      setElapsed(e);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-gray-200 pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-3xl font-bold text-[#EF4444] mb-2">🚨 EVACUATION COMMAND CENTER</h1>
          <p className="font-mono text-gray-500 text-sm">Active incident coordination and resource dispatch.</p>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">

          {/* Left — Active Incidents */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-4">ACTIVE INCIDENTS</h2>
            <div className="flex flex-col gap-3">
              {MOCK_INCIDENTS.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-[#0d1520] border border-[#1a2535] rounded-lg p-5 flex items-start justify-between"
                  style={{ borderLeft: `3px solid ${statusColor(inc.status)}` }}
                >
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-white font-bold text-sm">{inc.type}</h3>
                    <p className="text-gray-400 text-xs">{inc.zone}</p>
                    <p className="font-mono text-[#1D9E75] text-[11px]">{inc.gps[0].toFixed(4)}, {inc.gps[1].toFixed(4)}</p>
                    <p className="font-mono text-gray-500 text-[10px]">{elapsed[inc.id] || '0m 00s'} elapsed</p>
                  </div>
                  <span
                    className="font-mono text-[9px] font-bold tracking-widest px-2 py-1 rounded"
                    style={{ color: statusColor(inc.status), backgroundColor: `${statusColor(inc.status)}15`, border: `1px solid ${statusColor(inc.status)}30` }}
                  >
                    {inc.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Resource Map */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-4">RESOURCE MAP</h2>

            {/* Legend */}
            <div className="flex items-center gap-5 mb-3">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /><span className="text-[10px] text-gray-400 font-mono">Active Incident</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /><span className="text-[10px] text-gray-400 font-mono">Guard En Route</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#1D9E75]" /><span className="text-[10px] text-gray-400 font-mono">Resolved</span></div>
            </div>

            {/* Map */}
            <div className="rounded-lg overflow-hidden border border-[#1a2535]">
              <iframe
                title="Resource Map"
                width="100%"
                height="320"
                style={{ border: 0 }}
                loading="lazy"
                src="https://www.google.com/maps?q=22.5726,88.3639&z=13&output=embed"
              />
            </div>

            {/* Resource Stats */}
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                { val: '4', label: 'GUARDS ON DUTY' },
                { val: '2', label: 'INCIDENTS ACTIVE' },
                { val: '3.2 MIN', label: 'RESPONSE AVG' },
                { val: '7', label: 'RESOLVED TODAY' },
              ].map(s => (
                <div key={s.label} className="bg-[#0d1520] border border-[#1a2535] rounded-lg p-3 text-center">
                  <p className="font-mono text-lg font-bold text-[#1D9E75]">{s.val}</p>
                  <p className="font-mono text-[8px] tracking-widest text-gray-500 uppercase">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Evacuation Protocols */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase mb-5">EVACUATION PROTOCOLS</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PROTOCOLS.map((proto) => (
              <div key={proto.title} className="bg-[#0d1520] border border-[#1a2535] rounded-lg p-6">
                <h3 className="text-white font-bold text-xs tracking-widest mb-4">{proto.title}</h3>
                <div className="flex flex-col gap-3">
                  {proto.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border border-[#1D9E75] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[#1D9E75] text-[9px] font-mono font-bold">{i + 1}</span>
                      </div>
                      <p className="text-gray-400 font-mono text-[11px] leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default EvacuationCenter;
