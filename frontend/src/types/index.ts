export type DeviceType =
  | 'desktop'
  | 'server'
  | 'switch'
  | 'router'
  | 'printer'
  | 'ap_wifi'
  | 'phone'
  | 'unknown';

export interface Device {
  id: string;
  ip: string;
  hostname: string;
  mac: string;
  vendor: string;
  device_type: DeviceType;
  open_ports: number[];
  status: 'online' | 'offline' | 'unknown';
  custom_name: string;
  custom_type: string;
  notes: string;
  os_info?: string;
}

export interface DiagramNode {
  id: string;
  type: DeviceType;
  label: string;
  ip: string;
  hostname: string;
  mac: string;
  vendor: string;
  open_ports: number[];
  custom_name: string;
  custom_type: string;
  notes: string;
  status: string;
  x: number;
  y: number;
  z: number;
  color?: string;
  group?: string;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'ethernet' | 'wifi' | 'fiber' | 'wan' | 'vpn';
  bandwidth?: string;
  color?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  nodes: string;
  edges: string;
  settings: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
  owner_id: number;
}

export interface ScanJob {
  id: number;
  ip_range: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
  permissions: string[];
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  user_count: number;
}

export interface AdminStats {
  total_users: number;
  pending_approval: number;
  active_users: number;
  inactive_users: number;
  total_groups: number;
}

export interface ConfigEntry {
  key: string;
  value: string | null;
  description: string | null;
}

export type ViewMode = 'flat' | '2d' | '3d';

export type Permission =
  | 'dashboard'
  | 'scanner'
  | 'projects'
  | 'tools'
  | 'profile'
  | 'admin'
  | 'users'
  | 'groups'
  | 'config';
