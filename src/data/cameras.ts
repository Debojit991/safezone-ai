export interface Camera {
  id: string;
  label: string;
  zone: string;
  gps: [number, number];
  tier: 'SAFE' | 'HIGH' | 'CRITICAL';
  clip: string;
  conf: number;
  time: number;
  model?: string;
}

export const CAMERAS: Camera[] = [
  { id: 'CAM-04', label: 'Physical Assault',     zone: 'Zone A', gps: [22.56,  88.36],  tier: 'CRITICAL', clip: 'fight',     conf: 91, time: 2.8 },
  { id: 'CAM-11', label: 'Molestation Alert',    zone: 'Zone B', gps: [22.565, 88.37],  tier: 'CRITICAL', clip: 'molest',    conf: 87, time: 3.1 },
  { id: 'CAM-23', label: 'Crowd Surge',          zone: 'Zone C', gps: [22.55,  88.38],  tier: 'HIGH',     clip: 'surge',     conf: 89, time: 4.2 },
  { id: 'CAM-07', label: 'Fire Detection',       zone: 'Zone D', gps: [22.57,  88.39],  tier: 'CRITICAL', clip: 'fire',      conf: 94, time: 2.1 },
  { id: 'CAM-31', label: 'Stampede Warning',     zone: 'Zone E', gps: [22.58,  88.35],  tier: 'HIGH',     clip: 'stampede',  conf: 82, time: 5.8 },
  { id: 'CAM-02', label: 'Perimeter Breach',     zone: 'Zone F', gps: [22.575, 88.365], tier: 'HIGH',     clip: 'breach',    conf: 96, time: 1.9 },
  { id: 'CAM-18', label: 'Evacuation Emergency', zone: 'Zone G', gps: [22.555, 88.355], tier: 'CRITICAL', clip: 'evacuation',conf: 88, time: 3.7 },
  { id: 'CAM-19', label: 'Fire Hazard',          zone: 'Zone H', gps: [22.545, 88.365], tier: 'CRITICAL', clip: 'fire',      conf: 93, time: 1.9 },
  { id: 'CAM-09', label: 'Safe Zone Monitor',    zone: 'Zone I', gps: [22.562, 88.372], tier: 'SAFE',     clip: 'safe',      conf: 42, time: 2.2 },
];
