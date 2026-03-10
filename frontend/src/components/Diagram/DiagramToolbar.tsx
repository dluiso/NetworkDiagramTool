import { useState } from 'react';
import {
  Save, Download, Plus, LayoutGrid, RefreshCw, Link, FileImage, FileText, Zap
} from 'lucide-react';
import { useDiagramStore } from '../../store/diagramStore';
import { ViewMode } from '../../types';
import { Modal } from '../shared/Modal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

interface Props {
  onAddDevice: () => void;
  onAddConnection: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function DiagramToolbar({ onAddDevice, onAddConnection, containerRef }: Props) {
  const {
    viewMode, setViewMode, save, isSaving, isDirty,
    autoLayout, autoConnect, clearDiagram, nodes, projectName,
  } = useDiagramStore();
  const [exportModal, setExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const views: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'flat', label: 'Flat', icon: '⊞' },
    { id: '2d',   label: '2D',   icon: '◈' },
    { id: '3d',   label: '3D',   icon: '◉' },
  ];

  const handleExportPNG = async (scale: number = 2) => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, {
        scale,
        backgroundColor: '#0f172a',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${projectName || 'diagram'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('PNG exported');
    } catch {
      toast.error('Error exporting PNG');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async (scale: number = 3) => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, {
        scale,
        backgroundColor: '#0f172a',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width / scale, canvas.height / scale],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / scale, canvas.height / scale);
      pdf.save(`${projectName || 'diagram'}.pdf`);
      toast.success('PDF exported');
    } catch {
      toast.error('Error exporting PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-800 border-b border-surface-700">
        {/* View mode */}
        <div className="flex items-center gap-0.5 bg-surface-700 rounded-lg p-0.5">
          {views.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-surface-600" />

        {/* Actions */}
        <button onClick={onAddDevice} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
          <Plus size={14} />
          Device
        </button>
        <button onClick={onAddConnection} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
          <Link size={14} />
          Connection
        </button>
        <button
          onClick={autoLayout}
          className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3"
          title="Arrange devices in a hierarchical layout"
        >
          <LayoutGrid size={14} />
          Auto Layout
        </button>
        <button
          onClick={autoConnect}
          className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3 text-brand-400 border border-brand-700/40"
          title="Auto-create connections based on network topology (router → switch → endpoints)"
        >
          <Zap size={14} />
          Auto-Connect
        </button>

        <div className="flex-1" />

        <span className="text-xs text-slate-500">
          {nodes.length} nodes
        </span>

        {isDirty && <span className="text-xs text-yellow-500">● Unsaved</span>}

        <div className="w-px h-6 bg-surface-600" />

        <button onClick={() => setExportModal(true)} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
          <Download size={14} />
          Export
        </button>

        <button
          onClick={save}
          disabled={isSaving}
          className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
        >
          {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Export modal */}
      <Modal isOpen={exportModal} onClose={() => setExportModal(false)} title="Export Diagram" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Select export format:</p>

          <div className="space-y-2">
            <button
              onClick={() => { handleExportPNG(2); setExportModal(false); }}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-left"
            >
              <FileImage size={20} className="text-blue-400" />
              <div>
                <div className="text-sm font-medium text-white">PNG — Screen (2x)</div>
                <div className="text-xs text-slate-500">For digital sharing</div>
              </div>
            </button>

            <button
              onClick={() => { handleExportPNG(4); setExportModal(false); }}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-left"
            >
              <FileImage size={20} className="text-green-400" />
              <div>
                <div className="text-sm font-medium text-white">PNG — High Resolution (4x)</div>
                <div className="text-xs text-slate-500">For A3/A2 print</div>
              </div>
            </button>

            <button
              onClick={() => { handleExportPNG(8); setExportModal(false); }}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-left"
            >
              <FileImage size={20} className="text-yellow-400" />
              <div>
                <div className="text-sm font-medium text-white">PNG — Maximum Resolution (8x)</div>
                <div className="text-xs text-slate-500">For A1/A0 / plotter print</div>
              </div>
            </button>

            <button
              onClick={() => { handleExportPDF(3); setExportModal(false); }}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-left"
            >
              <FileText size={20} className="text-red-400" />
              <div>
                <div className="text-sm font-medium text-white">PDF</div>
                <div className="text-xs text-slate-500">Compatible with all PDF viewers</div>
              </div>
            </button>
          </div>

          {exporting && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <RefreshCw size={14} className="animate-spin" />
              Exporting...
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
