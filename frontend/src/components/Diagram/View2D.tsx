import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { useDiagramStore } from '../../store/diagramStore';
import { useThemeStore } from '../../store/themeStore';
import { DEVICE_COLORS, DEVICE_LABELS } from '../shared/DeviceIcon';
import { DeviceType } from '../../types';

// SVG icon generators for Cytoscape nodes
const getSVGForType = (type: DeviceType, color: string): string => {
  const icons: Record<DeviceType, string> = {
    desktop: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='4' y='6' width='40' height='28' rx='3' fill='${color}' opacity='0.9'/><rect x='14' y='34' width='20' height='4' fill='${color}' opacity='0.7'/><rect x='10' y='38' width='28' height='3' rx='1.5' fill='${color}' opacity='0.7'/><rect x='6' y='8' width='36' height='24' rx='2' fill='%230f172a'/><circle cx='24' cy='20' r='6' fill='${color}' opacity='0.3'/></svg>`,
    server: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='6' y='4' width='36' height='40' rx='3' fill='${color}' opacity='0.9'/><rect x='8' y='8' width='32' height='8' rx='2' fill='%230f172a' opacity='0.7'/><rect x='8' y='18' width='32' height='8' rx='2' fill='%230f172a' opacity='0.7'/><rect x='8' y='28' width='32' height='8' rx='2' fill='%230f172a' opacity='0.7'/><circle cx='34' cy='12' r='2' fill='%2310b981'/><circle cx='34' cy='22' r='2' fill='%2310b981'/></svg>`,
    switch: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='4' y='14' width='40' height='20' rx='3' fill='${color}' opacity='0.9'/><rect x='6' y='16' width='36' height='16' rx='2' fill='%230e4f5e'/><rect x='8' y='20' width='3' height='5' rx='0.5' fill='${color}'/><rect x='12' y='20' width='3' height='5' rx='0.5' fill='${color}'/><rect x='16' y='20' width='3' height='5' rx='0.5' fill='${color}'/><rect x='20' y='20' width='3' height='5' rx='0.5' fill='${color}'/><circle cx='9.5' cy='27' r='1' fill='%2310b981'/></svg>`,
    router: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='4' y='16' width='40' height='16' rx='3' fill='${color}' opacity='0.9'/><rect x='6' y='18' width='36' height='12' rx='2' fill='%23064e3b'/><line x1='14' y1='16' x2='10' y2='8' stroke='${color}' stroke-width='2' stroke-linecap='round'/><line x1='24' y1='16' x2='24' y2='6' stroke='${color}' stroke-width='2' stroke-linecap='round'/><line x1='34' y1='16' x2='38' y2='8' stroke='${color}' stroke-width='2' stroke-linecap='round'/><circle cx='10' cy='7' r='2.5' fill='${color}'/><circle cx='24' cy='5' r='2.5' fill='${color}'/><circle cx='38' cy='7' r='2.5' fill='${color}'/></svg>`,
    printer: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='10' y='6' width='28' height='14' rx='2' fill='%23374151'/><rect x='4' y='18' width='40' height='20' rx='3' fill='${color}' opacity='0.9'/><rect x='12' y='30' width='24' height='12' rx='1' fill='%23374151'/><rect x='14' y='33' width='20' height='2' rx='1' fill='%23d1d5db'/></svg>`,
    ap_wifi: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='10' y='30' width='28' height='12' rx='3' fill='${color}' opacity='0.9'/><path d='M8 24 Q24 12 40 24' stroke='${color}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M13 28 Q24 18 35 28' stroke='${color}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='24' cy='31' r='2.5' fill='${color}'/></svg>`,
    phone:   `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='12' y='3' width='24' height='42' rx='4' fill='${color}' opacity='0.9'/><rect x='14' y='5' width='20' height='32' rx='2' fill='%23831843'/><circle cx='24' cy='41' r='2.5' fill='${color}'/><rect x='16' y='12' width='7' height='4' rx='1' fill='${color}' opacity='0.8'/><rect x='25' y='12' width='7' height='4' rx='1' fill='${color}' opacity='0.8'/><rect x='16' y='18' width='7' height='4' rx='1' fill='${color}' opacity='0.8'/><rect x='25' y='18' width='7' height='4' rx='1' fill='${color}' opacity='0.8'/><rect x='16' y='30' width='16' height='4' rx='1' fill='${color}' opacity='0.9'/></svg>`,
    unknown: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect x='6' y='6' width='36' height='36' rx='4' fill='${color}' opacity='0.7'/><text x='24' y='33' text-anchor='middle' fill='white' font-size='24' font-weight='bold'>?</text></svg>`,
  };
  return `data:image/svg+xml;charset=utf-8,${icons[type] || icons.unknown}`;
};

export function View2D({ onNodeClick }: { onNodeClick: (id: string) => void }) {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const { nodes, edges, selectedNodeId, setSelectedNode, updateNode, addEdge } = useDiagramStore();
  const { theme } = useThemeStore();

  const isConnecting = useRef(false);
  const connectSource = useRef<string | null>(null);

  const buildElements = useCallback(() => {
    const cyNodes = nodes.map(n => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        label: n.custom_name || n.hostname || n.ip || n.label,
        type: n.type,
        ip: n.ip,
        nodeData: n,
      },
      position: { x: n.x || 200, y: n.y || 200 },
    }));

    const cyEdges = edges.map(e => ({
      group: 'edges' as const,
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || e.type,
        type: e.type,
      },
    }));

    return [...cyNodes, ...cyEdges];
  }, [nodes, edges]);

  useEffect(() => {
    if (!cyRef.current) return;

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements: buildElements(),
      style: [
        {
          selector: 'node',
          style: {
            'width': 52,
            'height': 52,
            'background-image': (ele: any) => {
              const type = ele.data('type') as DeviceType;
              const color = encodeURIComponent(DEVICE_COLORS[type] || DEVICE_COLORS.unknown);
              return getSVGForType(type, color);
            },
            'background-fit': 'cover',
            'background-color': 'transparent',
            'border-width': 2,
            'border-color': (ele: any) => DEVICE_COLORS[ele.data('type') as DeviceType] || '#4b5563',
            'border-opacity': 0.6,
            'label': 'data(label)',
            'font-size': 10,
            'color': '#94a3b8',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'text-max-width': 90,
            'text-wrap': 'ellipsis',
          } as any,
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#6366f1',
            'border-width': 3,
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': 8,
            'color': '#475569',
            'text-rotation': 'autorotate',
          } as any,
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#6366f1',
            'target-arrow-color': '#6366f1',
          },
        },
      ],
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
    });

    const cy = cyInstance.current;

    // Node click
    cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      setSelectedNode(nodeId);
    });

    cy.on('dblclick dbltap', 'node', (evt) => {
      onNodeClick(evt.target.id());
    });

    // Background click deselects
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedNode(null);
    });

    // Drag to update position
    cy.on('dragfree', 'node', (evt) => {
      const pos = evt.target.position();
      updateNode(evt.target.id(), { x: pos.x, y: pos.y });
    });

    return () => {
      cy.destroy();
      cyInstance.current = null;
    };
  }, []);

  // Update Cytoscape styles when theme changes
  useEffect(() => {
    const cy = cyInstance.current;
    if (!cy) return;
    const isLight = theme === 'light';
    const edgeColor = isLight ? '#94a3b8' : '#334155';
    const nodeTextColor = isLight ? '#334155' : '#94a3b8';
    cy.style()
      .selector('edge').style({ 'line-color': edgeColor, 'target-arrow-color': edgeColor, 'color': '#64748b' })
      .selector('node').style({ 'color': nodeTextColor })
      .update();
  }, [theme]);

  // Update elements when data changes
  useEffect(() => {
    const cy = cyInstance.current;
    if (!cy) return;

    // Update nodes
    nodes.forEach(n => {
      const ele = cy.getElementById(n.id);
      if (ele.length > 0) {
        ele.data('label', n.custom_name || n.hostname || n.ip || n.label);
        ele.data('type', n.type);
        // Update position only if not being dragged
        if (!ele.grabbed()) {
          ele.position({ x: n.x || 200, y: n.y || 200 });
        }
      } else {
        cy.add({
          group: 'nodes',
          data: { id: n.id, label: n.custom_name || n.hostname || n.ip || n.label, type: n.type, ip: n.ip },
          position: { x: n.x || 200, y: n.y || 200 },
        });
      }
    });

    // Remove deleted nodes
    cy.nodes().forEach(ele => {
      if (!nodes.find(n => n.id === ele.id())) cy.remove(ele);
    });

    // Update edges
    edges.forEach(e => {
      if (cy.getElementById(e.id).length === 0) {
        cy.add({
          group: 'edges',
          data: { id: e.id, source: e.source, target: e.target, label: e.label || e.type, type: e.type },
        });
      }
    });

    cy.edges().forEach(ele => {
      if (!edges.find(e => e.id === ele.id())) cy.remove(ele);
    });

    // Sync selection
    cy.elements(':selected').unselect();
    if (selectedNodeId) cy.getElementById(selectedNodeId).select();

  }, [nodes, edges, selectedNodeId]);

  return (
    <div className="relative w-full h-full">
      <div ref={cyRef} className="cy-container w-full h-full" />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          className="w-8 h-8 bg-surface-700 hover:bg-surface-600 rounded-lg text-white flex items-center justify-center text-lg font-bold border border-surface-600"
          onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.2)}
        >+</button>
        <button
          className="w-8 h-8 bg-surface-700 hover:bg-surface-600 rounded-lg text-white flex items-center justify-center text-lg font-bold border border-surface-600"
          onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)}
        >−</button>
        <button
          className="w-8 h-8 bg-surface-700 hover:bg-surface-600 rounded-lg text-slate-300 flex items-center justify-center text-xs border border-surface-600"
          onClick={() => cyInstance.current?.fit(undefined, 40)}
          title="Fit view"
        >⊡</button>
      </div>
      <div className="absolute bottom-3 left-3 text-xs text-slate-600">
        Double-click → edit · Drag → move
      </div>
    </div>
  );
}
