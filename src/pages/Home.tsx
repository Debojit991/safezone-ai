import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';
import { useCounter } from '../hooks/useCounter';

const Typewriter = ({ text, className, delay = 0 }: { text: string, className?: string, delay?: number }) => {
  const chars = text.split("");
  return (
    <motion.div className={className} style={{ display: 'inline-block' }}>
      {chars.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.05, delay: delay + index * 0.03 }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  );
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const [current, setCurrent] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  useEffect(() => {
    if (isInView) {
      let start: number | null = null;
      const duration = 2000;
      let frameId: number;
      
      const animate = (time: number) => {
        if (start === null) start = time;
        const progress = Math.min((time - start) / duration, 1);
        const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
        setCurrent(Math.floor(easeOutQuint(progress) * value));
        
        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        }
      };
      frameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frameId);
    }
  }, [isInView, value]);
  
  return <span ref={ref}>{current.toLocaleString()}</span>;
};

const CanvasSkeleton = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    
    let start: number | null = null;
    const duration = 2000;
    
    // Scale points realistically to the aspect ratio
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;

    const points = [
      [cw * 0.7, ch * 0.6],    // Head
      [cw * 0.62, ch * 0.6],   // Neck
      [cw * 0.55, ch * 0.5], [cw * 0.48, ch * 0.5], [cw * 0.45, ch * 0.55], // Left arm
      [cw * 0.58, ch * 0.68], [cw * 0.5, ch * 0.68], [cw * 0.45, ch * 0.65], // Right arm
      [cw * 0.52, ch * 0.6],   // Mid Spine
      [cw * 0.42, ch * 0.6],   // Pelvis
      [cw * 0.32, ch * 0.52], [cw * 0.22, ch * 0.5], [cw * 0.12, ch * 0.52], // Left leg
      [cw * 0.3, ch * 0.68], [cw * 0.2, ch * 0.72], [cw * 0.1, ch * 0.7],  // Right leg
    ];
    
    const edges = [
      [0,1],
      [1,2], [2,3], [3,4],
      [1,5], [5,6], [6,7],
      [1,8], [8,9],
      [9,10], [10,11], [11,12],
      [9,13], [13,14], [14,15]
    ];
    
    const animate = (time: number) => {
      if (start === null) start = time;
      const progress = Math.min((time - start) / duration, 1);
      
      // Clear canvas each frame
      ctx.clearRect(0, 0, cw, ch);
      
      // Draw lines
      ctx.strokeStyle = '#1D9E75';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const linesToDraw = Math.floor(progress * edges.length);
      
      ctx.beginPath();
      for (let i = 0; i < linesToDraw; i++) {
        const [startIdx, endIdx] = edges[i];
        ctx.moveTo(points[startIdx][0], points[startIdx][1]);
        ctx.lineTo(points[endIdx][0], points[endIdx][1]);
      }
      
      if (progress < 1 && linesToDraw < edges.length) {
        const [startIdx, endIdx] = edges[linesToDraw];
        const pSeg = (progress * edges.length) - linesToDraw;
        ctx.moveTo(points[startIdx][0], points[startIdx][1]);
        const currentX = points[startIdx][0] + (points[endIdx][0] - points[startIdx][0]) * pSeg;
        const currentY = points[startIdx][1] + (points[endIdx][1] - points[startIdx][1]) * pSeg;
        ctx.lineTo(currentX, currentY);
      }
      ctx.stroke();
      
      // Nodes
      ctx.fillStyle = '#1D9E75';
      for (let i = 0; i <= Math.floor(progress * points.length); i++) {
        if (i < points.length) {
          ctx.beginPath();
          ctx.arc(points[i][0], points[i][1], 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" width={800} height={450} />;
};

const StatPill = ({ text, className = '' }: { text: React.ReactNode, className?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={`px-4 py-2 rounded-full border border-border-col bg-card font-mono text-xs flex items-center ${className}`}
  >
    {text}
  </motion.div>
);

const Home = () => {
  const { totalRuns } = useCounter();
  const [time, setTime] = useState('');

  useEffect(() => {
    // Initial and interval timestamp
    const updateTime = () => setTime(new Date().toISOString().replace('T', ' ').substring(0, 19));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-dark w-full overflow-x-hidden pt-8">
      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 py-12 lg:py-24 grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-white mb-2 flex flex-col">
            <Typewriter text="India has 8 crore" delay={0.1} />
            <Typewriter text="CCTV cameras." delay={0.8} />
            <Typewriter text="Every one" className="text-[#829c85] mt-1" delay={1.4} />
            <Typewriter text="watched silently" className="text-[#829c85]" delay={2.0} />
            <Typewriter text="while someone" delay={2.6} />
            <Typewriter text="needed help." delay={3.1} />
          </h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.8, duration: 0.8 }}
            className="text-gray-400 text-lg max-w-lg leading-relaxed mt-2"
          >
            SafeZone AI turns passive cameras into active lifesavers. Automated detection, instant emergency dispatch.
          </motion.p>
          
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 4.2 }}
             className="flex flex-wrap items-center gap-4 mt-6"
          >
            <Link 
              to="/console" 
              className="flex items-center justify-center gap-2 bg-accent hover:bg-emerald-600 text-white px-7 py-3 rounded font-semibold transition-colors shadow-sm"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Run Analysis</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </Link>
            <Link 
              to="/pipeline" 
              className="flex items-center justify-center gap-2 border-2 border-white hover:bg-white hover:text-dark text-white px-7 py-3 rounded font-semibold transition-colors"
            >
              How It Works
              <ArrowRight className="w-5 h-5 ml-1" />
            </Link>
          </motion.div>

          {/* Stat Pills */}
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 4.5 }}
             className="flex flex-wrap gap-3 mt-8 max-w-lg"
          >
            <StatPill text="2.8s dispatch" />
            <StatPill text="7 threat types" />
            <StatPill text="0 victim actions" />
            <StatPill 
               text={<><span className="w-2 h-2 rounded-full bg-accent mr-2 inline-block"></span>{totalRuns} analyses run today</>} 
               className="border-accent/40 text-accent bg-[#071310] shadow-[0_0_10px_rgba(29,158,117,0.15)]" 
            />
          </motion.div>
        </div>

        {/* Right Column: CCTV Feed */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="flex flex-col gap-4"
        >
          {/* Feed Container */}
          <div 
            className="relative w-full aspect-video bg-[#060a12] border-2 border-alert rounded-sm shadow-[0_0_20px_rgba(226,75,74,0.4)] overflow-hidden"
          >
            {/* Pulsing Border animation by swapping border color could be done via CSS, but box-shadow is usually enough */}
            <motion.div 
              className="absolute inset-0 border-4 border-alert/20 pointer-events-none z-20"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Simulated Grain */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay z-0" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>
            
            {/* Scan lines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none z-0"></div>

            {/* Overlays */}
            <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
              <div className="w-2.5 h-2.5 rounded-full bg-alert animate-pulse shadow-[0_0_5px_rgba(226,75,74,0.8)]"></div>
              <span className="font-mono text-white/90 text-[10px] tracking-wider font-bold">REC</span>
              <span className="font-mono text-white/80 text-[10px] ml-1 bg-black/60 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">{time}</span>
            </div>
            
            <div className="absolute top-4 right-4 bg-black/60 border border-white/10 px-2 py-0.5 rounded-sm z-20 backdrop-blur-sm">
              <span className="font-mono text-white/80 text-[10px] tracking-wider">CAM-DE</span>
            </div>

            {/* Dark background silhouette structure block just to look like a room. */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
               <div className="w-1/2 h-2/3 border-t border-l border-white/5 rounded-tl-lg absolute right-10 bottom-0 bg-gradient-to-tr from-white/5 to-transparent"></div>
            </div>

            {/* Skeleton Overlay */}
            <CanvasSkeleton />

            {/* Confidence Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1.5 z-20">
              <div className="flex justify-between font-mono text-alert text-[9px] tracking-widest font-bold drop-shadow-md">
                <span>AI CONFIDENCE SCORE</span>
                <span>91%</span>
              </div>
              <div className="w-full h-1.5 bg-black/70 border border-alert/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-alert shadow-[0_0_5px_#E24B4A]"
                  initial={{ width: "0%" }}
                  animate={{ width: "91%" }}
                  transition={{ delay: 2.2, duration: 3, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 5.5 }}
            className="flex flex-col gap-2"
          >
            <div className="font-mono text-alert text-lg font-bold italic tracking-wide">
              CRITICAL ALERT: MEDICAL EMERGENCY DETECTED
            </div>
            <div className="flex justify-between items-center text-[9px] font-mono text-gray-500 tracking-widest uppercase">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_5px_#1D9E75]"></div>
                <span>LIVE TRANSMISSION</span>
              </div>
              <span>ENCRYPTED ENDPOINT: SZA-NODE-001</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* PROBLEM SECTION */}
      <section id="problem" className="max-w-6xl mx-auto px-6 py-24 mt-12 bg-[#080b11] border-t border-border-col rounded-t-[40px]">
        <div className="grid md:grid-cols-3 gap-12 text-center mb-24">
          <div className="flex flex-col gap-3">
            <div className="text-5xl lg:text-7xl font-extrabold text-white font-mono">
              <AnimatedNumber value={354000000} />
            </div>
            <p className="text-gray-400 text-sm tracking-widest uppercase font-semibold max-w-[220px] mx-auto leading-relaxed">
              women face public harassment annually
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-5xl lg:text-7xl font-extrabold text-white font-mono">
              <AnimatedNumber value={4} />
            </div>
            <p className="text-gray-400 text-sm tracking-widest uppercase font-semibold max-w-[220px] mx-auto leading-relaxed">
              minute average emergency response time
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-5xl lg:text-7xl font-extrabold text-white font-mono">
              <AnimatedNumber value={3} />
            </div>
            <p className="text-gray-400 text-sm tracking-widest uppercase font-semibold max-w-[220px] mx-auto leading-relaxed">
              minutes before cardiac emergency becomes fatal
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-10 max-w-4xl mx-auto px-4">
          {/* Without Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between font-mono text-sm font-bold uppercase tracking-widest text-[#d1d5db]">
              <span>Without SafeZone</span>
              <span>4 min 00 sec</span>
            </div>
            <div className="w-full h-10 bg-alert/90 rounded pt-px shadow-[0_0_20px_rgba(226,75,74,0.15)] relative overflow-hidden">
               {/* diagonal stripes */}
               <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)'}}></div>
            </div>
          </div>
          
          {/* With Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between font-mono text-sm font-bold uppercase tracking-widest text-accent">
              <span>With SafeZone AI</span>
              <span>2.8 sec</span>
            </div>
            <motion.div 
               initial={{ width: "0%" }}
               whileInView={{ width: "5%" }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
               className="h-10 bg-accent rounded shadow-[0_0_25px_rgba(29,158,117,0.3)] relative"
            >
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white/40 rounded-full animate-pulse"></div>
            </motion.div>
          </div>
        </div>

        <div className="mt-32 text-center pb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="text-3xl lg:text-5xl font-extrabold text-white max-w-4xl mx-auto leading-[1.3] tracking-tight"
          >
            "The problem is not the absence of cameras.<br className="hidden md:block"/>
            <span className="text-gray-500 ml-2">The problem is that cameras don't think."</span>
          </motion.h2>
        </div>
      </section>
    </div>
  );
};

export default Home;
