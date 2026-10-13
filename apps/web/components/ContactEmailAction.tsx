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
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void onClick()}>
        {children}
      </button>
      {copied ? (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[9999] -translate-x-1/2 animate-[fadeIn_0.3s_ease] rounded-lg border border-[#E8F5E9] bg-white px-5 py-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 flex-shrink-0 text-[#67C23A]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-[#333]">邮箱已复制到剪贴板</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
