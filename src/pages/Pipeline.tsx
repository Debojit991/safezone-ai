import { motion } from 'framer-motion';

const STAGES = [
  {
    title: 'CCTV INGESTION',
    icon: '📹',
    border: '#1D9E75',
    description: 'Live feed captured at 30fps across all registered camera nodes. H.264 stream decoded into raw frame buffer.',
    latency: '~8ms',
  },
  {
    title: 'YOLOV8-POSE EXTRACTION',
    icon: '◉',
    border: '#3B82F6',
    description: '17 anatomical keypoints extracted per human silhouette. Bounding boxes, joint vectors, and center-of-gravity calculated per frame.',
    latency: '~340ms',
  },
  {
    title: 'THREAT CLASSIFICATION ENGINE',
    icon: '⚙',
    border: '#F59E0B',
    description: 'Proprietary geometry rules evaluate posture angles, encirclement ratios, and velocity vectors across 7 threat classes.',
    latency: '~12ms',
  },
  {
    title: 'GEMINI AI CONTEXTUAL ANALYSIS',
    icon: '🧠',
    border: '#8B5CF6',
    description: 'Gemini 1.5 Flash generates clinical incident summary, risk assessment, and recommended response protocol.',
    latency: '~900ms',
  },
  {
    title: 'EMERGENCY DISPATCH',
    icon: '🚨',
    border: '#EF4444',
    description: 'Firebase RTDB pub/sub fires push notification to nearest on-duty guard PWA. Evidence buffer locked. AES-256 encrypted throughout.',
    latency: '~40ms',
  },
];

const STATS = [
  { value: '8 CR+', label: 'CAMERAS ADDRESSABLE' },
  { value: '7', label: 'THREAT CLASSES' },
  { value: '2.8s', label: 'MEAN DISPATCH' },
  { value: 'AES-256', label: 'END-TO-END' },
];

const Pipeline = () => {
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-gray-200 pt-24 pb-20 px-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
            HOW SAFEZONE AI WORKS
          </h1>
          <p className="font-mono text-xs tracking-[0.3em] text-gray-500 uppercase">
            FROM PIXEL TO DISPATCH IN UNDER 3 SECONDS
          </p>
        </motion.div>

        {/* Pipeline */}
        <div className="flex flex-col items-center">
          {STAGES.map((stage, i) => (
            <div key={stage.title} className="flex flex-col items-center w-full">
              {/* Stage Card */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="w-full bg-[#0f1520] rounded-lg overflow-hidden border border-[#1a2535] shadow-xl"
                style={{ borderLeft: `3px solid ${stage.border}` }}
              >
                <div className="p-5 flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: `${stage.border}15` }}
                  >
                    {stage.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <h3 className="font-bold text-sm text-white tracking-wider">
                        {stage.title}
                      </h3>
                      <span
                        className="font-mono text-[10px] tracking-widest px-2 py-0.5 rounded-full shrink-0 font-bold"
                        style={{
                          color: stage.border,
                          backgroundColor: `${stage.border}15`,
                          border: `1px solid ${stage.border}30`,
                        }}
                      >
                        {stage.latency}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {stage.description}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Connector Line + Animated Dot */}
              {i < STAGES.length - 1 && (
                <div className="relative w-px h-14 my-0">
                  {/* Dashed line */}
                  <div className="absolute inset-0 border-l border-dashed border-[#1a2535]" style={{ left: '50%' }} />
                  
                  {/* Animated glowing dot */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#1D9E75] shadow-[0_0_8px_#1D9E75,0_0_16px_rgba(29,158,117,0.3)]"
                    style={{
                      animation: 'pipelineDot 3s ease-in-out infinite',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total Latency Callout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mx-auto mt-14 mb-14 text-center"
          style={{
            background: '#0d1520',
            border: '1px solid #1D9E75',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '600px',
            boxShadow: '0 0 30px rgba(29,158,117,0.2)',
          }}
        >
          <p
            className="font-mono text-[#1D9E75] mb-2"
            style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.05em' }}
          >
            TOTAL PIPELINE LATENCY: ~1.3 SECONDS
          </p>
          <p style={{ marginTop: '8px' }}>
            <span className="text-gray-400" style={{ fontSize: '0.9rem' }}>Human reaction time: </span>
            <span className="text-gray-500 line-through" style={{ fontSize: '0.9rem' }}>1.5 – 2.5 seconds</span>
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-[#0f1520] border border-[#1a2535] rounded-lg p-6 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-mono text-2xl font-bold text-[#1D9E75] mb-1">
                {stat.value}
              </p>
              <p className="font-mono text-[9px] tracking-widest text-gray-500 uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Keyframe animation for the pipeline dot */}
      <style>{`
        @keyframes pipelineDot {
          0%   { top: 0; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Pipeline;
