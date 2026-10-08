/**
 * Agent presence on the canvas (AICL-41): while a session's agent works, a
 * labelled cursor glides to the card it is on and the card glows softly;
 * both fade when it goes idle. With "Follow agent" on, the camera trails it.
 *
 * Rendered inside tldraw (InFrontOfTheCanvas). Where the agent "is" comes from
 * three signals: surfaces it opened or updated (the surface index), shapes its
 * canvas ops touched (executor → noteAgentTouch), and, failing both, its work frame.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useEditor, useValue, type Editor, type TLShapeId } from 'tldraw';
import type { SessionInfo } from '../../shared/runtime.ts';
import { useKit } from '../kits/index.tsx';
import { useSessions } from '../sessionsApi.ts';
import { useSurfaces } from '../surfaces/index.tsx';
import { agentRecently } from '../canvasContext.ts';
import { findSurfaceCard, workframeId } from './frames.ts';
import { getAgentTouch, LINGER_MS, setFollow, useFollow } from './presence.ts';
import './workspace.css';

interface Presence {
  sessionId: string;
  shapeId: TLShapeId;
  label: string;
  step?: string;
  color: string;
  at: number;
}

const PALETTE = ['#7c5cff', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'];

function targetOf(editor: Editor, session: SessionInfo, surfaces: ReturnType<typeof useSurfaces>, ownsTouch: boolean): { shapeId: TLShapeId; at: number } | null {
  let best: { shapeId: TLShapeId; at: number } | null = null;
  const consider = (shapeId: TLShapeId | undefined, at: number) => {
    if (shapeId && editor.getShape(shapeId) && (!best || at > best.at)) best = { shapeId, at };
  };
  const since = session.startedAt ?? 0;
  for (const s of surfaces) {
    if (s.sessionId !== session.id || s.updatedAt < since) continue;
    consider(findSurfaceCard(editor, s.kind, s.id)?.id, s.updatedAt);
  }
  const touch = getAgentTouch();
  if (ownsTouch && touch && touch.at >= since) {
    const ids = touch.ids.map((i) => (i.startsWith('shape:') ? i : `shape:${i}`) as TLShapeId).filter((i) => editor.getShape(i));
    // A card beats the frame around it.
    consider(ids.find((i) => editor.getShape(i)?.type !== 'frame') ?? ids[0], touch.at);
  }
  return best ?? (editor.getShape(workframeId(session.id)) ? { shapeId: workframeId(session.id), at: since } : null);
}

export function AgentPresence() {
  const editor = useEditor();
  const kit = useKit();
  const sessions = useSessions();
  const surfaces = useSurfaces();
  const follow = useFollow();
  const [, tick] = useState(0);
  const memory = useRef(new Map<string, { shapeId: TLShapeId; at: number; lastRunning: number }>());

  // A slow clock so presence fades and surface updates are re-read.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 400);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const running = sessions.filter((s) => s.status === 'running' && s.kind === 'chat');
  const newest = running.reduce<SessionInfo | null>((a, s) => (!a || (s.startedAt ?? 0) > (a.startedAt ?? 0) ? s : a), null);
  for (const s of running) {
    const t = targetOf(editor, s, surfaces, s.id === newest?.id);
    const prev = memory.current.get(s.id);
    if (t) memory.current.set(s.id, { shapeId: t.shapeId, at: Math.max(t.at, prev?.at ?? 0), lastRunning: now });
    else if (prev) prev.lastRunning = now;
  }
  const presences: Presence[] = [];
  for (const [sessionId, m] of memory.current) {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s || now - m.lastRunning > LINGER_MS || !editor.getShape(m.shapeId)) {
      if (!s || now - m.lastRunning > LINGER_MS) memory.current.delete(sessionId);
      continue;
    }
    presences.push({
      sessionId,
      shapeId: m.shapeId,
      label: s.role || kit.vocabulary.agent,
      ...(s.status === 'running' && s.currentStep ? { step: s.currentStep } : {}),
      color: PALETTE[presences.length % PALETTE.length]!,
      at: m.at,
    });
  }
  presences.sort((a, b) => b.at - a.at);
  if (presences[0]) presences[0].color = kit.tokens.accent;
  const primary = presences[0]?.shapeId;

  // Follow: glide the camera to where the agent is; any move by the user ends it.
  const ownMoveUntil = useRef(0);
  useEffect(() => {
    if (!follow || !primary) return;
    const box = editor.getShapePageBounds(primary);
    if (!box) return;
    ownMoveUntil.current = Date.now() + 1100;
    editor.zoomToBounds(box, { inset: 90, targetZoom: 1, animation: { duration: 800 } });
  }, [follow, primary, editor]);
  useEffect(() => {
    if (!follow) return;
    const off = () => setFollow(false);
    const stop = editor.store.listen(
      ({ changes }) => {
        if (Date.now() < ownMoveUntil.current || agentRecently()) return;
        if (Object.values(changes.updated).some(([, to]) => to.typeName === 'camera')) off();
      },
      { scope: 'session' },
    );
    // On window, in the capture phase: cards stop wheel events (React) before they reach the canvas container.
    const el = editor.getContainer();
    const onWheel = (e: WheelEvent) => {
      if (e.composedPath().includes(el)) off();
    };
    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    return () => {
      stop();
      window.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [follow, editor]);

  const key = useMemo(() => presences.map((p) => p.sessionId).join(','), [presences]);
  return (
    <div className="presence-layer" data-presence={key || undefined} aria-hidden="true">
      <AnimatePresence>
        {presences.map((p) => (
          <PresenceMarker key={p.sessionId} editor={editor} p={p} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function PresenceMarker({ editor, p }: { editor: Editor; p: Presence }) {
  const rect = useValue(
    `presence ${p.sessionId}`,
    () => {
      const b = editor.getShapePageBounds(p.shapeId);
      if (!b) return null;
      const a = editor.pageToViewport({ x: b.minX, y: b.minY });
      const z = editor.getZoomLevel();
      return { x: a.x, y: a.y, w: b.w * z, h: b.h * z };
    },
    [editor, p.shapeId],
  );
  if (!rect) return null;
  // The cursor rests on the card's header, towards its right edge.
  const cx = rect.x + Math.max(40, rect.w - 150);
  const cy = rect.y + Math.min(18, rect.h / 2);
  return (
    <>
      <motion.div
        className="presence-glow"
        data-presence-glow={p.sessionId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ ['--presence' as string]: p.color, left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      />
      <motion.div
        className="presence-cursor"
        data-presence-cursor={p.sessionId}
        initial={{ opacity: 0, x: cx, y: cy }}
        animate={{ opacity: 1, x: cx, y: cy }}
        exit={{ opacity: 0, transition: { duration: 0.6 } }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        style={{ ['--presence' as string]: p.color }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M2 1.5 15 8l-5.6 1.7L7.4 15.5 2 1.5Z" fill="var(--presence)" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <span className="presence-label">
          {p.label}
          {p.step ? <em> · {p.step}</em> : null}
        </span>
      </motion.div>
    </>
  );
}
