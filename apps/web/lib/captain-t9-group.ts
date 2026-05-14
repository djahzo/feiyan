import { pinyin } from 'pinyin-pro';

/** 九键 2–9 字母分组 + 第 9 组「其他」（数字、符号、无法识别首字母） */
export const T9_GROUP_KEYS = [2, 3, 4, 5, 6, 7, 8, 9, 0] as const;
export type T9GroupKey = (typeof T9_GROUP_KEYS)[number];

export const T9_GROUP_LABEL: Record<number, string> = {
  2: '2 · ABC',
  3: '3 · DEF',
  4: '4 · GHI',
  5: '5 · JKL',
  6: '6 · MNO',
  7: '7 · PQRS',
  8: '8 · TUV',
  9: '9 · WXYZ',
  0: '其他',
};

function isLatinLetter(c: string): boolean {
  return /^[A-Za-z]$/.test(c);
}

/**
 * 取展示名第一个「可见字符」对应的拉丁首字母（大写），用于九键分组。
 * 中文取拼音首字母；英文取首字母；数字与多数符号返回空串 → 归入「其他」。
 */
export function firstGroupingLetter(displayName: string): string {
  const s = displayName.trim();
  if (!s) return '';
  const ch = [...s][0];
  if (!ch) return '';
  if (isLatinLetter(ch)) return ch.toUpperCase();
  if (/[0-9]/.test(ch)) return '';
  if (/[\u4e00-\u9fff]/.test(ch)) {
    try {
      const py = pinyin(ch, { pattern: 'first', toneType: 'none' });
      const raw = typeof py === 'string' ? py : String(py ?? '');
      const letter = raw.trim()[0]?.toUpperCase() ?? '';
      return /[A-Z]/.test(letter) ? letter : '';
    } catch {
      return '';
    }
  }
  return '';
}

export function t9GroupKeyFromLetter(letter: string): T9GroupKey {
  if (!letter) return 0;
  const L = letter[0].toUpperCase();
  if ('ABC'.includes(L)) return 2;
  if ('DEF'.includes(L)) return 3;
  if ('GHI'.includes(L)) return 4;
  if ('JKL'.includes(L)) return 5;
  if ('MNO'.includes(L)) return 6;
  if ('PQRS'.includes(L)) return 7;
  if ('TUV'.includes(L)) return 8;
  if ('WXYZ'.includes(L)) return 9;
  return 0;
}

export function t9GroupKeyForDisplayName(displayName: string): T9GroupKey {
  return t9GroupKeyFromLetter(firstGroupingLetter(displayName));
}
