import { create } from 'zustand';
import { DiagramNode, DiagramEdge, ViewMode } from '../types';
import { projectsApi } from '../api/projects';
import toast from 'react-hot-toast';

interface DiagramState {
  projectId: number | null;
  projectName: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewMode: ViewMode;
  selectedNodeId: string | null;
  isDirty: boolean;
  isSaving: boolean;

  setProject: (id: number, name: string, nodes: DiagramNode[], edges: DiagramEdge[]) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedNode: (id: string | null) => void;
  addNode: (node: DiagramNode) => void;
  updateNode: (id: string, data: Partial<DiagramNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: DiagramEdge) => void;
  updateEdge: (id: string, data: Partial<DiagramEdge>) => void;
  removeEdge: (id: string) => void;
  importDevices: (devices: DiagramNode[]) => void;
  autoLayout: () => void;
  autoConnect: () => void;
  save: () => Promise<void>;
  clearDiagram: () => void;
}

function autoLayoutNodes(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  // When edges exist, use a tree/hierarchical layout based on connectivity
  if (edges.length > 0) {
    return treeLayout(nodes, edges);
  }

  // No edges yet — fall back to pure device-type layering
  return typeLayerLayout(nodes);
}

/**
 * Hierarchical BFS tree layout.
 * Roots are nodes with no parents (or with lowest type rank).
 * Each level is spread horizontally; large levels wrap into multiple rows.
 */
function treeLayout(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramNode[] {
  const TYPE_RANK: Record<string, number> = {
    router: 0, switch: 1, ap_wifi: 2, server: 3, printer: 4, phone: 4, desktop: 5, unknown: 6,
  };

  // Build directed adjacency from edges
  const childMap: Record<string, string[]> = {};
  const parentMap: Record<string, string[]> = {};
  nodes.forEach((n) => { childMap[n.id] = []; parentMap[n.id] = []; });
  edges.forEach((e) => {
    childMap[e.source]?.push(e.target);
    parentMap[e.target]?.push(e.source);
  });

  // Roots: nodes that have no parents
  let roots = nodes.filter((n) => parentMap[n.id].length === 0);
  if (roots.length === 0) roots = nodes; // fully circular — treat all as roots

  // Sort roots by device type rank so routers come first
  roots = [...roots].sort(
    (a, b) => (TYPE_RANK[a.type || ''] ?? 6) - (TYPE_RANK[b.type || ''] ?? 6),
  );

  // BFS to assign depth levels
  const level = new Map<string, number>();
  const queue: string[] = [];
  roots.forEach((r) => { level.set(r.id, 0); queue.push(r.id); });

  while (queue.length > 0) {
    const id = queue.shift()!;
    const lvl = level.get(id)!;
    for (const childId of childMap[id]) {
      if (!level.has(childId)) {
        level.set(childId, lvl + 1);
        queue.push(childId);
      }
    }
  }

  // Nodes never reached by BFS → place at deepest level + 1
  const maxLvl = Math.max(0, ...level.values());
  nodes.forEach((n) => { if (!level.has(n.id)) level.set(n.id, maxLvl + 1); });

  // Group ids by level
  const levelGroups = new Map<number, string[]>();
  nodes.forEach((n) => {
    const lvl = level.get(n.id)!;
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl)!.push(n.id);
  });

  const positions: Record<string, { x: number; y: number; z: number }> = {};
  const SPACING_X = 160;
  const SPACING_Y = 200;
  const MAX_PER_ROW = 12;
  const CENTER_X = 500;

  levelGroups.forEach((ids, lvl) => {
    const rows: string[][] = [];
    for (let i = 0; i < ids.length; i += MAX_PER_ROW) {
      rows.push(ids.slice(i, i + MAX_PER_ROW));
    }
    rows.forEach((row, rowIdx) => {
      const totalW = (row.length - 1) * SPACING_X;
      const startX = CENTER_X - totalW / 2;
      row.forEach((id, colIdx) => {
        positions[id] = {
          x: startX + colIdx * SPACING_X,
          y: 100 + lvl * SPACING_Y + rowIdx * (SPACING_Y * 0.6),
          z: Math.max(0, (4 - lvl)) * 100,
        };
      });
    });
  });

  return nodes.map((n) => ({
    ...n,
    x: positions[n.id]?.x ?? n.x,
    y: positions[n.id]?.y ?? n.y,
    z: positions[n.id]?.z ?? n.z,
  }));
}

/** Simple device-type layered layout (no edges). Wraps wide layers into rows. */
function typeLayerLayout(nodes: DiagramNode[]): DiagramNode[] {
  const TYPE_ORDER = ['router', 'switch', 'ap_wifi', 'server', 'phone', 'printer', 'desktop', 'unknown'];
  const LAYER_Y: Record<string, number> = {
    router: 100, switch: 280, ap_wifi: 460, server: 460,
    phone: 640, printer: 640, desktop: 820, unknown: 1000,
  };
  const LAYER_Z: Record<string, number> = {
    router: 300, switch: 200, ap_wifi: 100, server: 100,
    phone: 0, printer: 0, desktop: 0, unknown: 0,
  };

  const groups: Record<string, string[]> = {};
  TYPE_ORDER.forEach((t) => { groups[t] = []; });
  nodes.forEach((n) => {
    const t = n.type || 'unknown';
    (groups[t] ?? (groups['unknown'] ??= [])).push(n.id);
  });

  const positions: Record<string, { x: number; y: number; z: number }> = {};
  const SPACING_X = 160;
  const MAX_PER_ROW = 12;
  const CENTER_X = 500;

  TYPE_ORDER.forEach((layer) => {
    const ids = groups[layer] || [];
    const rows: string[][] = [];
    for (let i = 0; i < ids.length; i += MAX_PER_ROW) {
      rows.push(ids.slice(i, i + MAX_PER_ROW));
    }
    rows.forEach((row, rowIdx) => {
      const totalW = (row.length - 1) * SPACING_X;
      const startX = CENTER_X - totalW / 2;
      row.forEach((id, colIdx) => {
        positions[id] = {
          x: startX + colIdx * SPACING_X,
          y: LAYER_Y[layer] + rowIdx * 140,
          z: LAYER_Z[layer],
        };
      });
    });
  });

  return nodes.map((n) => ({
    ...n,
    x: positions[n.id]?.x ?? n.x,
    y: positions[n.id]?.y ?? n.y,
    z: positions[n.id]?.z ?? n.z,
  }));
}

/**
 * Auto-connect logic: creates edges based on network topology hierarchy.
 *
 * Hierarchy (per /24 subnet):
 *   Core:    Routers interconnect via WAN
 *   Distrib: Routers → Switches in same subnet
 *            Switches without local router → nearest global router
 *   Access:  Switches/Routers → APs (wifi link)
 *            Switches/Routers → Endpoints (nearest by IP)
 *
 * When no explicit infrastructure is found, "gateway inference" kicks in:
 *   - IPs ending in .1 or .254 are treated as implicit gateways
 *   - Remaining devices connect to the nearest inferred gateway
 *   - For large flat subnets (>8 endpoints, no infra), a two-level
 *     clustered star is built: gateway → cluster-heads → members
 */
function buildAutoEdges(nodes: DiagramNode[], existingEdges: DiagramEdge[]): DiagramEdge[] {
  const taken = new Set<string>();
  existingEdges.forEach((e) => {
    taken.add(`${e.source}|${e.target}`);
    taken.add(`${e.target}|${e.source}`);
  });

  const newEdges: DiagramEdge[] = [];

  const addEdge = (src: string, tgt: string, type: DiagramEdge['type'] = 'ethernet') => {
    if (!src || !tgt || src === tgt) return;
    if (taken.has(`${src}|${tgt}`)) return;
    taken.add(`${src}|${tgt}`);
    taken.add(`${tgt}|${src}`);
    newEdges.push({
      id: `auto-${src}-${tgt}-${Math.random().toString(36).slice(2, 6)}`,
      source: src, target: tgt, type, label: '',
    });
  };

  // IP helpers
  const ipToNum = (ip: string) =>
    (ip || '').split('.').reduce((acc, o) => acc * 256 + (parseInt(o) || 0), 0);
  const lastOctet = (ip: string) => parseInt((ip || '').split('.')[3] || '0');

  /** Returns the candidate from `pool` whose IP is numerically closest to `node`. */
  const nearest = (node: DiagramNode, pool: DiagramNode[]): DiagramNode | null => {
    if (!pool.length) return null;
    const n = ipToNum(node.ip || '');
    return pool.reduce((best, c) =>
      Math.abs(ipToNum(c.ip || '') - n) < Math.abs(ipToNum(best.ip || '') - n) ? c : best
    );
  };

  // Global device-type buckets
  const allRouters  = nodes.filter((n) => n.type === 'router');
  const allSwitches = nodes.filter((n) => n.type === 'switch');
  const allAPs      = nodes.filter((n) => n.type === 'ap_wifi');
  const allEndpoints = nodes.filter((n) =>
    ['desktop', 'server', 'printer', 'phone', 'unknown'].includes(n.type || ''));

  // Group by /24 subnet
  const subnetMap: Record<string, DiagramNode[]> = {};
  const noSubnet: DiagramNode[] = [];
  nodes.forEach((node) => {
    const p = node.ip?.split('.');
    if (p?.length === 4) {
      const sn = `${p[0]}.${p[1]}.${p[2]}`;
      (subnetMap[sn] ??= []).push(node);
    } else {
      noSubnet.push(node);
    }
  });

  // ── CORE: routers interconnect via WAN ────────────────────────────────
  if (allRouters.length > 1) {
    for (let i = 0; i < allRouters.length - 1; i++) {
      addEdge(allRouters[i].id, allRouters[i + 1].id, 'wan');
    }
  }

  // ── DISTRIBUTION: per-subnet backbone ────────────────────────────────
  Object.entries(subnetMap).forEach(([, snNodes]) => {
    const snRouters  = snNodes.filter((n) => n.type === 'router');
    const snSwitches = snNodes.filter((n) => n.type === 'switch');

    // Routers → switches in the same subnet
    if (snRouters.length > 0 && snSwitches.length > 0) {
      snRouters.forEach((r) => snSwitches.forEach((s) => addEdge(r.id, s.id)));
    }

    // Switches without a local router → connect to nearest global router
    if (snRouters.length === 0 && snSwitches.length > 0 && allRouters.length > 0) {
      snSwitches.forEach((s) => {
        const nr = nearest(s, allRouters);
        if (nr) addEdge(nr.id, s.id);
      });
    }

    // Chain extra switches within the subnet to the first switch
    if (snSwitches.length > 1) {
      snSwitches.slice(1).forEach((s) => addEdge(snSwitches[0].id, s.id));
    }
  });

  // ── ACCESS: APs connect to nearest switch (wifi), else nearest router ─
  allAPs.forEach((ap) => {
    const p = ap.ip?.split('.');
    const sn = p?.length === 4 ? `${p[0]}.${p[1]}.${p[2]}` : null;
    const snSwitches = sn ? (subnetMap[sn] || []).filter((n) => n.type === 'switch') : [];
    const snRouters  = sn ? (subnetMap[sn] || []).filter((n) => n.type === 'router') : [];
    const gw =
      nearest(ap, snSwitches) ??
      nearest(ap, snRouters)  ??
      nearest(ap, [...allSwitches, ...allRouters]);
    if (gw) addEdge(gw.id, ap.id, 'wifi');
  });

  // ── ACCESS: endpoints connect to nearest switch/router in their subnet ─
  allEndpoints.forEach((ep) => {
    const p = ep.ip?.split('.');
    const sn = p?.length === 4 ? `${p[0]}.${p[1]}.${p[2]}` : null;
    const snSwitches = sn ? (subnetMap[sn] || []).filter((n) => n.type === 'switch') : [];
    const snRouters  = sn ? (subnetMap[sn] || []).filter((n) => n.type === 'router') : [];

    const target =
      nearest(ep, snSwitches) ??   // 1. switch in same subnet (nearest)
      nearest(ep, snRouters)  ??   // 2. router in same subnet
      nearest(ep, allSwitches) ??  // 3. any switch in the network
      nearest(ep, allRouters);     // 4. any router in the network
    if (target) addEdge(target.id, ep.id);
  });

  // ── FALLBACK: subnets with no infrastructure at all ───────────────────
  const hasInfra = allRouters.length > 0 || allSwitches.length > 0;
  if (!hasInfra) {
    Object.values(subnetMap).forEach((snNodes) => {
      if (snNodes.length < 2) return;

      // Sort by IP numerically
      const sorted = [...snNodes].sort((a, b) => ipToNum(a.ip || '') - ipToNum(b.ip || ''));

      // Prefer a node whose last octet is .1 or .254 as the gateway
      const gwNode =
        sorted.find((n) => lastOctet(n.ip || '') === 1) ??
        sorted.find((n) => lastOctet(n.ip || '') === 254) ??
        sorted[0];

      const others = sorted.filter((n) => n.id !== gwNode.id);

      if (others.length <= 10) {
        // Small subnet: simple star from gateway
        others.forEach((n) => addEdge(gwNode.id, n.id));
      } else {
        // Large subnet: two-level clustered star
        // gateway → cluster-head → members  (groups of ~8)
        const clusterSize = Math.max(4, Math.ceil(Math.sqrt(others.length)));
        for (let i = 0; i < others.length; i += clusterSize) {
          const cluster = others.slice(i, i + clusterSize);
          const head = cluster[0];          // first of each group becomes sub-hub
          addEdge(gwNode.id, head.id);
          cluster.slice(1).forEach((n) => addEdge(head.id, n.id));
        }
      }
    });
  }

  // ── No-IP nodes → attach to first available infrastructure ────────────
  if (noSubnet.length > 0) {
    const anchor = allSwitches[0] ?? allRouters[0];
    if (anchor) noSubnet.filter((n) => n.id !== anchor.id).forEach((n) => addEdge(anchor.id, n.id));
  }

  return newEdges;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  projectId: null,
  projectName: '',
  nodes: [],
  edges: [],
  viewMode: '2d',
  selectedNodeId: null,
  isDirty: false,
  isSaving: false,

  setProject: (id, name, nodes, edges) =>
    set({ projectId: id, projectName: name, nodes, edges, isDirty: false }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node], isDirty: true })),

  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...data } : n)),
      isDirty: true,
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      isDirty: true,
    })),

  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge], isDirty: true })),

  updateEdge: (id, data) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...data } : e)),
      isDirty: true,
    })),

  removeEdge: (id) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      isDirty: true,
    })),

  importDevices: (devices) => {
    const { nodes } = get();
    const existingIps = new Set(nodes.map((n) => n.ip));
    const newNodes = devices.filter((d) => !existingIps.has(d.ip));
    const allNodes = autoLayoutNodes([...nodes, ...newNodes], get().edges);
    set({ nodes: allNodes, isDirty: true });
    toast.success(`${newNodes.length} devices imported`);
  },

  autoLayout: () => {
    const { nodes, edges } = get();
    set({ nodes: autoLayoutNodes(nodes, edges), isDirty: true });
  },

  autoConnect: () => {
    const { nodes, edges } = get();
    if (nodes.length < 2) {
      toast('Need at least 2 devices to auto-connect');
      return;
    }
    const newEdges = buildAutoEdges(nodes, edges);
    if (newEdges.length === 0) {
      toast(edges.length > 0 ? 'All connections already exist' : 'No connections could be inferred from current device types');
      return;
    }
    const allEdges = [...edges, ...newEdges];
    // Re-run hierarchical layout using the new edges so the diagram
    // immediately shows the tree structure (routers top → switches → endpoints)
    const laid = autoLayoutNodes(nodes, allEdges);
    set({ nodes: laid, edges: allEdges, isDirty: true });
    toast.success(`${newEdges.length} connections created — layout updated`);
  },

  save: async () => {
    const { projectId, nodes, edges } = get();
    if (!projectId) return;
    set({ isSaving: true });
    try {
      await projectsApi.update(projectId, {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      });
      set({ isDirty: false, isSaving: false });
      toast.success('Project saved');
    } catch {
      set({ isSaving: false });
      toast.error('Error saving project');
    }
  },

  clearDiagram: () => set({ nodes: [], edges: [], isDirty: true }),
}));
