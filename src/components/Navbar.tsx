import { Link } from 'react-router-dom';
import { Shield, Play, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-[#080c14] border-b border-border-col px-6 py-4 flex items-center justify-between">
      {/* Left section: Logo & Subtitle */}
      <Link to="/" className="flex items-center gap-3">
        <Shield className="text-accent w-8 h-8" />
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-wide leading-tight text-white hover:text-gray-200 transition-colors">
            SAFEZONE AI
          </span>
          <span className="text-accent font-mono text-[10px] tracking-wider uppercase leading-tight">
            Autonomous Emergency Response
          </span>
        </div>
      </Link>

      {/* Center section: Navigation Links */}
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
        <Link to="/" className="hover:text-white transition-colors">Problem</Link>
        <Link to="/console" className="hover:text-white transition-colors">Console</Link>
        <Link to="/evacuation" className="hover:text-white transition-colors">Evacuation</Link>
        <Link to="/pipeline" className="hover:text-white transition-colors">Pipeline</Link>
        <Link to="/tech" className="hover:text-white transition-colors">Tech</Link>
        <Link to="/team" className="hover:text-white transition-colors">Team</Link>
      </div>

      {/* Right section: Action Button & QR Code */}
      <div className="flex items-center gap-6">
        <Link 
          to="/console" 
          className="hidden lg:flex items-center gap-2 bg-accent hover:bg-emerald-600 text-white px-5 py-2.5 rounded text-sm font-semibold transition-colors shadow-sm"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Run Analysis</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
        
        <div className="flex flex-col items-center">
          <div className="bg-white p-1 rounded-sm shadow-sm mb-1.5 flex items-center justify-center">
            <QRCodeSVG value={`${window.location.origin}/guard-pwa`} size={32} />
          </div>
          <span className="text-accent font-mono text-[8px] tracking-widest leading-none text-center">
            SCAN TO BECOME<br/>GUARD 3
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
