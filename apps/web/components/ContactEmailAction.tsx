'use client';

import { useState, type ReactNode } from 'react';

/** QQ 邮箱网页版 */
export const QQ_MAIL_URL = 'https://mail.qq.com/';

type ContactEmailActionProps = {
  email: string;
  className?: string;
  children: ReactNode;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function ContactEmailAction({ email, className, children }: ContactEmailActionProps) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const text = email.trim();
    if (!text) return;

    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt('请手动复制邮箱', text);
    }

    window.open(QQ_MAIL_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="relative inline-flex">
      <button type="button" className={className} onClick={() => void onClick()}>
        {children}
      </button>
      {copied ? (
        <span className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-[#222] px-2 py-0.5 text-[11px] text-white">
          已复制，正在打开 QQ 邮箱
        </span>
      ) : null}
    </div>
  );
}
