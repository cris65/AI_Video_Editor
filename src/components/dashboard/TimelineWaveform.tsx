import React from 'react';

interface TimelineWaveformProps {
  audioWaveforms: { amplitude: number[]; energy: number[] };
  waveformView: 'amplitude' | 'energy';
  /**
   * Total duration of the source video (seconds, float — agnostic from FPS).
   * Used to compute the proportional width of the waveform overlay.
   */
  videoDuration: number;
  audioDuration: number;
  /** Tailwind fill class for the SVG path. Defaults to emerald. */
  fillClass?: string;
  className?: string;
}

/**
 * Shared SVG waveform overlay used by both StringoutTimeline and DirectorCutTimeline.
 * Rendered as pointer-events-none so it never intercepts clicks/drags on the track.
 * The width is proportional: min(audioDuration, videoDuration) / videoDuration.
 */
export const TimelineWaveform: React.FC<TimelineWaveformProps> = ({
  audioWaveforms,
  waveformView,
  videoDuration,
  audioDuration,
  fillClass = 'fill-emerald-400',
  className = 'absolute top-[24px] bottom-0 left-0 opacity-80 pointer-events-none z-[15] mix-blend-screen overflow-hidden',
}) => {
  const activeWaveform = audioWaveforms[waveformView] ?? [];
  if (activeWaveform.length === 0 || audioDuration <= 0 || videoDuration <= 0) return null;

  const pointsPerSecond = activeWaveform.length / audioDuration;
  const pointsToShow = Math.ceil(Math.min(videoDuration, audioDuration) * pointsPerSecond);
  const visibleWaveform = activeWaveform.slice(0, pointsToShow);
  if (visibleWaveform.length === 0) return null;

  const SVG_W = 1000;
  const SVG_H = 100;
  const step = SVG_W / visibleWaveform.length;

  let pathD = `M 0,${SVG_H}`;
  visibleWaveform.forEach((val, i) => {
    pathD += ` L ${(i * step).toFixed(2)},${(SVG_H - val * SVG_H).toFixed(2)}`;
  });
  pathD += ` L ${SVG_W},${SVG_H} Z`;

  const waveformWidthPct = (Math.min(audioDuration, videoDuration) / videoDuration) * 100;

  return (
    <div
      className={className}
      style={{ width: `${waveformWidthPct}%` }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className={`w-full h-full ${fillClass}`}
      >
        <path d={pathD} />
      </svg>
    </div>
  );
};
