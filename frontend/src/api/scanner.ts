import client from './client';
import { ScanJob } from '../types';

export interface TopologyConnection {
  source: string;
  target: string;
  type: string;
  method: string;
  confidence: number;
  label?: string;
}

export interface TopologyResult {
  connections: TopologyConnection[];
  neighbor_data: any[];
  mac_tables: Record<string, any>;
  methods_used: string[];
  stats: {
    total_connections: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    lldp_cdp_neighbors: number;
  };
}

export interface ScanResult {
  devices: any[];
  topology: TopologyResult | null;
  ranges_scanned: string[];
}

export const scannerApi = {
  getNetworkRanges: async () => {
    const res = await client.get('/scanner/network-ranges');
    return res.data as { ranges: string[] };
  },

  parseRanges: async (input: string) => {
    const res = await client.post('/scanner/parse-ranges', { input });
    return res.data as { ranges: string[]; count: number; estimated_hosts: number; valid: boolean };
  },

  startScan: async (options: {
    ip_range: string;
    scan_type?: string;
    run_topology?: boolean;
    snmp_communities?: string[];
    use_traceroute?: boolean;
  }) => {
    const res = await client.post('/scanner/start', {
      ip_range: options.ip_range,
      scan_type: options.scan_type || 'basic',
      run_topology: options.run_topology || false,
      snmp_communities: options.snmp_communities || null,
      use_traceroute: options.use_traceroute !== false,
    });
    return res.data as ScanJob;
  },

  runTopology: async (devices: any[], options?: {
    snmp_communities?: string[];
    use_traceroute?: boolean;
  }) => {
    const res = await client.post('/scanner/topology', {
      devices,
      snmp_communities: options?.snmp_communities || ['public', 'private'],
      use_traceroute: options?.use_traceroute !== false,
    });
    return res.data as { job_id: number; status: string };
  },

  getTopologyResult: async (job_id: number) => {
    const res = await client.get(`/scanner/topology/${job_id}`);
    return res.data as {
      progress: number;
      message: string;
      status: string;
      result?: TopologyResult;
    };
  },

  listJobs: async () => {
    const res = await client.get('/scanner/jobs');
    return res.data as ScanJob[];
  },

  getJob: async (id: number) => {
    const res = await client.get(`/scanner/jobs/${id}`);
    return res.data as ScanJob;
  },

  getJobProgress: async (id: number) => {
    const res = await client.get(`/scanner/jobs/${id}/progress`);
    return res.data as {
      status: string;
      progress: number;
      message: string;
      results_count: number;
      topology_connections: number;
    };
  },

  deleteJob: async (id: number) => {
    await client.delete(`/scanner/jobs/${id}`);
  },

  ping: async (host: string, count: number = 4) => {
    const res = await client.post('/scanner/tools/ping', { host, count });
    return res.data as { output: string; success: boolean };
  },

  traceroute: async (host: string) => {
    const res = await client.post('/scanner/tools/traceroute', { host });
    return res.data as { output: string; success: boolean };
  },

  dns: async (host: string) => {
    const res = await client.post('/scanner/tools/dns', { host });
    return res.data as { output: string; ip: string; hostname: string; success: boolean };
  },

  portScan: async (host: string, ports: string = '1-1024') => {
    const res = await client.post('/scanner/tools/portscan', { host, ports });
    return res.data as { output: string; open_ports: number[]; scanned: number; success: boolean };
  },
};
