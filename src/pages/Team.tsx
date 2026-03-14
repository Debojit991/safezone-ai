import { motion } from 'framer-motion';

const MEMBERS = [
  { name: '[YOUR NAME]', role: 'AI & COMPUTER VISION LEAD', tags: ['YOLOv8', 'Python'], initials: 'YN' },
  { name: '[YOUR NAME]', role: 'FULL STACK ENGINEER', tags: ['React', 'TypeScript'], initials: 'YN' },
  { name: '[YOUR NAME]', role: 'BACKEND & INFRASTRUCTURE', tags: ['Firebase', 'Node.js'], initials: 'YN' },
  { name: '[YOUR NAME]', role: 'PRODUCT & DESIGN', tags: ['UI/UX', 'Figma'], initials: 'YN' },
];

const Team = () => {
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-gray-200">

      {/* Section 1 — Header */}
      <div className="pt-24 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="font-bold text-white tracking-tight mb-3" style={{ fontSize: '3rem' }}>
            THE TEAM
          </h1>
          <p className="font-mono text-gray-500 mb-5" style={{ fontSize: '0.9rem' }}>
            Building the infrastructure India's safety deserves.
          </p>
          <div className="mx-auto w-20 h-px bg-[#1D9E75]" />
        </motion.div>
      </div>

      {/* Section 2 — Team Cards */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MEMBERS.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#0d1520] border border-[#1a2535] rounded-[10px] p-7 flex flex-col items-center text-center transition-all duration-200 hover:border-[#1D9E75] hover:shadow-[0_0_20px_rgba(29,158,117,0.15)]"
            >
              {/* Avatar */}
              <div
                className="w-20 h-20 rounded-full border-2 border-[#1D9E75] bg-[#0a2018] flex items-center justify-center mb-4"
              >
                <span className="font-mono font-bold text-[#1D9E75]" style={{ fontSize: '1.4rem' }}>
                  {m.initials}
                </span>
              </div>

              {/* Name */}
              <h3 className="text-white font-bold mb-1" style={{ fontSize: '1.1rem' }}>
                {m.name}
              </h3>

              {/* Role */}
              <p
                className="text-gray-500 uppercase mb-4"
                style={{ fontSize: '0.75rem', letterSpacing: '0.1em', fontVariant: 'small-caps' }}
              >
                {m.role}
              </p>

              {/* Tags */}
              <div className="flex gap-2">
                {m.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono border border-[#1D9E75] text-[#1D9E75] bg-[#0d1520] rounded-[20px] px-2.5 py-0.5"
                    style={{ fontSize: '10px' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Section 3 — Hackathon Banner */}
      <div className="max-w-2xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#0d1520] border border-[#1a2535] rounded-lg p-8 text-center mt-0"
        >
          <p className="font-mono text-gray-400 mb-2" style={{ fontSize: '0.9rem' }}>
            🏆 Built at Smart India Hackathon · March 2026 · Kolkata, India
          </p>
          <p className="text-gray-500 text-sm mb-6">
            From idea to working product in 36 hours.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="#"
              className="font-mono border border-[#1D9E75] text-[#1D9E75] bg-transparent rounded-[20px] px-5 py-2 cursor-pointer transition-all duration-200 hover:bg-[#1D9E75] hover:text-black"
              style={{ fontSize: '12px' }}
            >
              View on GitHub
            </a>
            <a
              href="#"
              className="font-mono border border-[#1D9E75] text-[#1D9E75] bg-transparent rounded-[20px] px-5 py-2 cursor-pointer transition-all duration-200 hover:bg-[#1D9E75] hover:text-black"
              style={{ fontSize: '12px' }}
            >
              Read Documentation
            </a>
          </div>
        </motion.div>
      </div>

      {/* Section 4 — Mission Statement */}
      <div className="bg-[#060d14] mt-16 py-16 px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <p className="text-white italic text-xl md:text-2xl leading-relaxed mb-4 font-serif">
            "The problem is not the absence of cameras. The problem is that cameras don't think."
          </p>
          <p className="font-mono text-gray-500 text-sm">
            — SafeZone AI Mission Statement, 2026
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Team;
