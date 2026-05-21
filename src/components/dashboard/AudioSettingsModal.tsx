import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, Music, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AudioSettingsModalProps {
  sequenceName: string;
  onClose: () => void;
}

export function AudioSettingsModal({ sequenceName, onClose }: AudioSettingsModalProps) {
  const [audioFiles, setAudioFiles] = useState<{name: string, size_mb: number, type: string, estimated_eta_sec: number}[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  
  const [audioData, setAudioData] = useState<{ bpm: number; duration: number; waveform: number[], processingTime?: number } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/audio/files');
        if (!res.ok) throw new Error('Failed to fetch audio files');
        const data = await res.json();
        setAudioFiles(data.files || []);
        if (data.files && data.files.length > 0) {
          setSelectedFile(data.files[0].name);
        }
      } catch (err) {
        console.error('Error fetching audio files:', err);
        toast.error('Failed to load audio files from engine/input');
      } finally {
        setIsLoadingFiles(false);
      }
    };
    
    fetchFiles();
  }, []);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    try {
      const payload = {
        filename: selectedFile,
        project_id: sequenceName
      };
      
      const res = await fetch('http://localhost:8000/api/audio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error('Failed to analyze audio');
      const data = await res.json();
      
      if (data.ok) {
        toast.success(`Analysis complete! BPM: ${data.data.bpm}`);
        setAudioData({
          bpm: data.data.bpm,
          duration: data.data.total_duration_sec,
          waveform: data.data.waveform || [],
          processingTime: data.data.processing_time_sec
        });
      } else {
        throw new Error(data.error || 'Analysis error');
      }
    } catch (err: unknown) {
      console.error('Analysis error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to analyze audio rhythm');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-system-modal flex items-center justify-center p-4 sm:p-8 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-slate-200 tracking-wider flex items-center gap-2">
              <Music size={20} className="text-emerald-400" />
              Audio Rhythm Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select an audio file from the input directory to extract BPM and transients.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN: Config */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                  Input Selection
                </h3>
                
                <div className="space-y-2">
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider">
                    Available Tracks
                  </label>
                  
                  {isLoadingFiles ? (
                    <div className="flex items-center gap-2 text-slate-400 p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      Scanning engine/input/...
                    </div>
                  ) : audioFiles.length === 0 ? (
                    <div className="text-amber-500 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                      No .mp3 or .wav files found in engine/input/
                    </div>
                  ) : (
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none"
                      value={selectedFile}
                      onChange={(e) => setSelectedFile(e.target.value)}
                    >
                      {audioFiles.map((file) => (
                        <option key={file.name} value={file.name}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedFile && (() => {
                    const info = audioFiles.find(f => f.name === selectedFile);
                    if (!info) return null;
                    return (
                      <p className="text-[10px] text-slate-400 mt-2 flex gap-3 font-mono">
                        <span>TYPE: <strong className="text-emerald-400">{info.type}</strong></span>
                        <span>SIZE: <strong className="text-emerald-400">{info.size_mb} MB</strong></span>
                        <span>ETA: <strong className="text-amber-500">~{info.estimated_eta_sec}s</strong></span>
                      </p>
                    );
                  })()}
                  <p className="text-[10px] text-slate-500 mt-2">
                    Files must be placed in <code className="text-slate-400 font-mono">engine/input/</code>
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Action & Preview */}
            <div>
              <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                Rhythm Extraction
              </h3>
              
              <div className="flex flex-col gap-4">
                <div className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl mb-2 flex items-center justify-center relative overflow-hidden shadow-inner">
                  {!audioData ? (
                    <>
                      <span className="text-slate-600 text-xs font-mono font-bold tracking-widest z-10">
                        [ WAVEFORM PREVIEW ]
                      </span>
                      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(90deg,transparent_24%,rgba(130,170,255,0.2)_25%,transparent_26%,transparent_74%,rgba(130,170,255,0.2)_75%,transparent_76%)] bg-[length:20px_100%]"></div>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/50 backdrop-blur-sm">
                        <div className="flex gap-4">
                          <span className="text-emerald-400 font-mono text-[10px] font-bold tracking-wider">BPM: {audioData.bpm}</span>
                          <span className="text-slate-400 font-mono text-[10px]">DUR: {audioData.duration}s</span>
                        </div>
                        {audioData.processingTime && (
                          <span className="text-amber-500/80 font-mono text-[9px]">
                            PROCESSED IN {audioData.processingTime}s
                          </span>
                        )}
                      </div>
                      {audioData.waveform.length > 0 && (() => {
                        const visibleWaveform = audioData.waveform;
                        const svgWidth = 1000;
                        const svgHeight = 100;
                        const step = svgWidth / visibleWaveform.length;

                        let pathD = `M 0,${svgHeight}`;
                        visibleWaveform.forEach((val, i) => {
                          const x = (i * step).toFixed(2);
                          const y = (svgHeight - (val * svgHeight)).toFixed(2);
                          pathD += ` L ${x},${y}`;
                        });
                        pathD += ` L ${svgWidth},${svgHeight} Z`;

                        return (
                          <div className="absolute inset-x-0 bottom-0 top-[24px] opacity-60 pointer-events-none z-[15] mix-blend-screen overflow-hidden px-1">
                            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="w-full h-full fill-emerald-500">
                              <path d={pathD} />
                            </svg>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedFile}
                  className={`w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                    isAnalyzing || !selectedFile
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02]'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-slate-400" />
                      {(() => {
                        const fileInfo = audioFiles.find(f => f.name === selectedFile);
                        const estTotal = fileInfo ? fileInfo.estimated_eta_sec : 45;
                        return `Analyzing... (Elapsed: ${elapsedSeconds}s / ETA: ~${estTotal}s)`;
                      })()}
                    </>
                  ) : (
                    <>
                      <Activity size={18} />
                      Analyze Rhythm
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 text-center">
                  This will generate <code className="text-slate-400">_audio_beats.json</code> for the Director's Cut.
                </p>
              </div>
            </div>
            
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-4 shrink-0">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 rounded-lg font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-all flex items-center gap-2 border border-slate-700 shadow-sm"
          >
            <Check size={18} className="text-emerald-400" />
            Done & Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
