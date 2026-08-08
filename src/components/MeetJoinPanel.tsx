"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Video } from "lucide-react";
import JoinSessionLink from "@/components/JoinSessionLink";
import { meetCodeFromLink, openMeetLink } from "@/lib/openMeet";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Primary Join button plus fallbacks (Meet code, copy link, open in browser)
 * for when Google's page errors on mobile.
 */
export default function MeetJoinPanel({
  meetLink,
  className = "",
}: {
  meetLink: string;
  className?: string;
}) {
  const code = meetCodeFromLink(meetLink);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  async function handleCopy(which: "link" | "code", value: string) {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <JoinSessionLink
        href={meetLink}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
      >
        <Video size={14} /> Join Session
      </JoinSessionLink>

      <div
        className="rounded-xl px-3 py-2.5 space-y-2"
        style={{ background: "rgba(42,74,26,0.04)", border: "1px solid rgba(42,74,26,0.08)" }}
      >
        {code && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#8A9BA8" }}>
                Meet code
              </p>
              <p className="text-sm font-semibold font-mono tracking-wide" style={{ color: "#1E3810" }}>
                {code}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy("code", code)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
              style={{ background: "white", color: "#2A4A1A", border: "1px solid rgba(42,74,26,0.12)" }}
            >
              {copied === "code" ? <Check size={12} /> : <Copy size={12} />}
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCopy("link", meetLink)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "white", color: "#2A4A1A", border: "1px solid rgba(42,74,26,0.12)" }}
          >
            {copied === "link" ? <Check size={12} /> : <Copy size={12} />}
            {copied === "link" ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => openMeetLink(meetLink)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "white", color: "#2B6CB0", border: "1px solid rgba(66,133,244,0.25)" }}
          >
            <ExternalLink size={12} /> Open in browser
          </button>
        </div>

        <p className="text-[11px] leading-snug" style={{ color: "#8A9BA8" }}>
          If Google shows an error, paste the link in Chrome or Safari, or open the Meet app and enter the code.
          You can usually join as a guest — a Google account isn&apos;t required.
        </p>
      </div>
    </div>
  );
}
