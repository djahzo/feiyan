/** 中文展示名排序；部分移动端 WebView 不支持 zh-Hans-CN，会抛 RangeError */
export function compareZhDisplayName(a: string, b: string): number {
  const locales = ['zh-Hans-CN', 'zh-CN', 'zh-Hans', 'zh'] as const;
  for (const locale of locales) {
    try {
      return a.localeCompare(b, locale);
    } catch {
      /* 尝试下一个 locale */
    }
  }
  return a.localeCompare(b);
}

/** 兼容 DOMStringList，避免部分浏览器上 spread types 失败 */
export function dataTransferTypeList(dt: DataTransfer | null | undefined): string[] {
  if (!dt) return [];
  try {
    const types = dt.types;
    if (!types) return [];
    return Array.from(types as ArrayLike<string>);
  } catch {
    return [];
  }
}
