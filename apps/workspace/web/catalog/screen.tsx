import { useState } from 'react';
import { createSession } from '../sessionsApi.ts';
import { RunProvider } from '../ui/run.tsx';
import { readRunSessionId, withRunSessionId } from '../ui/run-thread.ts';
import {
  FRAME_SIZES,
  THEME_PRESETS,
  resolveTheme,
  type ScreenFrame,
  type ScreenSpec,
  type ThemePresetName,
  type UiNode,
} from '../../shared/ui-spec.ts';
import { toReactCode } from '../../shared/ui-ops.ts';
import { SpecRenderer } from '../ui/SpecRenderer.tsx';
import { setUiSelection, useUiSelection } from '../ui/selection.ts';
import type { ComponentRendererProps } from './types.ts';

const BAR_H = 34;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Tolerant read of unnormalised JSON: defaults for anything missing or malformed. */
function readSpec(raw: Record<string, unknown>): ScreenSpec {
  const frame = (raw['frame'] as ScreenFrame) in FRAME_SIZES ? (raw['frame'] as ScreenFrame) : 'desktop';
  const t = isObj(raw['theme']) ? raw['theme'] : {};
  const preset = (t['preset'] as ThemePresetName) in THEME_PRESETS ? (t['preset'] as ThemePresetName) : 'default';
  const overrides = isObj(t['overrides']) ? (t['overrides'] as ScreenSpec['theme']['overrides']) : undefined;
  const root = isObj(raw['root'])
    ? (raw['root'] as unknown as UiNode)
    : ({ id: 'root', type: 'column', children: [] } as UiNode);
  return {
    name: typeof raw['name'] === 'string' ? raw['name'] : 'Screen',
    frame,
    theme: { preset, ...(overrides ? { overrides } : {}) },
    root,
  };
}

export function ScreenRenderer({ props, width, height, shapeId, onPropsChange }: ComponentRendererProps) {
  const spec = readSpec(props);
  const [mode, setMode] = useState<'select' | 'interact'>('select');
  const [run, setRun] = useState(false);
  const [binding, setBinding] = useState(false);
  const [copied, setCopied] = useState(false);
  const runSessionId = readRunSessionId(spec.root);
  const selection = useUiSelection();
  const selectedId = shapeId && selection?.shapeId === shapeId ? selection.nodeId : undefined;

  const update = (next: ScreenSpec) => onPropsChange?.(next as unknown as Record<string, unknown>);
  const tokens = resolveTheme(spec.theme);
  const size = FRAME_SIZES[spec.frame];
  const stageW = Math.max(1, width);
  const stageH = Math.max(1, height - BAR_H);
  const scale = Math.min(stageW / size.w, stageH / size.h);
  const offX = Math.max(0, (stageW - size.w * scale) / 2);
  const offY = Math.max(0, (stageH - size.h * scale) / 2);

  const startRun = async () => {
    if (runSessionId) return setRun(true);
    if (binding) return;
    setBinding(true);
    try {
      const id = await createSession({ title: spec.name, kind: 'node' });
      update(withRunSessionId(spec, id));
      setRun(true);
    } catch {
      /* session service unavailable: stay in design */
    } finally {
      setBinding(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toReactCode(spec));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: stay quiet */
    }
  };

  return (
    <div
      className="aicl-screen"
      data-ui-selected-node={run ? '' : (selectedId ?? '')}
      data-ui-selected-shape={selection?.shapeId ?? ''}
    >
      <div className="aicl-screen-bar" onWheel={(e) => e.stopPropagation()}>
        <select
          aria-label="Frame"
          value={spec.frame}
          onChange={(e) => update({ ...spec, frame: e.target.value as ScreenFrame })}
        >
          {(Object.keys(FRAME_SIZES) as ScreenFrame[]).map((f) => (
            <option key={f} value={f}>
              {FRAME_SIZES[f].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Theme"
          value={spec.theme.preset}
          onChange={(e) =>
            update({ ...spec, theme: { ...spec.theme, preset: e.target.value as ThemePresetName } })
          }
        >
          {(Object.keys(THEME_PRESETS) as ThemePresetName[]).map((p) => (
            <option key={p} value={p}>
              {THEME_PRESETS[p].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Toggle dark mode"
          aria-pressed={tokens.mode === 'dark'}
          onClick={() =>
            update({
              ...spec,
              theme: { ...spec.theme, overrides: { ...spec.theme.overrides, mode: tokens.mode === 'dark' ? 'light' : 'dark' } },
            })
          }
        >
          {tokens.mode === 'dark' ? 'Dark' : 'Light'}
        </button>
        <span className="aicl-screen-sep" />
        <button type="button" aria-pressed={!run} onClick={() => setRun(false)}>
          Design
        </button>
        <button type="button" aria-pressed={run} disabled={binding} onClick={() => void startRun()}>
          Run
        </button>
        <span className="aicl-screen-sep" />
        {run ? null : (
          <>
            <button type="button" aria-pressed={mode === 'select'} onClick={() => setMode('select')}>
              Select
            </button>
            <button type="button" aria-pressed={mode === 'interact'} onClick={() => setMode('interact')}>
              Interact
            </button>
          </>
        )}
        <button type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <div className="aicl-screen-stage">
        <div
          className="aicl-screen-frame"
          style={{
            width: size.w,
            height: size.h,
            transform: `translate(${offX}px, ${offY}px) scale(${scale})`,
          }}
        >
          {run && runSessionId ? (
            <RunProvider sessionId={runSessionId} spec={spec}>
              <SpecRenderer spec={spec} mode="interact" selectedId={undefined} />
            </RunProvider>
          ) : (
            <SpecRenderer
              spec={spec}
              mode={mode}
              selectedId={selectedId}
              onSelect={(nodeId) => {
                if (shapeId) setUiSelection({ shapeId, nodeId });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
