import { Component, useState, type CSSProperties, type ReactNode } from 'react';
import { MeshGradient, Shader } from 'shaders/react';
import { cn } from '../lib/cn.ts';

export type AmbientMood = 'idle' | 'working' | 'error';

export interface AmbientProps {
  mood?: AmbientMood;
  /** Colours, darkest first; defaults follow the AICL accent. */
  colors?: [string, string, string?];
  className?: string;
  style?: CSSProperties;
}

const DEFAULT: [string, string, string] = ['#18181b', '#6366f1', '#ec4899'];

const supportsWebGpu = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

/**
 * A soft animated background (WebGPU via `shaders`) for hero, idle and working
 * states. Falls back to a CSS gradient when WebGPU is missing or fails, never
 * throws, and sends no telemetry.
 */
export function Ambient({ mood = 'idle', colors, className, style }: AmbientProps) {
  const [a, b, c] = colors ?? DEFAULT;
  const [failed, setFailed] = useState(!supportsWebGpu());
  const fallback = (
    <div
      aria-hidden="true"
      data-ambient="fallback"
      className={cn('absolute inset-0', className)}
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, ${b}55, transparent 60%), radial-gradient(100% 80% at 90% 90%, ${c ?? b}44, transparent 55%), ${a}`,
        ...style,
      }}
    />
  );
  if (failed) return fallback;
  const palette = mood === 'error' ? [a, '#7f1d1d', '#ef4444'] : [a, b, c ?? b];
  const stops = palette.map((color, i) => ({ color, position: i / (palette.length - 1) }));
  return (
    <ShaderBoundary fallback={fallback}>
      <Shader
        aria-hidden="true"
        data-ambient={mood}
        disableTelemetry
        className={cn('absolute inset-0', className)}
        style={style}
        onUnavailable={() => setFailed(true)}
      >
        <MeshGradient
          stops={stops}
          speed={mood === 'working' ? 2.2 : mood === 'error' ? 0.25 : 0.6}
          swirl={mood === 'working' ? 0.9 : 0.4}
        />
      </Shader>
    </ShaderBoundary>
  );
}

class ShaderBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { broken: boolean }> {
  override state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  override render() {
    return this.state.broken ? this.props.fallback : this.props.children;
  }
}
