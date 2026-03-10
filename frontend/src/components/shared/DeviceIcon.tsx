import React from 'react';
import { DeviceType } from '../../types';

const icons: Record<DeviceType, React.FC<{ size?: number; className?: string }>> = {
  desktop: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="4" y="6" width="40" height="28" rx="3" fill="#3b82f6" stroke="#60a5fa" strokeWidth="1.5"/>
      <rect x="14" y="34" width="20" height="4" fill="#1d4ed8"/>
      <rect x="10" y="38" width="28" height="3" rx="1.5" fill="#1d4ed8"/>
      <rect x="6" y="8" width="36" height="24" rx="2" fill="#1e3a5f"/>
      <circle cx="24" cy="20" r="6" fill="#3b82f6" opacity="0.5"/>
      <path d="M20 20 L24 16 L28 20 L24 24 Z" fill="#60a5fa"/>
    </svg>
  ),
  server: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="6" y="4" width="36" height="40" rx="3" fill="#7c3aed" stroke="#a78bfa" strokeWidth="1.5"/>
      <rect x="8" y="8" width="32" height="8" rx="2" fill="#4c1d95"/>
      <rect x="8" y="18" width="32" height="8" rx="2" fill="#4c1d95"/>
      <rect x="8" y="28" width="32" height="8" rx="2" fill="#4c1d95"/>
      <circle cx="34" cy="12" r="2" fill="#10b981"/>
      <circle cx="34" cy="22" r="2" fill="#10b981"/>
      <circle cx="34" cy="32" r="2" fill="#f59e0b"/>
      <rect x="10" y="10" width="16" height="4" rx="1" fill="#6d28d9"/>
      <rect x="10" y="20" width="16" height="4" rx="1" fill="#6d28d9"/>
      <rect x="10" y="30" width="16" height="4" rx="1" fill="#6d28d9"/>
    </svg>
  ),
  switch: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="4" y="14" width="40" height="20" rx="3" fill="#0891b2" stroke="#22d3ee" strokeWidth="1.5"/>
      <rect x="6" y="16" width="36" height="16" rx="2" fill="#0e4f5e"/>
      {[0,1,2,3,4,5,6,7].map(i => (
        <rect key={i} x={8 + i*4} y="20" width="3" height="5" rx="0.5" fill="#0891b2"/>
      ))}
      {[0,1,2,3,4,5,6,7].map(i => (
        <circle key={i} cx={9.5 + i*4} cy="27" r="1" fill={i % 3 === 0 ? "#10b981" : "#0891b2"}/>
      ))}
      <circle cx="38" cy="18" r="2" fill="#10b981"/>
    </svg>
  ),
  router: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="4" y="16" width="40" height="16" rx="3" fill="#059669" stroke="#34d399" strokeWidth="1.5"/>
      <rect x="6" y="18" width="36" height="12" rx="2" fill="#064e3b"/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={10 + i*7} y="21" width="5" height="3" rx="0.5" fill="#059669"/>
      ))}
      {[0,1,2,3].map(i => (
        <circle key={i} cx={12.5 + i*7} cy="26" r="1" fill={i % 2 === 0 ? "#10b981" : "#059669"}/>
      ))}
      <line x1="14" y1="16" x2="10" y2="8" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="16" x2="24" y2="6" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
      <line x1="34" y1="16" x2="38" y2="8" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="10" cy="7" r="2" fill="#34d399"/>
      <circle cx="24" cy="5" r="2" fill="#34d399"/>
      <circle cx="38" cy="7" r="2" fill="#34d399"/>
    </svg>
  ),
  printer: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="10" y="6" width="28" height="14" rx="2" fill="#374151"/>
      <rect x="4" y="18" width="40" height="20" rx="3" fill="#374151" stroke="#6b7280" strokeWidth="1.5"/>
      <rect x="6" y="20" width="36" height="16" rx="2" fill="#1f2937"/>
      <rect x="12" y="30" width="24" height="12" rx="1" fill="#374151"/>
      <rect x="14" y="33" width="20" height="2" rx="1" fill="#d1d5db"/>
      <rect x="14" y="37" width="14" height="2" rx="1" fill="#d1d5db"/>
      <circle cx="36" cy="24" r="2" fill="#10b981"/>
      <rect x="16" y="10" width="16" height="2" rx="1" fill="#4b5563"/>
      <rect x="16" y="14" width="10" height="2" rx="1" fill="#4b5563"/>
    </svg>
  ),
  ap_wifi: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="10" y="30" width="28" height="12" rx="3" fill="#d97706" stroke="#fbbf24" strokeWidth="1.5"/>
      <rect x="12" y="32" width="24" height="8" rx="2" fill="#78350f"/>
      <path d="M8 24 Q24 12 40 24" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M13 28 Q24 18 35 28" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="24" cy="31" r="2.5" fill="#fbbf24"/>
      <circle cx="36" cy="34" r="1.5" fill="#10b981"/>
      <line x1="24" y1="20" x2="24" y2="30" stroke="#fbbf24" strokeWidth="1.5"/>
    </svg>
  ),
  phone: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="12" y="3" width="24" height="42" rx="4" fill="#ec4899" stroke="#f9a8d4" strokeWidth="1.5"/>
      <rect x="14" y="5" width="20" height="32" rx="2" fill="#831843"/>
      <circle cx="24" cy="41" r="2.5" fill="#f9a8d4"/>
      <rect x="19" y="7" width="10" height="2" rx="1" fill="#ec4899"/>
      <rect x="16" y="12" width="7" height="4" rx="1" fill="#ec4899" opacity="0.8"/>
      <rect x="25" y="12" width="7" height="4" rx="1" fill="#ec4899" opacity="0.8"/>
      <rect x="16" y="18" width="7" height="4" rx="1" fill="#ec4899" opacity="0.8"/>
      <rect x="25" y="18" width="7" height="4" rx="1" fill="#ec4899" opacity="0.8"/>
      <rect x="16" y="24" width="7" height="4" rx="1" fill="#ec4899" opacity="0.8"/>
      <rect x="25" y="24" width="7" height="4" rx="1" fill="#ec4899" opacity="0.8"/>
      <rect x="16" y="30" width="16" height="4" rx="1" fill="#f472b6" opacity="0.9"/>
    </svg>
  ),
  unknown: ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <rect x="6" y="6" width="36" height="36" rx="4" fill="#4b5563" stroke="#6b7280" strokeWidth="1.5"/>
      <text x="24" y="32" textAnchor="middle" fill="#9ca3af" fontSize="24" fontWeight="bold">?</text>
    </svg>
  ),
};

interface DeviceIconProps {
  type: DeviceType;
  size?: number;
  className?: string;
}

export function DeviceIcon({ type, size = 32, className = '' }: DeviceIconProps) {
  const IconComponent = icons[type] || icons.unknown;
  return <IconComponent size={size} className={className} />;
}

export const DEVICE_COLORS: Record<DeviceType, string> = {
  desktop: '#3b82f6',
  server: '#7c3aed',
  switch: '#0891b2',
  router: '#059669',
  printer: '#6b7280',
  ap_wifi: '#d97706',
  phone:   '#ec4899',
  unknown: '#4b5563',
};

export const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: 'Desktop / PC',
  server:  'Server',
  switch:  'Switch',
  router:  'Router',
  printer: 'Printer',
  ap_wifi: 'Access Point (WiFi)',
  phone:   'IP Phone / VoIP',
  unknown: 'Unknown',
};

export const ALL_DEVICE_TYPES: DeviceType[] = [
  'desktop', 'server', 'switch', 'router', 'printer', 'ap_wifi', 'phone', 'unknown'
];
