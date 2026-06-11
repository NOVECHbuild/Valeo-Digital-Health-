"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  FileText, Plus, Search, X, Loader2, Save,
  Edit3, Trash2, ChevronDown, CheckCircle,
  AlertCircle, Lock, Calendar, User,
} from "lucide-react";

interface Client { uid: string; displayName: string; email: string; }
interface Note {
  id: string; clientId: string; clientName: string; doctorId: string;
  title: string; content: string; sessionDate: string; sessionType: string;
  tags: string[]; createdAt: any; updatedAt: any;
}

const SESSION_TYPES = ["Individual Therapy","Couples Therapy","Life Coaching","Workplace Wellness","Free Consultation"];
const NOTE_TAGS = ["Progress","Concern","Follow-up","Milestone","Crisis","Homework","Assessment","General"];

const TAG_COLORS: Record<string,{bg:string;color:string}> = {
  Progress:    { bg:"rgba(141,198,63,0.12)",  color:"#6BA028" },
  Concern:     { bg:"rgba(247,148,29,0.12)",   color:"#F7941D" },
  "Follow-up": { bg:"rgba(247,148,29,0.12)",  color:"#C4700A" },
  Milestone:   { bg:"rgba(42,74,26,0.1)",     color:"#2A4A1A" },
  Crisis:      { bg:"rgba(247,148,29,0.18)",   color:"#C0392B" },
  Homework:    { bg:"rgba(142,68,173,0.1)",   color:"#8E44AD" },
  Assessment:  { bg:"rgba(52,152,219,0.12)",  color:"#2980B9" },
  General:     { bg:"rgba(138,155,168,0.12)", color:"#8A9BA8" },
};

function TagChip({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { bg:"rgba(42,74,26,0.06)", color:"#4A5568" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background:s.bg, color:s.color }}>{tag}</span>
  );
}

function NoteEditor({ note, clients, doctorId, onSave, onClose }: {
  note: Partial<Note>|null; clients: Client[]; doctorId: string;
  onSave: (n: Omit<Note,"id"|"createdAt"|"updatedAt">) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!(note as Note)?.id;
  const [clientId,    setClientId]    = useState(note?.clientId    ?? "");
  const [title,       setTitle]       = useState(note?.title       ?? "");
  const [content,     setContent]     = useState(note?.content     ?? "");
  const [sessionDate, setSessionDate] = useState(note?.sessionDate ?? new Date().toISOString().split("T")[0]);
  const [sessionType, setSessionType] = useState(note?.sessionType ?? "");
  const [tags,        setTags]        = useState<string[]>(note?.tags ?? []);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string|null>(null);

  const selectedClient = clients.find(c => c.uid === clientId);
  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev,t]);

  async function handleSave() {
    if (!clientId||!title.trim()||!content.trim()||!sessionDate||!sessionType) {
      setError("Please fill in all required fields."); return;
    }
    setSaving(true);
    try {
      await onSave({ clientId, clientName: selectedClient?.displayName??"", doctorId,
        title:title.trim(), content:content.trim(), sessionDate, sessionType, tags });
      onClose();
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
      style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[80vh] flex flex-col"
        style={{ background:"#F6FAF0" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor:"rgba(42,74,26,0.08)" }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color:"#2A4A1A" }}>
              {isEdit ? "Edit Session Note" : "New Session Note"}
            </h3>
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color:"#8A9BA8" }}>
              <Lock size={10} /> Private — only visible to you
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color:"#4A5568" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background:"rgba(247,148,29,0.08)", color:"#F7941D" }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Client *</label>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white", color:clientId?"#22272B":"#8A9BA8" }}>
                <option value="">Select client</option>
                {clients.map(c=><option key={c.uid} value={c.uid}>{c.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Session Type *</label>
              <select value={sessionType} onChange={e=>setSessionType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white", color:sessionType?"#22272B":"#8A9BA8" }}>
                <option value="">Select type</option>
                {SESSION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Session Date *</label>
              <input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Note Title *</label>
              <input type="text" value={title} onChange={e=>setTitle(e.target.value)}
                placeholder="e.g. Session 3 — Anxiety management"
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:"#8A9BA8" }}>Tags</label>
            <div className="flex flex-wrap gap-2">
              {NOTE_TAGS.map(tag=>{
                const sel = tags.includes(tag);
                return (
                  <button key={tag} onClick={()=>toggleTag(tag)}
                    className="px-3 py-1 rounded-full text-xs font-medium border-2 transition-all"
                    style={{ borderColor:sel?"#2A4A1A":"rgba(42,74,26,0.12)", background:sel?"rgba(42,74,26,0.06)":"white", color:sel?"#2A4A1A":"#8A9BA8" }}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Session Notes *</label>
            <textarea value={content} onChange={e=>setContent(e.target.value)} rows={8}
              placeholder="Document session observations, progress, interventions, and plans..."
              className="w-full px-4 py-3 rounded-xl text-sm border resize-none focus:outline-none leading-relaxed"
              style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }} />
            <p className="text-xs mt-1 text-right" style={{ color:"#C4C4C4" }}>{content.length} characters</p>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor:"rgba(42,74,26,0.08)" }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor:"rgba(42,74,26,0.15)", color:"#2A4A1A" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background:"linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            {saving ? <><Loader2 size={14} className="animate-spin"/>Saving...</> : <><Save size={14}/>Save Note</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete }: { note:Note; onEdit:()=>void; onDelete:()=>void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = note.content.slice(0,180);
  const hasMore = note.content.length > 180;

  return (
    <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background:"rgba(42,74,26,0.06)", color:"#2A4A1A" }}>
            {note.clientName?.[0]?.toUpperCase()??"C"}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color:"#2A4A1A" }}>{note.title}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs" style={{ color:"#8A9BA8" }}>
                <User size={10}/>{note.clientName}
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color:"#8A9BA8" }}>
                <Calendar size={10}/>
                {new Date(note.sessionDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color:"#8A9BA8" }}>
            <Edit3 size={14}/>
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color:"#8A9BA8" }}>
            <Trash2 size={14}/>
          </button>
        </div>
      </div>

      <span className="text-xs px-2.5 py-1 rounded-lg font-medium mb-3 inline-block"
        style={{ background:"rgba(42,74,26,0.05)", color:"#4A5568" }}>
        {note.sessionType}
      </span>

      {note.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {note.tags.map(t=><TagChip key={t} tag={t}/>)}
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background:"rgba(42,74,26,0.02)" }}>
        <p className="text-sm leading-relaxed" style={{ color:"#4A5568", whiteSpace:"pre-wrap" }}>
          {expanded ? note.content : preview}{!expanded && hasMore && "..."}
        </p>
        {hasMore && (
          <button onClick={()=>setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium mt-2" style={{ color:"#2A4A1A" }}>
            {expanded?"Show less":"Read more"}
            <ChevronDown size={12} style={{ transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="flex items-center gap-1 text-xs" style={{ color:"#C4C4C4" }}>
          <Lock size={10}/> Private note
        </span>
        <span className="text-xs" style={{ color:"#C4C4C4" }}>
          {note.updatedAt?.toDate ? `Updated ${note.updatedAt.toDate().toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : ""}
        </span>
      </div>
    </div>
  );
}

export default function DoctorNotesPage() {
  const { user } = useAuth();
  const [notes,        setNotes]        = useState<Note[]>([]);
  const [clients,      setClients]      = useState<Client[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [editNote,     setEditNote]     = useState<Partial<Note>|null|false>(false);
  const [deleting,     setDeleting]     = useState<string|null>(null);
  const [toast,        setToast]        = useState<{type:"success"|"error";msg:string}|null>(null);

  function showToast(type:"success"|"error", msg:string) {
    setToast({type,msg}); setTimeout(()=>setToast(null),4000);
  }

  useEffect(()=>{
    if(!user) return;
    (async()=>{
      const notesSnap = await getDocs(query(collection(db,"notes"),where("doctorId","==",user.uid),orderBy("createdAt","desc")));
      setNotes(notesSnap.docs.map(d=>({id:d.id,...d.data()}) as Note));

      const apptSnap = await getDocs(query(collection(db,"appointments"),where("doctorId","==",user.uid)));
      const clientIds = [...new Set(apptSnap.docs.map(d=>(d.data() as any).clientId as string))];

      if(clientIds.length > 0) {
        const clientDocs = await Promise.all(clientIds.map(uid=>getDocs(query(collection(db,"users"),where("uid","==",uid)))));
        const loaded: Client[] = [];
        clientDocs.forEach(snap=>snap.docs.forEach(d=>loaded.push({uid:d.id,...d.data()} as Client)));
        loaded.sort((a,b)=>a.displayName.localeCompare(b.displayName));
        setClients(loaded);
      }
      setLoading(false);
    })();
  },[user]);

  async function handleSave(data: Omit<Note,"id"|"createdAt"|"updatedAt">) {
    if(!user) return;
    const editing = editNote && (editNote as Note).id;
    if(editing) {
      const id = (editNote as Note).id;
      await updateDoc(doc(db,"notes",id),{...data,updatedAt:serverTimestamp()});
      setNotes(p=>p.map(n=>n.id===id?{...n,...data,updatedAt:{toDate:()=>new Date()}}:n));
      showToast("success","Note updated.");
    } else {
      const ref = await addDoc(collection(db,"notes"),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      setNotes(p=>[{id:ref.id,...data,createdAt:{toDate:()=>new Date()},updatedAt:{toDate:()=>new Date()}},...p]);
      showToast("success","Note saved.");
    }
  }

  async function handleDelete(id:string) {
    if(!confirm("Delete this note? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db,"notes",id));
      setNotes(p=>p.filter(n=>n.id!==id));
      showToast("success","Note deleted.");
    } catch { showToast("error","Failed to delete."); }
    finally { setDeleting(null); }
  }

  const filtered = notes.filter(n=>
    (filterClient==="all"||n.clientId===filterClient) &&
    (n.title.toLowerCase().includes(search.toLowerCase())||
     n.clientName.toLowerCase().includes(search.toLowerCase())||
     n.content.toLowerCase().includes(search.toLowerCase()))
  );

  const thisMonth = notes.filter(n=>{
    if(!n.createdAt?.toDate) return false;
    const d=n.createdAt.toDate(), now=new Date();
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  }).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background:toast.type==="success"?"#2A4A1A":"#F7941D", color:"white" }}>
          {toast.type==="success"?<CheckCircle size={16}/>:<AlertCircle size={16}/>}{toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily:"var(--font-dm-serif)", color:"#2A4A1A" }}>Session Notes</h2>
          <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color:"#8A9BA8" }}>
            <Lock size={12}/> Private and confidential — only visible to you
          </p>
        </div>
        <button onClick={()=>setEditNote({})}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all"
          style={{ background:"linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
          <Plus size={15}/> New Note
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Total Notes", value:notes.length,                               accent:"#2A4A1A" },
          { label:"Clients",     value:new Set(notes.map(n=>n.clientId)).size,     accent:"#8DC63F" },
          { label:"This Month",  value:thisMonth,                                  accent:"#F7941D" },
        ].map(({label,value,accent})=>(
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:accent+"12" }}>
              <FileText size={16} style={{ color:accent }}/>
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none"
                style={{ fontFamily:"var(--font-dm-serif)", color:"#2A4A1A" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color:"#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color:"#8A9BA8" }}/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
            style={{ borderColor:"rgba(42,74,26,0.12)", background:"white" }}/>
          {search && <button onClick={()=>setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2"><X size={13} style={{ color:"#8A9BA8" }}/></button>}
        </div>
        <select value={filterClient} onChange={e=>setFilterClient(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
          style={{ borderColor:"rgba(42,74,26,0.12)", background:"white", color:"#22272B" }}>
          <option value="all">All Clients</option>
          {clients.map(c=><option key={c.uid} value={c.uid}>{c.displayName}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color:"#8DC63F" }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background:"rgba(141,198,63,0.08)" }}>
            <FileText size={24} style={{ color:"#8DC63F" }}/>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color:"#2A4A1A" }}>
            {search?"No notes found":"No session notes yet"}
          </p>
          <p className="text-xs mb-4" style={{ color:"#8A9BA8" }}>
            {search?"Try different search terms.":"Create your first note after a session."}
          </p>
          {!search && (
            <button onClick={()=>setEditNote({})}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background:"linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
              <Plus size={14}/> New Note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(note=>(
            <div key={note.id} style={{ opacity:deleting===note.id?0.5:1, transition:"opacity 0.2s" }}>
              <NoteCard note={note} onEdit={()=>setEditNote(note)} onDelete={()=>handleDelete(note.id)}/>
            </div>
          ))}
        </div>
      )}

      {editNote !== false && (
        <NoteEditor note={editNote} clients={clients} doctorId={user?.uid??""} onSave={handleSave} onClose={()=>setEditNote(false)}/>
      )}
    </div>
  );
}
