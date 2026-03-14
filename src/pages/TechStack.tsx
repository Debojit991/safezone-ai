import { motion } from 'framer-motion';

const DETECTION = [
  'YOLOv8-Pose v8.2',
  'OpenCV Frame Buffer',
  '17-Keypoint Skeleton Mapping',
  '30fps Real-time Processing',
  'Confidence Threshold Engine',
];

const INTELLIGENCE = [
  'Threat Geometry Classifier',
  '7 Rule-based Detectors',
  'Gemini 1.5 Flash NLP',
  'Firebase RTDB Pub/Sub',
  'Sub-second Alert Pipeline',
];

const RESPONSE = [
  'FCM Push Dispatch',
  'Guard PWA — Installable',
  'AES-256-GCM Encryption',
  'Forensic Evidence Lock',
  'Netlify Edge CDN',
];

const THREATS = [
  { cls: 'Person Collapse', trigger: 'Center-of-gravity drop below ambulatory threshold for 3+ seconds', threshold: '85%', response: 'Medical dispatch + evidence lock' },
  { cls: 'Physical Threat', trigger: 'Encirclement geometry + defensive posture detected', threshold: '80%', response: 'Guard dispatch + notification' },
  { cls: 'Intrusion', trigger: 'Movement in restricted zone outside scheduled hours', threshold: '75%', response: 'Guard dispatch + alert' },
  { cls: 'Medical Emergency', trigger: 'Seizure motion pattern + stillness', threshold: '88%', response: 'Medical dispatch + ambulance' },
  { cls: 'Harassment', trigger: 'Sustained proximity violation + directional tracking', threshold: '78%', response: 'Guard dispatch + escalation' },
  { cls: 'Abandoned Object', trigger: 'Stationary unattended object 5+ minutes', threshold: '70%', response: 'Inspection dispatch' },
  { cls: 'Hit & Run', trigger: 'Vehicle-pedestrian intersection + sudden stillness', threshold: '90%', response: 'Emergency services + evidence lock' },
];

const JSON_LINES: { key: string; value: string; type: 'string' | 'number' | 'boolean' }[] = [
  { key: 'threat_id', value: '"TH-2026-03-14-0041"', type: 'string' },
  { key: 'cam_id', value: '"CAM-04_ZONE_A"', type: 'string' },
  { key: 'zone', value: '"Zone A — Restricted"', type: 'string' },
  { key: 'threat_type', value: '"PERSON_COLLAPSE"', type: 'string' },
  { key: 'confidence', value: '0.91', type: 'number' },
  { key: 'keypoints_detected', value: '14', type: 'number' },
  { key: 'frames_analyzed', value: '23', type: 'number' },
  { key: 'timestamp_utc', value: '"2026-03-14T09:51:14Z"', type: 'string' },
  { key: 'dispatch_fired_ms', value: '3036', type: 'number' },
  { key: 'guard_notified', value: '"GUARD_03"', type: 'string' },
  { key: 'evidence_buffer_locked', value: 'true', type: 'boolean' },
  { key: 'encryption', value: '"AES-256-GCM"', type: 'string' },
];

const valColor = (t: 'string' | 'number' | 'boolean') =>
  t === 'string' ? '#1D9E75' : t === 'number' ? '#F59E0B' : '#EF4444';

const ActiveBadge = () => (
  <span className="font-mono text-[10px] font-bold tracking-wider text-[#1D9E75] bg-[#0d2518] px-2 py-0.5 rounded">
    ACTIVE
  </span>
);

const LayerCard = ({ title, items, border, delay }: { title: string; items: string[]; border: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-[#0d1520] rounded-lg p-7"
    style={{ borderTop: `3px solid ${border}` }}
  >
    <h3 className="font-bold text-sm text-white tracking-widest mb-5">{title}</h3>
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item} className="bg-[#0a0f1a] px-3.5 py-2.5 rounded flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#1D9E75]" />
            <span className="text-gray-300 text-xs">{item}</span>
          </div>
          <ActiveBadge />
        </div>
      ))}
    </div>
  </motion.div>
);

const TechStack = () => {
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-gray-200 pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Section 1 — Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-white tracking-tight mb-3" style={{ fontSize: '3rem' }}>
            THE STACK
          </h1>
          <p className="font-mono text-gray-500 mb-5" style={{ fontSize: '0.9rem' }}>
            Built for production. Proven under pressure.
          </p>
          <div className="mx-auto w-20 h-px bg-[#1D9E75]" />
        </motion.div>

        {/* Section 2 — Three Column Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <LayerCard title="DETECTION LAYER" items={DETECTION} border="#3B82F6" delay={0.1} />
          <LayerCard title="INTELLIGENCE LAYER" items={INTELLIGENCE} border="#8B5CF6" delay={0.2} />
          <LayerCard title="RESPONSE LAYER" items={RESPONSE} border="#EF4444" delay={0.3} />
        </div>

        {/* Section 3 — JSON Terminal Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#060d14] rounded-lg border border-[#1a2535] overflow-hidden mb-16"
        >
          {/* Terminal Header */}
          <div className="px-4 py-3 border-b border-[#1a2535] flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <div className="w-3 h-3 rounded-full bg-[#1D9E75]" />
            </div>
            <span className="font-mono text-[11px] text-[#1D9E75] tracking-wider ml-2">
              LIVE THREAT PAYLOAD — ENCRYPTED ENDPOINT
            </span>
          </div>

          {/* JSON Body */}
          <div className="p-5 font-mono text-[13px] leading-7">
            <span className="text-white">{'{'}</span>
            {JSON_LINES.map((line, i) => (
              <div key={line.key} className="pl-5">
                <span style={{ color: '#8B5CF6' }}>"{line.key}"</span>
                <span className="text-white">: </span>
                <span style={{ color: valColor(line.type) }}>{line.value}</span>
                {i < JSON_LINES.length - 1 && <span className="text-gray-600">,</span>}
              </div>
            ))}
            <span className="text-white">{'}'}</span>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#1a2535]">
            <span className="font-mono text-[11px] text-gray-500">
              Payload transmitted via Firebase RTDB · End-to-end encrypted · Latency: 40ms
            </span>
          </div>
        </motion.div>

        {/* Section 4 — Threat Class Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-lg border border-[#1a2535] overflow-hidden"
        >
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0d1520]">
                <th className="px-5 py-3 font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase">Threat Class</th>
                <th className="px-5 py-3 font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase">Trigger Conditions</th>
                <th className="px-5 py-3 font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase">Confidence</th>
                <th className="px-5 py-3 font-mono text-[10px] tracking-widest text-gray-500 font-bold uppercase">Response Protocol</th>
              </tr>
            </thead>
            <tbody>
              {THREATS.map((t, i) => (
                <tr key={t.cls} className={i % 2 === 0 ? 'bg-[#0a0f1a]' : 'bg-[#0d1218]'}>
                  <td className="px-5 py-3 text-white font-bold text-xs">{t.cls}</td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-[11px]">{t.trigger}</td>
                  <td className="px-5 py-3 text-[#1D9E75] font-mono text-xs font-bold">{t.threshold}</td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-[11px]">{t.response}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

      </div>
    </div>
  );
};

export default TechStack;
