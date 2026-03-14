import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import OperatorConsole from './pages/OperatorConsole';
import Pipeline from './pages/Pipeline';
import TechStack from './pages/TechStack';
import Impact from './pages/Impact';
import Team from './pages/Team';
import GuardPWA from './pages/GuardPWA';
import EvacuationCenter from './pages/EvacuationCenter';
import CameraStreamer from './pages/CameraStreamer';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark text-white flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/console" element={<OperatorConsole />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/tech" element={<TechStack />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/team" element={<Team />} />
            <Route path="/guard-pwa" element={<GuardPWA />} />
            <Route path="/evacuation" element={<EvacuationCenter />} />
            <Route path="/camera" element={<CameraStreamer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
