import { useState } from 'react';
import { PancakeDashboard } from './components/dashboard/PancakeDashboard';
import { ImageEngineControls } from './components/dashboard/ImageEngineControls';

export default function App() {
  const [currentView, setCurrentView] = useState<'setup' | 'editor'>('setup');
  const [sequenceName, setSequenceName] = useState<string>("RAW_BASE_SEQ_AMICI_DONDOLO"); // fallback

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
    <PancakeDashboard sequenceName={sequenceName} />
  );
}
