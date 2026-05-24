import { useState, useEffect } from 'react';
import { PancakeDashboard } from './components/dashboard/PancakeDashboard';
import { ImageEngineControls } from './components/dashboard/ImageEngineControls';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FolderOpen, RotateCcw, X, ArrowRight, Cpu, Film } from 'lucide-react';

interface VideoClip {
  sequence_name?: string;
  processed?: boolean;
}

export default function App() {
  const [currentView, setCurrentView] = useState<'setup' | 'editor'>('setup');
  const [sequenceName, setSequenceName] = useState<string>("RAW_BASE_SEQ_AMICI_DONDOLO"); // fallback
  const [hasProcessedOutput, setHasProcessedOutput] = useState<boolean>(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState<boolean>(false);
  const [initialTargetVersion, setInitialTargetVersion] = useState<number | undefined>();

  useEffect(() => {
    const fetchDefaultSequence = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/videos/list');
        const data: { clips?: VideoClip[] } = await res.json();
        if (data.clips && data.clips.length > 0) {
          const processedClip = data.clips.find((c) => c.processed);
          if (processedClip && processedClip.sequence_name) {
            setSequenceName(processedClip.sequence_name);
            setHasProcessedOutput(true);
          } else if (data.clips[0].sequence_name) {
            setSequenceName(data.clips[0].sequence_name);
          }
        }
      } catch (e) {
        console.warn("Could not fetch default sequence name from API", e);
      }
    };
    fetchDefaultSequence();
  }, []);

  const handleSkipToEditor = () => {
    if (hasProcessedOutput) {
      setCurrentView('editor');
    } else {
      setShowWorkflowModal(true);
    }
  };

  if (currentView === 'setup') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col items-center py-12 px-6">
        <div className="w-full max-w-5xl my-auto">
          <ImageEngineControls onComplete={(seqName?: string, targetVersion?: number) => {
            if (seqName) {
              setSequenceName(seqName);
              setHasProcessedOutput(true);
            }
            if (targetVersion !== undefined) {
              setInitialTargetVersion(targetVersion);
            } else {
              setInitialTargetVersion(undefined);
            }
            setCurrentView('editor');
          }} />
          <div className="mt-8 flex justify-center w-full">
            <button
              id="skip-to-editor-btn"
              onClick={handleSkipToEditor}
              className="text-slate-500 underline text-sm hover:text-slate-300 transition-colors"
            >
              Skip Setup &amp; Go to Editor
            </button>
          </div>
        </div>

        {/* Workflow Guide Modal */}
        {showWorkflowModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowWorkflowModal(false)}
          >
            <div
              id="workflow-guide-modal"
              className="relative w-full max-w-lg mx-4 bg-[#16191F] border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-[#1A1D24]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Cpu size={14} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">Action Required</h2>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">Workflow Guide</p>
                  </div>
                </div>
                <button
                  id="workflow-modal-close"
                  onClick={() => setShowWorkflowModal(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-slate-400" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  No processed sequence is available yet. Choose your path to access the N.A.I.L.E. Editor:
                </p>

                <div className="space-y-3">
                  {/* Option A */}
                  <div className="flex gap-4 p-4 rounded-xl bg-[#111318] border border-slate-800 hover:border-blue-500/30 transition-colors group">
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <FolderOpen size={15} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider">Option A</span>
                        <span className="text-xs font-bold text-slate-200">New Project</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Place your <span className="text-slate-300 font-mono">video.mp4</span>, <span className="text-slate-300 font-mono">sequence.edl</span>, and <span className="text-slate-300 font-mono">audio file (.wav, .m4a, .aac)</span> inside the <span className="text-blue-400 font-mono">engine/input/</span> folder, then run the Pipeline from the controls above.
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>

                  {/* Option B */}
                  <div className="flex gap-4 p-4 rounded-xl bg-[#111318] border border-slate-800 hover:border-emerald-500/30 transition-colors group">
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <RotateCcw size={15} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">Option B</span>
                        <span className="text-xs font-bold text-slate-200">Re-Edit a Past Session</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Select a previously processed sequence from the <span className="text-emerald-400 font-semibold">Completed Projects</span> list at the bottom of the Engine Controls to resume editing and access its full version history.
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-500/70 font-medium">
                        <Film size={10} />
                        <span>Scroll down in the Engine Controls panel to find your sessions</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-700/60 bg-[#1A1D24] flex justify-end">
                <button
                  id="workflow-modal-got-it"
                  onClick={() => setShowWorkflowModal(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors border border-slate-600"
                >
                  Got it
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <PancakeDashboard
        sequenceName={sequenceName}
        onOpenEngine={() => setCurrentView('setup')}
        initialTargetVersion={initialTargetVersion}
      />
    </ErrorBoundary>
  );
}
