'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  PET_SHEET_COLS,
  PET_SHEET_H,
  PET_SHEET_ROWS,
  PET_SHEET_SRC,
  PET_SHEET_W,
  dragMoodByPart,
  idleActions,
  moodFrames,
  petActions,
} from './site-pet/petActions';
import { dragLines, liveLines, patLines, pick, scoldLines, tapLines, teaseLines } from './site-pet/petLines';
import type { DragPart, IdleVariant, PetFrame, PetMood } from './site-pet/petTypes';
import { usePetBehavior } from './site-pet/usePetBehavior';

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  part: DragPart;
  moved: boolean;
};
const EDGE_PAD = 12;

function getPetSize() {
  if (typeof window === 'undefined') return 172;
  return window.innerWidth < 640 ? 132 : 172;
}

function getPetBoxSize(mood: PetMood, baseSize: number) {
  if (mood === 'live') {
    const width = typeof window !== 'undefined' && window.innerWidth < 640 ? 236 : 336;
    return { width, height: Math.round(width * 9 / 16) };
  }
  return { width: baseSize, height: baseSize };
}

function clampPosition(pos: { x: number; y: number }, box: number | { width: number; height: number }) {
  if (typeof window === 'undefined') return pos;
  const width = typeof box === 'number' ? box : box.width;
  const height = typeof box === 'number' ? box : box.height;
  return {
    x: Math.min(Math.max(EDGE_PAD, pos.x), window.innerWidth - width - EDGE_PAD),
    y: Math.min(Math.max(EDGE_PAD, pos.y), window.innerHeight - height - EDGE_PAD),
  };
}

function detectDragPart(clientX: number, clientY: number, rect: DOMRect): DragPart {
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;

  if (ny > 0.74) return 'leg';
  if (ny < 0.39) return 'head';
  if ((ny < 0.72 && (nx < 0.36 || nx > 0.64)) || (ny < 0.58 && nx < 0.53)) return 'hand';
  return 'body';
}

export default function SitePet({ liveActive = false }: { liveActive?: boolean }) {
  const petBoxRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const alphaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const alphaCanvasCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const currentFrameRef = useRef<PetFrame>(moodFrames.idle);
  const currentGridRef = useRef({ cols: PET_SHEET_COLS, rows: PET_SHEET_ROWS });
  const suppressClickRef = useRef<{ x: number; y: number; ts: number } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState(getPetSize);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const [pos, setPos] = useState(() => ({ x: 0, y: 0 }));
  const [mood, setMood] = useState<PetMood>('idle');
  const [message, setMessage] = useState('我在。暂时。');
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [actionKey, setActionKey] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [idleVariant, setIdleVariant] = useState<IdleVariant>('look');
  const [replicas, setReplicas] = useState(0);

  const moodClass = useMemo(() => `site-pet__sprite site-pet__sprite--${mood}`, [mood]);
  const action = mood === 'idle' ? idleActions[idleVariant] : petActions[mood];
  const resolvedFrameIndex = action.loop === false
    ? Math.min(frameIndex, action.frames.length - 1)
    : frameIndex % action.frames.length;
  const frame = action.frames[resolvedFrameIndex] ?? moodFrames[mood];
  const actionCols = action.cols ?? PET_SHEET_COLS;
  const actionRows = action.rows ?? PET_SHEET_ROWS;
  const actionSrc = action.src ?? PET_SHEET_SRC;
  const framePosition = `${(frame.col / Math.max(1, actionCols - 1)) * 100}% ${(frame.row / Math.max(1, actionRows - 1)) * 100}%`;
  const frameSize = `${actionCols * 100}% ${actionRows * 100}%`;
  const petBoxSize = useMemo(() => getPetBoxSize(mood, size), [mood, size]);
  const actionAspectRatio = action.aspectRatio ?? '1 / 1';
  const moodRef = useRef(mood);
  const {
    setPetBehavior,
    returnToBaseBehavior,
    say,
    resetSleepTimer,
  } = usePetBehavior({
    liveActive,
    dragRef,
    hideTimerRef,
    bubbleTimerRef,
    sleepTimerRef,
    setMood,
    setMessage,
    setBubbleVisible,
    setMenuOpen,
    setActionKey,
  });

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  const hitPet = useCallback((clientX: number, clientY: number) => {
    const box = petBoxRef.current;
    const canvas = alphaCanvasRef.current;
    if (!box || !canvas || hidden) return false;

    const rect = box.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;

    const frame = currentFrameRef.current;
    const { cols, rows } = currentGridRef.current;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    const x = Math.floor(frame.col * cellW + ((clientX - rect.left) / rect.width) * cellW);
    const y = Math.floor(frame.row * cellH + ((clientY - rect.top) / rect.height) * cellH);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;

    const alpha = canvas.getContext('2d')?.getImageData(x, y, 1, 1).data[3] ?? 0;
    return alpha > 28;
  }, [hidden]);

  const openMenuAtPet = useCallback(() => {
    setMenuOpen(true);
    resetSleepTimer();
  }, [resetSleepTimer]);

  const runPetAction = useCallback((kind: 'pat' | 'tease' | 'scold' | 'glitch') => {
    if (liveActive) return;
    dragRef.current = null;
    setMenuOpen(false);
    resetSleepTimer();
    if (kind === 'pat') say('pat', pick(patLines), 4200, 'action', true);
    if (kind === 'tease') say('tease', pick(teaseLines), 2500, 'action', true);
    if (kind === 'scold') say('scold', pick(scoldLines), 3600, 'action', true);
    if (kind === 'glitch') {
      setReplicas(3);
      say('glitch', '完了，我好像多出来了。', 4200, 'glitch');
      window.setTimeout(() => setReplicas(0), 4200);
    }
  }, [liveActive, resetSleepTimer, say]);

  const runMenuAction = useCallback((event: ReactPointerEvent<HTMLButtonElement>, kind: 'pat' | 'tease' | 'scold') => {
    event.preventDefault();
    event.stopPropagation();
    runPetAction(kind);
  }, [runPetAction]);

  useEffect(() => {
    const nextSize = getPetSize();
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    setSize(nextSize);
    setPos(clampPosition({
      x: window.innerWidth - nextSize - 22,
      y: window.innerHeight - nextSize - 92,
    }, nextSize));

    const onResize = () => {
      const s = getPetSize();
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setSize(s);
      setPos(current => clampPosition(current, getPetBoxSize(moodRef.current, s)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setPos(current => clampPosition(current, petBoxSize));
  }, [petBoxSize.height, petBoxSize.width]);

  useEffect(() => {
    const cached = alphaCanvasCacheRef.current.get(actionSrc);
    if (cached) {
      alphaCanvasRef.current = cached;
      setReady(true);
      return;
    }

    setReady(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || PET_SHEET_W;
      canvas.height = img.naturalHeight || PET_SHEET_H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx?.drawImage(img, 0, 0);
      alphaCanvasCacheRef.current.set(actionSrc, canvas);
      alphaCanvasRef.current = canvas;
      setReady(true);
    };
    img.src = actionSrc;
  }, [actionSrc]);

  useEffect(() => {
    currentFrameRef.current = frame;
    currentGridRef.current = { cols: actionCols, rows: actionRows };
  }, [actionCols, actionRows, frame]);

  useEffect(() => {
    setFrameIndex(0);
  }, [mood, actionKey, idleVariant]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrameIndex(current => {
        if ((mood === 'idle' || action.loop === false) && current >= action.frames.length - 1) return current;
        return current + 1;
      });
    }, 1000 / Math.max(1, action.fps));
    return () => window.clearInterval(interval);
  }, [action.fps, action.frames.length, action.loop, mood, actionKey, idleVariant]);

  useEffect(() => {
    if (mood !== 'idle' || hidden) return;

    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    const actionDuration = (action.frames.length / action.fps) * 1000;
    const pause = 900 + Math.random() * 2600;
    idleTimerRef.current = window.setTimeout(() => {
      setIdleVariant(current => {
        const roll = Math.random();
        if (current === 'sleepy') return roll < 0.72 ? 'look' : 'sleepy';
        return roll < 0.64 ? 'look' : 'sleepy';
      });
      setActionKey(k => k + 1);
      setFrameIndex(0);
    }, actionDuration + pause);

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [action.fps, action.frames.length, hidden, idleVariant, mood]);

  useEffect(() => {
    setPetBehavior(liveActive ? 'live' : 'idle', liveActive ? 'live' : 'idle', { force: true });
    setMessage(liveActive ? pick(liveLines) : '我在。暂时。');
    setBubbleVisible(true);
    setMenuOpen(false);
    if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = window.setTimeout(() => setBubbleVisible(false), 3200);
    resetSleepTimer();
  }, [liveActive, resetSleepTimer, setPetBehavior]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (hidden) return;
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) return;
      if (!hitPet(event.clientX, event.clientY)) return;
      const petRect = petBoxRef.current?.getBoundingClientRect();
      if (!petRect) return;
      const part = detectDragPart(event.clientX, event.clientY, petRect);

      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = { x: event.clientX, y: event.clientY, ts: Date.now() };
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      resetSleepTimer();
      setMenuOpen(false);

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - pos.x,
        offsetY: event.clientY - pos.y,
        part,
        moved: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        if (!liveActive) {
          setPetBehavior('drag', dragMoodByPart[drag.part], {
            message: pick(dragLines[drag.part]),
            bubble: true,
            force: true,
          });
        }
      }
      if (drag.moved) {
        event.preventDefault();
        setPos(clampPosition({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }, petBoxSize));
        if (!liveActive && mood !== dragMoodByPart[drag.part]) {
          setPetBehavior('drag', dragMoodByPart[drag.part], { force: true });
        }
        if (liveActive && mood !== 'live') setPetBehavior('live', 'live', { force: true });
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      if (liveActive) {
        dragRef.current = null;
        returnToBaseBehavior(true);
        return;
      }
      if (drag.moved) {
        dragRef.current = null;
        say('fall', '嘶……没事，我站起来了。', 1900, 'fall');
      } else {
        dragRef.current = null;
        say('talk', pick(tapLines));
        openMenuAtPet();
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!hitPet(event.clientX, event.clientY)) return;
      event.preventDefault();
      event.stopPropagation();
      if (liveActive) return;
      openMenuAtPet();
    };

    const onClick = (event: MouseEvent) => {
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) return;
      const suppressed = suppressClickRef.current;
      const closeToSuppressed =
        suppressed &&
        Date.now() - suppressed.ts < 450 &&
        Math.hypot(event.clientX - suppressed.x, event.clientY - suppressed.y) < 18;
      if (!closeToSuppressed && !hitPet(event.clientX, event.clientY)) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = null;
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [hidden, hitPet, liveActive, mood, openMenuAtPet, petBoxSize.height, petBoxSize.width, pos.x, pos.y, resetSleepTimer, returnToBaseBehavior, say, setPetBehavior]);

  useEffect(() => {
    const buffer: string[] = [];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      buffer.push(event.key.toLowerCase());
      while (buffer.length > 8) buffer.shift();
      if (buffer.join('').endsWith('feiyan')) runPetAction('glitch');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runPetAction]);

  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
  }, []);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          setHidden(false);
          say('talk', '我回来了，刚才没偷偷睡觉。');
        }}
        className="fixed bottom-4 right-4 z-[70] rounded-full border border-[#E8B84B]/40 bg-[#0A0E14] px-3 py-2 text-xs font-medium text-[#E8B84B] shadow-lg shadow-black/20 transition hover:brightness-110"
      >
        唤回
      </button>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {replicas > 0 && [0, 1, 2].map(i => (
        <span
          key={i}
          aria-hidden="true"
          className="site-pet__replica site-pet__replica-frame"
          style={{
            left: pos.x + (i - 1) * 28,
            top: pos.y + 8 + i * 10,
            width: size,
            animationDelay: `${i * 90}ms`,
          }}
        />
      ))}

      {mood === 'fall' && (
        <span
          key={`impact-${actionKey}`}
          aria-hidden="true"
          className="site-pet__impact"
          style={{
            left: pos.x + petBoxSize.width * 0.16,
            top: pos.y + petBoxSize.height * 0.78,
            width: petBoxSize.width * 0.68,
          }}
        />
      )}

      <div
        ref={petBoxRef}
        className="site-pet"
        style={{
          left: pos.x,
          top: pos.y,
          width: petBoxSize.width,
          height: petBoxSize.height,
          aspectRatio: actionAspectRatio,
          opacity: ready ? 1 : 0,
        }}
        aria-hidden="true"
      >
        <span
          key={`${mood}-${actionKey}`}
          aria-hidden="true"
          className={moodClass}
          style={{
            backgroundImage: `url(${actionSrc})`,
            backgroundPosition: framePosition,
            backgroundSize: frameSize,
            aspectRatio: actionAspectRatio,
            height: '100%',
          }}
        />
      </div>

      <div
        className={`site-pet__bubble ${bubbleVisible ? 'site-pet__bubble--visible' : ''}`}
        style={{
          left: Math.min(Math.max(12, pos.x - 38), Math.max(12, viewport.width - 244)),
          top: Math.max(12, pos.y - 74),
        }}
      >
        {message}
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="pointer-events-auto fixed z-[92] flex max-w-[calc(100vw-24px)] gap-1 rounded-lg border border-black/10 bg-white/95 p-1 text-xs shadow-xl backdrop-blur"
          style={{
            left: Math.min(Math.max(12, pos.x - 18), Math.max(12, viewport.width - 246)),
            top: Math.min(pos.y + petBoxSize.height - 10, viewport.height - 46),
          }}
        >
          <button type="button" onPointerDown={event => runMenuAction(event, 'pat')} className="site-pet__action">摸头</button>
          <button type="button" onPointerDown={event => runMenuAction(event, 'tease')} className="site-pet__action">挑逗</button>
          <button type="button" onPointerDown={event => runMenuAction(event, 'scold')} className="site-pet__action">敲头</button>
          <button type="button" onClick={() => setHidden(true)} className="site-pet__action">收容</button>
        </div>
      )}
    </div>
  );
}
