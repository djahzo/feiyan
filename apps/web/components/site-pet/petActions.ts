import type { DragPart, IdleVariant, PetActionDef, PetFrame, PetMood } from './petTypes';

export const PET_SHEET_SRC = '/pet-assets/feiyan-pet-spritesheet.webp';
export const PET_SHEET_W = 1536;
export const PET_SHEET_H = 1024;
export const PET_SHEET_COLS = 3;
export const PET_SHEET_ROWS = 2;

const IDLE_ACTION_FRAMES = 60;
const LIVE_ACTION_FRAMES = 60;
const LIVE_ACTION_COLS = 30;
const TEASE_ACTION_FRAMES = 20;

function frameRange(length: number, mapFrame: (index: number) => PetFrame = col => ({ col, row: 0 })) {
  return Array.from({ length }, (_, index) => mapFrame(index));
}

export const moodFrames: Record<PetMood, PetFrame> = {
  idle: { col: 0, row: 0 },
  talk: { col: 1, row: 0 },
  pat: { col: 2, row: 0 },
  tease: { col: 0, row: 1 },
  scold: { col: 1, row: 1 },
  dragHead: { col: 0, row: 0 },
  dragHand: { col: 1, row: 0 },
  dragLeg: { col: 2, row: 0 },
  dragBody: { col: 3, row: 0 },
  fall: { col: 0, row: 0 },
  sleep: { col: 2, row: 1 },
  live: { col: 1, row: 0 },
  glitch: { col: 1, row: 1 },
};

export const petActions: Record<PetMood, PetActionDef> = {
  idle: {
    src: '/pet-assets/kling-idle/idle-kling-fullbody-60-256.webp',
    cols: IDLE_ACTION_FRAMES,
    rows: 1,
    fps: 12,
    frames: frameRange(IDLE_ACTION_FRAMES),
  },
  talk: {
    fps: 7,
    frames: [moodFrames.idle, moodFrames.talk, moodFrames.idle, moodFrames.talk],
  },
  pat: {
    src: '/pet-assets/kling-pat/pat-kling-47-256.webp',
    cols: 47,
    rows: 1,
    fps: 12,
    loop: false,
    frames: frameRange(47),
  },
  tease: {
    src: '/pet-assets/tease-generated/tease-poke-chin-20-512.webp',
    cols: TEASE_ACTION_FRAMES,
    rows: 1,
    fps: 13,
    loop: false,
    frames: frameRange(TEASE_ACTION_FRAMES),
  },
  scold: {
    fps: 10,
    frames: [moodFrames.idle, moodFrames.scold, moodFrames.tease, moodFrames.scold, moodFrames.talk, moodFrames.idle],
  },
  dragHead: {
    src: '/pet-assets/drag-generated/drag-hang-poses-4.webp',
    cols: 4,
    rows: 1,
    fps: 1,
    loop: false,
    frames: [moodFrames.dragHead],
  },
  dragHand: {
    src: '/pet-assets/drag-generated/drag-hang-poses-4.webp',
    cols: 4,
    rows: 1,
    fps: 1,
    loop: false,
    frames: [moodFrames.dragHand],
  },
  dragLeg: {
    src: '/pet-assets/drag-generated/drag-hang-poses-4.webp',
    cols: 4,
    rows: 1,
    fps: 1,
    loop: false,
    frames: [moodFrames.dragLeg],
  },
  dragBody: {
    src: '/pet-assets/drag-generated/drag-hang-poses-4.webp',
    cols: 4,
    rows: 1,
    fps: 1,
    loop: false,
    frames: [moodFrames.dragBody],
  },
  fall: {
    src: '/pet-assets/fall-generated/fall-rise-8-512.webp',
    cols: 8,
    rows: 1,
    fps: 8,
    loop: false,
    frames: [
      { col: 0, row: 0 },
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 0 },
      { col: 5, row: 0 },
      { col: 6, row: 0 },
      { col: 7, row: 0 },
    ],
  },
  sleep: {
    fps: 1.4,
    frames: [moodFrames.sleep, moodFrames.sleep, moodFrames.idle, moodFrames.sleep],
  },
  live: {
    src: '/pet-assets/live-status/live-delta-playing-60-384x216-30x2.webp',
    cols: LIVE_ACTION_COLS,
    rows: 2,
    fps: 12,
    aspectRatio: '16 / 9',
    frames: frameRange(LIVE_ACTION_FRAMES, index => ({ col: index % LIVE_ACTION_COLS, row: Math.floor(index / LIVE_ACTION_COLS) })),
  },
  glitch: {
    fps: 13,
    frames: [moodFrames.scold, moodFrames.tease, moodFrames.talk, moodFrames.scold],
  },
};

export const idleActions: Record<IdleVariant, PetActionDef> = {
  look: petActions.idle,
  sleepy: {
    src: '/pet-assets/kling-idle/idle-kling-fullbody-60-256.webp',
    cols: IDLE_ACTION_FRAMES,
    rows: 1,
    fps: 12,
    frames: frameRange(IDLE_ACTION_FRAMES),
  },
};

export const dragMoodByPart: Record<DragPart, PetMood> = {
  head: 'dragHead',
  hand: 'dragHand',
  leg: 'dragLeg',
  body: 'dragBody',
};

