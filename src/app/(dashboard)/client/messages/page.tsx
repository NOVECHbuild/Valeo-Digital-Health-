"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useConversations, useMessages,
  sendMessage, markRead, getOrCreateConversation,
} from "@/lib/useMessages";
import {
  MessageCircle, Send, Loader2, Lock,
  CheckCheck, Check, ChevronLeft, AlertCircle,
} from "lucide-react";
import { useAssignedDoctor } from "@/hooks/useAssignedDoctor";

// ── Helpers ────────────────────────────────────────────────────────────────

// FIX 1: Unified timestamp helper — handles Firestore Timestamp AND ISO strings
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  if (ts instanceof Date) return ts;
  return null;
}

function timeLabel(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullTime(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sameDay(a: any, b: any): boolean {
  const da = toDate(a), db_ = toDate(b);
  if (!da || !db_) return false;
  return da.toDateString() === db_.toDateString();
}

// ── Message bubble ─────────────────────────────────────────────────────────
function Bubble({ msg, isOwn }: { msg: any; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div className="max-w-[72%]">
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
          style={{
            background:   isOwn ? "linear-gradient(135deg, #2A4A1A, #3D6B24)" : "white",
            color:        isOwn ? "white" : "#22272B",
            borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            boxShadow:    isOwn ? "none" : "0 1px 3px rgba(42,74,26,0.08)",
          }}
        >
          {msg.text}
        </div>
        <p
          className={`text-xs mt-1 ${isOwn ? "text-right" : "text-left"}`}
          style={{ color: "#C4C4C4" }}
        >
          {fullTime(msg.createdAt)}
          {isOwn && (
            msg._optimistic ? (
              <Check size={11} className="inline ml-1" style={{ color: "#C4C4C4" }} />
            ) : msg.readByDoctor === true ? (
              <CheckCheck size={11} className="inline ml-1" style={{ color: "#8DC63F" }} />
            ) : (
              <Check size={11} className="inline ml-1" style={{ color: "#C4C4C4" }} />
            )
          )}
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ClientMessagesPage() {
  const { user } = useAuth();

  const { conversations, loading: convLoading } = useConversations(user?.uid ?? "", "client");
  const { doctor } = useAssignedDoctor();   // the client's assigned therapist

  const [activeId,     setActiveId]    = useState<string | null>(null);
  const [text,         setText]        = useState("");
  const [sending,      setSending]     = useState(false);
  const [sendError,    setSendError]   = useState<string | null>(null);  // FIX 10
  const [mobileView,   setMobileView]  = useState<"list" | "chat">("list");
  const [doctorName,   setDoctorName]  = useState("");
  const [startingNew,  setStartingNew] = useState(false);
  const [startError,   setStartError]  = useState<string | null>(null);  // FIX 5

  // S1: optimistic local messages appended before Firestore confirms
  const [optimistic, setOptimistic] = useState<any[]>([]);

  const { messages, loading: msgLoading, error: msgError } = useMessages(activeId);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // FIX 9: ref for resize

  // Merge live messages with optimistic ones, de-duping by id / matching text
  const allMessages = [
    ...messages,
    ...optimistic.filter(o =>
      !messages.find(m =>
        m.id === o.id || (m.senderId === o.senderId && m.text === o.text)
      )
    ),
  ];

  // Drop optimistic bubbles once the real message lands
  useEffect(() => {
    if (!messages.length) return;
    setOptimistic(prev =>
      prev.filter(o =>
        !messages.some(m => m.senderId === o.senderId && m.text === o.text)
      )
    );
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  // FIX 2: markRead only when activeId changes (not on every new message)
  useEffect(() => {
    if (activeId) markRead(activeId, "client");
  }, [activeId]);

  // Auto-open first conversation on desktop. On mobile, open chat only when
  // there's a single thread (typical client) so the list stays instant otherwise.
  useEffect(() => {
    if (activeId || conversations.length === 0) return;
    const first = conversations[0];
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile && conversations.length > 1) return;
    setActiveId(first.id);
    setDoctorName(first.doctorName ?? "your therapist");
    if (isMobile && conversations.length === 1) setMobileView("chat");
  }, [conversations, activeId]);

  // FIX 5: Full try/catch — spinner always stops, error shown to user
  async function startConversation() {
    if (!user) return;
    setStartingNew(true);
    setStartError(null);
    try {
      // Start the conversation with the client's ASSIGNED doctor (not the first one).
      if (!doctor) {
        setStartError("You haven't been matched with a therapist yet.");
        return;
      }
      const convId = await getOrCreateConversation(
        user.uid,
        user.displayName ?? "Client",
        doctor.doctorId,
        doctor.doctorName,
      );
      setActiveId(convId);
      setDoctorName(doctor.doctorName);
      setMobileView("chat");
    } catch (err) {
      console.error("[Messages] startConversation:", err);
      setStartError("Failed to start conversation. Please try again.");
    } finally {
      setStartingNew(false); // always clears spinner
    }
  }

  // FIX 4: Removed dead `conv` variable
  // FIX 10: Catch send errors and show them inline
  // S1: Optimistic append
  // S4: Reset textarea height after sending
  async function handleSend() {
    if (!text.trim() || !activeId || !user) return;
    const content = text.trim();
    setSendError(null);
    setText("");

    // S1: Append optimistic bubble immediately
    const tempId = `opt-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text: content,
      senderId: user.uid,
      createdAt: new Date(),
      _optimistic: true,
    };
    setOptimistic(prev => [...prev, optimisticMsg]);

    // S4: Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setSending(true);
    try {
      await sendMessage(activeId, user.uid, user.displayName ?? "Client", "client", content);
      // Keep optimistic until onSnapshot confirms (see effect above)
    } catch (err) {
      console.error("[Messages] sendMessage:", err);
      setOptimistic(prev => prev.filter(m => m.id !== tempId));
      setSendError("Failed to send message. Please try again.");
      setText(content); // restore text so user doesn't lose it
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // FIX 9: Resize via ref, not e.target cast
  function handleTextareaInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function openConv(id: string, dName: string) {
    setActiveId(id);
    setDoctorName(dName);
    setMobileView("chat");
    setSendError(null);
    setOptimistic([]);
  }

  const activeConv = conversations.find(c => c.id === activeId);

  return (
    <div className="max-w-5xl mx-auto">
      <div
        className="rounded-3xl overflow-hidden flex"
        style={{
          height: "calc(100dvh - 11.5rem - env(safe-area-inset-bottom, 0px))",
          minHeight: "420px",
          background: "white",
          boxShadow: "0 2px 12px rgba(42,74,26,0.08)",
        }}
      >

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div
          className={`flex-shrink-0 border-r flex flex-col
            ${mobileView === "chat" ? "hidden md:flex" : "flex"} w-full md:w-72`}
          style={{ borderColor: "rgba(42,74,26,0.08)" }}
        >
          {/* Sidebar header — page name lives in the sticky header */}
          <div className="p-5 border-b" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>
              Secure conversations with your therapist
            </p>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin" style={{ color: "#8DC63F" }} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-5 text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(141,198,63,0.08)" }}
                >
                  <MessageCircle size={20} style={{ color: "#8DC63F" }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
                  No messages yet
                </p>
                <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>
                  Start a conversation with your therapist.
                </p>
                {/* FIX 5: Show error if startConversation fails */}
                {startError && (
                  <p className="text-xs mb-3 flex items-center justify-center gap-1"
                    style={{ color: "#F7941D" }}>
                    <AlertCircle size={12} />{startError}
                  </p>
                )}
                <button
                  onClick={startConversation}
                  disabled={startingNew}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                >
                  {startingNew
                    ? <Loader2 size={13} className="animate-spin" />
                    : <MessageCircle size={13} />}
                  Message Therapist
                </button>
              </div>
            ) : (
              conversations.map(conv => {
                const isActive = conv.id === activeId;
                // FIX 11: Cap unread badge at 9+
                const unread = conv.unreadClient ?? 0;
                const unreadLabel = unread > 9 ? "9+" : unread > 0 ? String(unread) : null;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConv(conv.id, conv.doctorName ?? "your therapist")}
                    className="w-full text-left px-5 py-4 border-b transition-colors hover:bg-black/[0.02]"
                    style={{
                      borderColor: "rgba(42,74,26,0.05)",
                      background:  isActive ? "rgba(42,74,26,0.04)" : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", color: "white" }}
                      >
                        {conv.doctorName?.[0]?.toUpperCase() ?? "D"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold truncate" style={{ color: "#2A4A1A" }}>
                            {conv.doctorName ?? "Your Therapist"}
                          </p>
                          <span className="text-xs flex-shrink-0 ml-1" style={{ color: "#C4C4C4" }}>
                            {/* FIX 1: timeLabel now handles ISO strings too */}
                            {timeLabel(conv.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs truncate" style={{ color: "#8A9BA8" }}>
                            {conv.lastMessage || "Start a conversation"}
                          </p>
                          {/* FIX 11: Capped badge */}
                          {unreadLabel && (
                            <span
                              className="min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ml-1 text-white"
                              style={{ background: "#8DC63F" }}
                            >
                              {unreadLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Privacy note */}
          <div className="p-4 border-t" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
            <p className="flex items-center gap-1.5 text-xs" style={{ color: "#C4C4C4" }}>
              <Lock size={10} /> End-to-end encrypted · HIPAA compliant
            </p>
          </div>
        </div>

        {/* ── Chat panel ──────────────────────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col min-w-0
            ${mobileView === "list" ? "hidden md:flex" : "flex"}`}
        >
          {activeId && activeConv ? (
            <>
              {/* Chat header */}
              <div
                className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
                style={{ borderColor: "rgba(42,74,26,0.08)" }}
              >
                {/* Mobile back */}
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden p-1 rounded-lg hover:bg-black/5"
                >
                  <ChevronLeft size={18} style={{ color: "#4A5568" }} />
                </button>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", color: "white" }}
                >
                  {doctorName?.[0]?.toUpperCase() ?? "D"}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                    {doctorName || "Your Therapist"}
                  </p>
                  {/* FIX 8: Show generic "Therapist" instead of hardcoded specialty */}
                  <p className="text-xs flex items-center gap-1" style={{ color: "#8DC63F" }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: "#8DC63F" }}
                    />
                    {activeConv.doctorSpecialization ?? "Therapist"}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                {msgLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin" style={{ color: "#8DC63F" }} />
                  </div>
                ) : msgError ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <AlertCircle size={20} style={{ color: "#F7941D" }} className="mb-2" />
                    <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>{msgError}</p>
                  </div>
                ) : allMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: "rgba(141,198,63,0.08)" }}
                    >
                      <MessageCircle size={20} style={{ color: "#8DC63F" }} />
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
                      Start the conversation
                    </p>
                    <p className="text-xs" style={{ color: "#8A9BA8" }}>
                      Say hello or ask a question between sessions.
                    </p>
                  </div>
                ) : (
                  <>
                    {allMessages.map((msg, i) => {
                      const isOwn = msg.senderId === user?.uid;

                      // FIX 6: Safe date comparison using toDate() helper
                      const showDate =
                        i === 0 ||
                        !sameDay(allMessages[i - 1].createdAt, msg.createdAt);

                      const dateLabel = toDate(msg.createdAt)?.toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      }) ?? "";

                      return (
                        <div key={msg.id}>
                          {showDate && dateLabel && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px" style={{ background: "rgba(42,74,26,0.08)" }} />
                              <span className="text-xs px-3" style={{ color: "#C4C4C4" }}>
                                {dateLabel}
                              </span>
                              <div className="flex-1 h-px" style={{ background: "rgba(42,74,26,0.08)" }} />
                            </div>
                          )}
                          <Bubble msg={msg} isOwn={isOwn} />
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input area */}
              <div
                className="px-3 sm:px-5 py-3 sm:py-4 border-t flex-shrink-0"
                style={{ borderColor: "rgba(42,74,26,0.08)" }}
              >
                {sendError && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-3"
                    style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}
                  >
                    <AlertCircle size={13} />
                    {sendError}
                    <button
                      onClick={() => setSendError(null)}
                      className="ml-auto text-xs underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2 sm:gap-3">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => { setText(e.target.value); handleTextareaInput(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    enterKeyHint="send"
                    className="msg-composer flex-1 min-w-0 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-sm border resize-none focus:outline-none"
                    style={{
                      borderColor: "rgba(42,74,26,0.12)",
                      background:  "#F7F9F4",
                      color:       "#2A4A1A",
                      minHeight:   "44px",
                      maxHeight:   "120px",
                      lineHeight:  "1.4",
                      overflowY:   "auto",
                    }}
                    aria-label="Message"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
                    style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                    aria-label="Send message"
                  >
                    {sending
                      ? <Loader2 size={16} className="animate-spin text-white" />
                      : <Send size={16} className="text-white" />}
                  </button>
                </div>
                <p className="text-[11px] sm:text-xs mt-2 leading-snug" style={{ color: "#C4C4C4" }}>
                  Private &amp; secure. For emergencies call 911.
                  <span className="hidden sm:inline"> Enter to send · Shift+Enter for a new line.</span>
                </p>
              </div>
            </>
          ) : (
            /* No conversation selected — S3: CTA in the chat panel too */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: "rgba(42,74,26,0.05)" }}
              >
                <MessageCircle size={28} style={{ color: "#8A9BA8" }} />
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: "#2A4A1A" }}>
                Your messages
              </p>
              <p className="text-sm mb-5" style={{ color: "#8A9BA8" }}>
                {conversations.length > 0
                  ? "Select a conversation to continue."
                  : "Send your therapist a message between sessions."}
              </p>
              {/* S3: CTA when no conversations exist, shown in the chat panel */}
              {conversations.length === 0 && !convLoading && (
                <>
                  {startError && (
                    <p className="text-xs mb-3 flex items-center gap-1" style={{ color: "#F7941D" }}>
                      <AlertCircle size={12} />{startError}
                    </p>
                  )}
                  <button
                    onClick={startConversation}
                    disabled={startingNew}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                  >
                    {startingNew
                      ? <Loader2 size={14} className="animate-spin" />
                      : <MessageCircle size={14} />}
                    Message Your Therapist
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
