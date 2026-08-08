"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Lightbulb, Mic } from "lucide-react";

/**
 * Short in-app SOP: how doctors get a Meet capture to upload into Valeo,
 * plus a nudge toward Google Workspace (needed for reliable Meet recording).
 */
export default function MeetRecordingGuide({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(141,198,63,0.06)",
        border: "1px solid rgba(141,198,63,0.2)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#2A4A1A" }}>
          <Mic size={15} style={{ color: "#6BA028" }} />
          How to get a Meet recording or transcript
        </span>
        {open
          ? <ChevronUp size={16} style={{ color: "#8A9BA8" }} />
          : <ChevronDown size={16} style={{ color: "#8A9BA8" }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs leading-relaxed" style={{ color: "#4A5568" }}>
          <ol className="list-decimal pl-4 space-y-2">
            <li>
              In <strong>Google Meet</strong>, as host, start <strong>Record</strong>
              (and Transcript if available) at the beginning of the session. Tell the client you are recording.
            </li>
            <li>
              When the call ends, Google processes the file. You usually get an email and a copy in{" "}
              <strong>Google Drive</strong> (often under Meet Recordings).
            </li>
            <li>
              Download the <strong>audio</strong> (or copy the Meet transcript text), then upload or paste it
              here. Valeo drafts a clinical note for you to review and file.
            </li>
          </ol>

          <div
            className="rounded-lg p-3 flex gap-2.5"
            style={{ background: "rgba(42,74,26,0.05)" }}
          >
            <Lightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#F7941D" }} />
            <div>
              <p className="font-semibold mb-1" style={{ color: "#2A4A1A" }}>
                Tip: use Google Workspace
              </p>
              <p>
                Reliable Meet recording and transcripts usually need a{" "}
                <strong>Google Workspace</strong> account (personal Gmail often cannot record).
                If recording options are missing in Meet, ask your admin to enable Workspace —
                it makes filing sessions into Valeo much smoother.
              </p>
              <a
                href="https://workspace.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 font-semibold hover:underline"
                style={{ color: "#6BA028" }}
              >
                Learn about Google Workspace <ExternalLink size={11} />
              </a>
            </div>
          </div>

          <p style={{ color: "#8A9BA8" }}>
            Clinical files stay with <strong>you</strong> (the session therapist) only — not visible to
            the client in the app, and not moved if they later work with another therapist.
          </p>
        </div>
      )}
    </div>
  );
}
