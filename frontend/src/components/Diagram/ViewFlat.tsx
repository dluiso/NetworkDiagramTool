import { useRef, useEffect, useState, useCallback } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import { useThemeStore } from '../../store/themeStore';
import { DEVICE_COLORS } from '../shared/DeviceIcon';
import { DeviceType } from '../../types';

// SVG icons as inline renderers
function drawDeviceIcon(
  ctx: CanvasRenderingContext2D,
  type: DeviceType,
  x: number,
  y: number,
  size: number,
  color: string,
  selected: boolean,
  nodeBg: string,
  detailBg: string,
) {
  const half = size / 2;

  ctx.save();
  ctx.translate(x, y);

  if (selected) {
    ctx.shadowColor = '#6366f1';
    ctx.shadowBlur = 12;
  }

  // Background circle
  ctx.beginPath();
  ctx.arc(0, 0, half + 4, 0, Math.PI * 2);
  ctx.fillStyle = selected ? 'rgba(99,102,241,0.2)' : nodeBg;
  ctx.fill();
  ctx.strokeStyle = selected ? '#6366f1' : color;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Icon body based on type
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (type) {
    case 'desktop':
      // Monitor
      roundRect(ctx, -half + 2, -half + 2, size - 4, size * 0.65, 2);
      ctx.fill();
      ctx.fillStyle = detailBg;
      roundRect(ctx, -half + 4, -half + 4, size - 8, size * 0.55, 1);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(-4, half * 0.25, 8, 3);
      ctx.fillRect(-8, half * 0.5, 16, 2);
      break;

    case 'server':
      // Server rack
      roundRect(ctx, -half + 3, -half + 2, size - 6, size - 4, 2);
      ctx.fill();
      ctx.fillStyle = detailBg;
      for (let i = 0; i < 3; i++) {
        roundRect(ctx, -half + 5, -half + 4 + i * (size / 3.5), size - 10, size / 4.5, 1);
        ctx.fill();
      }
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(half - 6, -half + 8, 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'switch':
      // Flat rectangle with ports
      roundRect(ctx, -half + 2, -8, size - 4, 16, 2);
      ctx.fill();
      ctx.fillStyle = detailBg;
      roundRect(ctx, -half + 4, -6, size - 8, 12, 1);
      ctx.fill();
      ctx.fillStyle = '#10b981';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-half + 6 + i * 5, -3, 3, 4);
      }
      break;

    case 'router':
      // Box with antennas
      roundRect(ctx, -half + 4, -4, size - 8, 12, 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(-10, -half);
      ctx.moveTo(0, -4); ctx.lineTo(0, -half - 2);
      ctx.moveTo(6, -4); ctx.lineTo(10, -half);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-10, -half, 2.5, 0, Math.PI * 2);
      ctx.arc(0, -half - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(10, -half, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'printer':
      // Printer shape
      roundRect(ctx, -half + 4, -half + 8, size - 8, size * 0.35, 2);
      ctx.fill();
      ctx.fillStyle = '#374151';
      roundRect(ctx, -half + 3, -half + 2, size - 6, size * 0.4, 1);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, -half + 6, half * 0.1, size - 12, half * 0.8, 1);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-half + 8, half * 0.25, size - 16, 2);
      ctx.fillRect(-half + 8, half * 0.45, size - 20, 2);
      break;

    case 'ap_wifi':
      // WiFi symbol
      roundRect(ctx, -half + 4, half * 0.2, size - 8, half * 0.7, 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'transparent';
      for (let i = 0; i < 3; i++) {
        const r = (i + 1) * 6;
        ctx.beginPath();
        ctx.arc(0, half * 0.1, r, Math.PI + 0.3, Math.PI * 2 - 0.3);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, half * 0.2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    default:
      // Question mark box
      roundRect(ctx, -half + 2, -half + 2, size - 4, size - 4, 3);
      ctx.fill();
      ctx.fillStyle = detailBg;
      ctx.font = `bold ${size * 0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 2);
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function ViewFlat({ onNodeClick }: { onNodeClick: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { nodes, edges, selectedNodeId, setSelectedNode, updateNode } = useDiagramStore();
  const { theme } = useThemeStore();

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const worldToScreen = useCallback((wx: number, wy: number) => ({
    x: wx * zoomRef.current + panRef.current.x,
    y: wy * zoomRef.current + panRef.current.y,
  }), []);

  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: (sy - panRef.current.y) / zoomRef.current,
  }), []);

  const getNodeAt = useCallback((sx: number, sy: number) => {
    const world = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = world.x - n.x;
      const dy = world.y - n.y;
      if (Math.sqrt(dx * dx + dy * dy) < 28) return n;
    }
    return null;
  }, [nodes, screenToWorld]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;

    const isLight = theme === 'light';
    const BG        = isLight ? '#f1f5f9' : '#0f172a';
    const GRID      = isLight ? '#e2e8f0' : '#1e293b';
    const NODE_BG   = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.6)';
    const DETAIL_BG = isLight ? '#1e293b' : '#0f172a';
    const LABEL     = isLight ? '#334155' : '#94a3b8';
    const IP_CLR    = isLight ? '#64748b' : '#475569';
    const ETHERNET  = isLight ? '#94a3b8' : '#334155';
    const HINT      = isLight ? '#94a3b8' : '#475569';

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);

    // Grid
    const gridSize = 40 * zoom;
    const offsetX = pan.x % gridSize;
    const offsetY = pan.y % gridSize;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 0.5;
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    edges.forEach(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (!src || !tgt) return;

      const edgeColors: Record<string, string> = {
        ethernet: ETHERNET, wifi: '#fbbf24', fiber: '#22d3ee', wan: '#f97316', vpn: '#a78bfa',
      };

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);

      // Curved line
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2 - 20;
      ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y);

      ctx.strokeStyle = edgeColors[edge.type] || ETHERNET;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash(edge.type === 'wifi' || edge.type === 'vpn' ? [6 / zoom, 3 / zoom] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // Edge label
      if (edge.label && edge.type !== 'ethernet') {
        ctx.fillStyle = edgeColors[edge.type] || IP_CLR;
        ctx.font = `${11 / zoom}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, mx, my - 5 / zoom);
      }
    });

    // Draw nodes
    const nodeSize = 24;
    nodes.forEach(node => {
      const color = node.color || DEVICE_COLORS[node.type as DeviceType] || '#4b5563';
      drawDeviceIcon(ctx, node.type as DeviceType, node.x, node.y, nodeSize, color, selectedNodeId === node.id, NODE_BG, DETAIL_BG);

      // Label
      const label = node.custom_name || node.hostname || node.ip || '';
      if (label) {
        ctx.fillStyle = LABEL;
        ctx.font = `11px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, node.x, node.y + nodeSize / 2 + 6);
      }

      // IP label
      if (node.ip && zoom > 0.7) {
        ctx.fillStyle = IP_CLR;
        ctx.font = `10px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.ip, node.x, node.y + nodeSize / 2 + 20);
      }
    });

    ctx.restore();

    // Zoom indicator
    ctx.fillStyle = HINT;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(zoom * 100)}%`, width - 8, height - 8);

  }, [nodes, edges, selectedNodeId, pan, zoom, theme]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const node = getNodeAt(sx, sy);

    if (node) {
      setDragging(node.id);
      setSelectedNode(node.id);
    } else {
      setPanning(true);
      setSelectedNode(null);
    }
    lastMouseRef.current = { x: sx, y: sy };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const dx = sx - lastMouseRef.current.x;
    const dy = sy - lastMouseRef.current.y;
    lastMouseRef.current = { x: sx, y: sy };

    if (dragging) {
      const node = nodes.find(n => n.id === dragging);
      if (node) updateNode(dragging, { x: node.x + dx / zoom, y: node.y + dy / zoom });
    } else if (panning) {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dx = Math.abs(sx - (lastMouseRef.current.x));
      const dy = Math.abs(sy - (lastMouseRef.current.y));
      if (dx < 3 && dy < 3) {
        // single click selects, double click opens edit
      }
    }
    setDragging(null);
    setPanning(false);
  };

  const handleDblClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) onNodeClick(node.id);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(4, z * factor)));
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDblClick}
        onWheel={handleWheel}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button className="w-8 h-8 bg-surface-700 hover:bg-surface-600 rounded-lg text-white flex items-center justify-center text-lg font-bold border border-surface-600"
          onClick={() => setZoom(z => Math.min(4, z * 1.2))}>+</button>
        <button className="w-8 h-8 bg-surface-700 hover:bg-surface-600 rounded-lg text-white flex items-center justify-center text-lg font-bold border border-surface-600"
          onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}>−</button>
        <button className="w-8 h-8 bg-surface-700 hover:bg-surface-600 rounded-lg text-slate-300 flex items-center justify-center text-xs border border-surface-600"
          onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} title="Reset view">⊡</button>
      </div>
      <div className="absolute bottom-3 left-3 text-xs text-slate-600">
        Double-click → edit · Drag → move · Scroll → zoom
      </div>
    </div>
  );
}
