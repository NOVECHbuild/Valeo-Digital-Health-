"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useConversations, useMessages,
  sendMessage, markRead,
} from "@/lib/useMessages";
import {
  MessageCircle, Send, Loader2, Lock, Search, X,
  CheckCheck, Check, ChevronLeft, Users, AlertCircle,
  Clock, Smile,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * FIX: Handles both Firestore Timestamps AND ISO strings.
 * Original only called .toDate() which crashes on admin-created records.
 */
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return null;
}

/**
 * FIX: No longer calls new Date() at module/render level.
 * Original had new Date() on line 19 outside any effect — hydration risk.
 */
function timeLabel(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  const now     = new Date();                          // safe — only runs client-side in event handlers / effects
  const diffMs  = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullTime(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateDivider(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay= new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function sameDay(a: any, b: any): boolean {
  const da = toDate(a), db = toDate(b);
  if (!da || !db) return false;
  return da.toDateString() === db.toDateString();
}

// ══════════════════════════════════════════════════════════════
//  QUICK REPLIES — common doctor responses to save typing
// ══════════════════════════════════════════════════════════════
const QUICK_REPLIES = [
  "I'll get back to you shortly.",
  "Your appointment is confirmed.",
  "Please check your email for the meeting link.",
  "Thank you for reaching out!",
  "Could you clarify what you mean?",
];

// ══════════════════════════════════════════════════════════════
//  BUBBLE
// ══════════════════════════════════════════════════════════════
function Bubble({ msg, isOwn, isLastInGroup }: {
  msg: any; isOwn: boolean; isLastInGroup: boolean;
}) {
  // FIX: CheckCheck only shown when message is actually read by the other party.
  // Original showed it on ALL own messages regardless of read status.
  const isRead = msg.readByClient === true;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-0.5`}>
      <div className="max-w-[72%]">
        <div className="px-4 py-2.5 text-sm leading-relaxed"
          style={{
            background:   isOwn ? "linear-gradient(135deg, #2A4A1A, #3D6B24)" : "white",
            color:        isOwn ? "white" : "#22272B",
            boxShadow:    isOwn ? "none" : "0 1px 3px rgba(42,74,26,0.08)",
            // Grouped bubble corners — tighter radius for consecutive messages
            borderRadius: isOwn
              ? isLastInGroup ? "18px 18px 4px 18px" : "18px 18px 4px 18px"
              : isLastInGroup ? "18px 18px 18px 4px" : "18px 18px 18px 4px",
          }}>
          {msg.text}
        </div>
        {/* Only show timestamp on last bubble in a group */}
        {isLastInGroup && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${isOwn ? "justify-end" : "justify-start"}`}
            style={{ color: "#C4C4C4" }}>
            {fullTime(msg.createdAt)}
            {isOwn && (
              isRead
                ? <CheckCheck size={11} style={{ color: "#8DC63F" }}/>
                : <Check size={11} style={{ color: "#C4C4C4" }}/>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function DoctorMessagesPage() {
  const { user } = useAuth();

  const { conversations, loading: convLoading } = useConversations(user?.uid ?? "", "doctor");

  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [clientName,  setClientName]  = useState("");
  const [text,        setText]        = useState("");
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState("");       // FIX: error state was missing
  const [search,      setSearch]      = useState("");
  const [mobileView,  setMobileView]  = useState<"list" | "chat">("list");
  const [showQuick,   setShowQuick]   = useState(false);    // quick replies panel

  const { messages, loading: msgLoading, error: msgError } = useMessages(activeId);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when conversation is opened or new messages arrive
  useEffect(() => {
    if (activeId) markRead(activeId, "doctor");
  }, [activeId, messages.length]);

  // FIX: Auto-open first conversation — missing `activeId` in dep array caused
  // stale closure. Now guarded properly.
  useEffect(() => {
    if (conversations.length > 0 && !activeId) {
      setActiveId(conversations[0].id);
      setClientName(conversations[0].clientName);
    }
  }, [conversations, activeId]);

  // FIX: Textarea auto-resize — original used `onInput` which is non-standard
  // in React. Now handled via useEffect watching the text state.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // FIX: Doctor name — original hardcoded "Dr. Miller".
  // Now strips leading "Dr." from displayName and rebuilds properly.
  const rawName   = user?.displayName ?? "Doctor";
  const cleanName = rawName.replace(/^Dr\.?\s*/i, "");
  const senderName = `Dr. ${cleanName}`;

  async function handleSend() {
    if (!text.trim() || !activeId || !user) return;
    setSending(true);
    setSendError("");
    try {
      await sendMessage(activeId, user.uid, senderName, "doctor", text.trim());
      setText("");
      setShowQuick(false);
    } catch (err) {
      // FIX: No error handling existed — failed sends were silent
      setSendError("Failed to send. Tap to retry.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function openConv(id: string, cName: string) {
    setActiveId(id);
    setClientName(cName);
    setMobileView("chat");
    setSendError("");
  }

  function applyQuickReply(reply: string) {
    setText(reply);
    setShowQuick(false);
    textareaRef.current?.focus();
  }

  const filtered     = conversations.filter(c =>
    c.clientName.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread  = conversations.reduce((s, c) => s + (c.unreadDoctor ?? 0), 0);
  const activeConv   = conversations.find(c => c.id === activeId);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="rounded-3xl overflow-hidden flex"
        style={{
          height: "calc(100vh - 160px)", minHeight: "520px",
          background: "white", boxShadow: "0 2px 12px rgba(42,74,26,0.08)",
        }}>

        {/* ══════════════════════════════════
             SIDEBAR — conversation list
        ══════════════════════════════════ */}
        <div className={`flex-shrink-0 border-r flex flex-col
          ${mobileView === "chat" ? "hidden md:flex" : "flex"} w-full md:w-72`}
          style={{ borderColor: "rgba(42,74,26,0.08)" }}>

          {/* Sidebar header — page name lives in the sticky header */}
          <div className="p-5 border-b" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs" style={{ color: "#8A9BA8" }}>
                Client conversations
              </p>
              {totalUnread > 0 && (
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "#F7941D" }}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "#8A9BA8" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs border focus:outline-none"
                style={{ borderColor: "rgba(42,74,26,0.12)", background: "rgba(42,74,26,0.02)" }} />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X size={11} style={{ color: "#8A9BA8" }} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin" style={{ color: "#8DC63F" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-5 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(141,198,63,0.08)" }}>
                  {search
                    ? <Search size={20} style={{ color: "#8DC63F" }} />
                    : <Users  size={20} style={{ color: "#8DC63F" }} />}
                </div>
                <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>
                  {search ? "No clients found" : "No messages yet"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>
                  {search ? "Try a different name." : "Clients will message you here."}
                </p>
              </div>
            ) : (
              filtered.map(conv => {
                const isActive = conv.id === activeId;
                const unread   = conv.unreadDoctor ?? 0;

                // FIX: Show "You: …" prefix when the doctor sent the last message.
                // Original showed raw lastMessage with no sender context.
                const lastMsgPrefix = conv.lastSenderId === user?.uid ? "You: " : "";

                return (
                  <button key={conv.id} onClick={() => openConv(conv.id, conv.clientName)}
                    className="w-full text-left px-5 py-4 border-b transition-colors hover:bg-black/[0.02]"
                    style={{
                      borderColor: "rgba(42,74,26,0.05)",
                      background: isActive ? "rgba(42,74,26,0.04)" : "transparent",
                    }}>
                    <div className="flex items-center gap-3">
                      {/* Avatar with unread dot */}
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                          style={{ background: "linear-gradient(135deg, #8DC63F, #6BA028)", color: "white" }}>
                          {conv.clientName?.[0]?.toUpperCase() ?? "C"}
                        </div>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                            style={{ background: "#F7941D", fontSize: "9px", fontWeight: 700 }}>
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm truncate"
                            style={{ color: "#2A4A1A", fontWeight: unread > 0 ? 700 : 600 }}>
                            {conv.clientName}
                          </p>
                          <span className="text-xs flex-shrink-0" style={{ color: "#C4C4C4" }}>
                            {timeLabel(conv.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-0.5"
                          style={{
                            color:      unread > 0 ? "#2A4A1A" : "#8A9BA8",
                            fontWeight: unread > 0 ? 500 : 400,
                          }}>
                          {lastMsgPrefix}{conv.lastMessage || "No messages yet"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
            <p className="flex items-center gap-1.5 text-xs" style={{ color: "#C4C4C4" }}>
              <Lock size={10} /> Messages are private and HIPAA compliant
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════
             CHAT PANEL
        ══════════════════════════════════ */}
        <div className={`flex-1 flex flex-col min-w-0
          ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>

          {activeId && activeConv ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
                style={{ borderColor: "rgba(42,74,26,0.08)" }}>
                <button onClick={() => setMobileView("list")}
                  className="md:hidden p-1 rounded-lg hover:bg-black/5">
                  <ChevronLeft size={18} style={{ color: "#4A5568" }} />
                </button>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #8DC63F, #6BA028)", color: "white" }}>
                  {clientName?.[0]?.toUpperCase() ?? "C"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{clientName}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: "#8A9BA8" }}>
                    <Clock size={10}/>
                    Last active {timeLabel(activeConv.lastMessageAt)}
                  </p>
                </div>
                {/* Unread badge in header */}
                {(activeConv.unreadDoctor ?? 0) > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: "rgba(247,148,29,0.1)", color: "#F7941D" }}>
                    {activeConv.unreadDoctor} new
                  </span>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4"
                style={{ background: "rgba(42,74,26,0.01)" }}>
                {msgLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin" style={{ color: "#8DC63F" }} />
                  </div>
                ) : msgError ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <AlertCircle size={20} style={{ color: "#F7941D" }} className="mb-2" />
                    <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>{msgError}</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: "rgba(141,198,63,0.08)" }}>
                      <MessageCircle size={20} style={{ color: "#8DC63F" }} />
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
                      Start the conversation
                    </p>
                    <p className="text-xs" style={{ color: "#8A9BA8" }}>
                      Send a message to reach {clientName}.
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const isOwn = msg.senderId === user?.uid;
                      const next  = messages[i + 1];
                      const prev  = messages[i - 1];

                      // Date divider between different days
                      const showDateDiv = i === 0 || !sameDay(msg.createdAt, prev?.createdAt);

                      // Group consecutive messages from same sender.
                      // Only show timestamp on the LAST bubble in a group.
                      const isLastInGroup = !next || next.senderId !== msg.senderId
                        || !sameDay(msg.createdAt, next?.createdAt);

                      return (
                        <div key={msg.id}>
                          {showDateDiv && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px" style={{ background: "rgba(42,74,26,0.08)" }} />
                              <span className="text-xs px-3 py-1 rounded-full"
                                style={{ color: "#8A9BA8", background: "rgba(42,74,26,0.04)" }}>
                                {dateDivider(msg.createdAt)}
                              </span>
                              <div className="flex-1 h-px" style={{ background: "rgba(42,74,26,0.08)" }} />
                            </div>
                          )}
                          <Bubble msg={msg} isOwn={isOwn} isLastInGroup={isLastInGroup} />
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Quick replies panel */}
              {showQuick && (
                <div className="px-5 pt-3 pb-1 border-t flex-shrink-0 flex flex-wrap gap-2"
                  style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                  {QUICK_REPLIES.map(r => (
                    <button key={r} onClick={() => applyQuickReply(r)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:-translate-y-0.5"
                      style={{ background: "rgba(42,74,26,0.06)", color: "#2A4A1A" }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="px-5 py-4 border-t flex-shrink-0"
                style={{ borderColor: "rgba(42,74,26,0.08)" }}>

                {/* FIX: Send error feedback — was completely missing */}
                {sendError && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
                    <AlertCircle size={12}/>
                    {sendError}
                    <button onClick={handleSend} className="ml-auto font-semibold underline">
                      Retry
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* Quick reply toggle */}
                  <button onClick={() => setShowQuick(q => !q)}
                    className="p-2.5 rounded-xl flex-shrink-0 transition-colors mb-0.5"
                    style={{
                      background: showQuick ? "rgba(42,74,26,0.08)" : "transparent",
                      color: "#8A9BA8",
                    }}
                    title="Quick replies">
                    <Smile size={18}/>
                  </button>

                  {/* FIX: Textarea resize now uses React onChange + useEffect,
                      not the non-standard onInput event handler */}
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a reply…"
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
                    aria-label="Reply"
                  />

                  <button onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all mb-0.5"
                    style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                    aria-label="Send reply">
                    {sending
                      ? <Loader2 size={16} className="animate-spin text-white" />
                      : <Send    size={16} className="text-white" />}
                  </button>
                </div>

                <p className="text-[11px] sm:text-xs mt-2 leading-snug" style={{ color: "#C4C4C4" }}>
                  Do not share clinical diagnoses via chat. Use session notes for clinical records.
                </p>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: "rgba(42,74,26,0.05)" }}>
                <MessageCircle size={28} style={{ color: "#8A9BA8" }} />
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: "#2A4A1A" }}>
                Select a conversation
              </p>
              <p className="text-sm" style={{ color: "#8A9BA8" }}>
                Choose a client from the list to view messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
