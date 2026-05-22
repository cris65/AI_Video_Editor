import { useState, useEffect } from 'react';
import { PancakeDashboard } from './components/dashboard/PancakeDashboard';
import { ImageEngineControls } from './components/dashboard/ImageEngineControls';

export default function App() {
  const [currentView, setCurrentView] = useState<'setup' | 'editor'>('setup');
  const [sequenceName, setSequenceName] = useState<string>("RAW_BASE_SEQ_AMICI_DONDOLO"); // fallback

  useEffect(() => {
    const fetchDefaultSequence = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/videos/list');
        const data = await res.json();
        if (data.clips && data.clips.length > 0) {
          // Find first processed clip, otherwise fall back to first clip's sequence name
          const processedClip = data.clips.find((c: any) => c.processed);
          if (processedClip && processedClip.sequence_name) {
            setSequenceName(processedClip.sequence_name);
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

  if (currentView === 'setup') {
    return (
      <div className="h-screen bg-[#111111] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-5xl">
          <ImageEngineControls onComplete={(seqName?: string) => {
            if (seqName) setSequenceName(seqName);
            setCurrentView('editor');
          }} />
          <div className="mt-8 flex justify-center w-full">
            <button
              onClick={() => setCurrentView('editor')}
              className="text-slate-500 underline text-sm hover:text-slate-300 transition-colors"
            >
              Skip Setup & Go to Editor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PancakeDashboard 
      sequenceName={sequenceName} 
      onOpenEngine={() => setCurrentView('setup')}
    />
  );
}
