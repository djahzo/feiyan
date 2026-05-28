import type { DragPart } from './petTypes';

export const idleLines = [
  '你忙你的，我就站一会儿。',
  '别看我，我刚刚什么都没干。',
  '今天适合稳一点，别又贪包。',
  '我好像听见非洲之心在小声说话。',
];

export const liveLines = [
  '主播开播啦，要不要去看看？',
  '直播间已经亮了，你还在这里发呆。',
  '我闻到弹幕的味道了。',
];

export const tapLines = [
  '哎，点我干嘛。',
  '我在呢，小点声。',
  '再戳我，我就假装没看见你。',
];

export const patLines = [
  '嗯……这下还行。',
  '头发本来就乱，不许笑。',
  '好吧，给你摸一下，就一下。',
];

export const teaseLines = [
  '你很闲吗？我也是。',
  '别逗了，我会当真的。',
  '你再这样，我就笑给你看。',
];

export const scoldLines = [
  '敲一下就够了，我记住了。',
  '脑袋会变笨的。',
  '轻点，我还要继续站岗。',
];

export const dragLines: Record<DragPart, string[]> = {
  head: ['别拎头发，真的会秃。', '脑袋不是把手。'],
  hand: ['手手要被你拽长了。', '行行行，我跟你走。'],
  leg: ['倒着走也不是不行。', '你这拖法很有想法。'],
  body: ['别晃，我有点晕。', '整个人都被你端走了。'],
};

export function pick(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? '';
}

