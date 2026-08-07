// src/app/onboarding/match/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  matchDoctors,
  normalizeDoctor,
  type DoctorProfile,
  type IntakeResponses,
} from "@/lib/matching";
import { CheckCircle, Star, Globe, Clock, Users, ArrowRight, Loader2, Heart, RefreshCw, AlertCircle } from "lucide-react";

function MatchCard({ doctor, matchPercent, onSelect, selected }: {
  doctor: DoctorProfile; matchPercent: number;
  onSelect: () => void; selected: boolean;
}) {
  const bio = doctor.bio || "Experienced mental health professional.";
  const specs = doctor.specializations.length > 0 ? doctor.specializations : ["General practice"];
  const langs = doctor.languages.length > 0 ? doctor.languages : ["English"];
  const sessionLabel = doctor.sessionTypes[0] || "Individual Therapy";
  const spots = Math.max((doctor.maxClients || 50) - (doctor.currentClients || 0), 0);

  return (
    <div onClick={onSelect}
      className="rounded-3xl p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: selected ? "rgba(141,198,63,0.12)" : "rgba(255,255,255,0.06)",
        border: `2px solid ${selected ? "#8DC63F" : "rgba(255,255,255,0.1)"}`,
      }}>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          {doctor.photoURL ? (
            <img src={doctor.photoURL} alt={doctor.displayName}
              className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
              style={{ background: "rgba(141,198,63,0.2)", color: "#8DC63F" }}>
              {(doctor.displayName || "T")[0]}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-lg" style={{ fontFamily: "var(--font-dm-serif)" }}>
              {doctor.title} {doctor.displayName}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              {doctor.yearsExperience > 0
                ? `${doctor.yearsExperience} years experience`
                : "Licensed therapist"}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: matchPercent >= 80 ? "rgba(141,198,63,0.2)" : "rgba(247,148,29,0.2)" }}>
            <span className="text-sm font-bold"
              style={{ color: matchPercent >= 80 ? "#8DC63F" : "#F7941D" }}>
              {matchPercent}%
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>match</p>
        </div>
      </div>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
        {bio.length > 150 ? bio.slice(0, 150) + "..." : bio}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {specs.slice(0, 5).map(s => (
          <span key={s} className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: "rgba(141,198,63,0.1)", color: "#8DC63F", border: "1px solid rgba(141,198,63,0.2)" }}>
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
        <span className="flex items-center gap-1.5">
          <Globe size={12} /> {langs.join(", ")}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={12} /> {spots} spots left
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} /> {sessionLabel}
        </span>
      </div>

      {selected && (
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "#8DC63F" }}>
          <CheckCircle size={16} /> Selected
        </div>
      )}
    </div>
  );
}

export default function MatchPage() {
  const { user }    = useAuth();
  const router      = useRouter();
  const [matches,   setMatches]   = useState<{ doctor: DoctorProfile; matchPercent: number }[]>([]);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasIntake, setHasIntake] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const intakeSnap = await getDoc(doc(db, "intakes", user.uid));
        const intake = intakeSnap.exists()
          ? (intakeSnap.data() as IntakeResponses)
          : null;
        if (!cancelled) setHasIntake(!!intake);

        // Single-field query (no composite index). Filter accepting client-side.
        const doctorsSnap = await getDocs(
          query(collection(db, "users"), where("role", "==", "doctor"))
        );
        const doctors = doctorsSnap.docs
          .map(d => normalizeDoctor(d.id, d.data() as Record<string, any>))
          .filter(d => d.acceptingClients !== false);

        let ranked: { doctor: DoctorProfile; matchPercent: number }[];

        if (intake) {
          ranked = matchDoctors(doctors, intake).slice(0, 3);
        } else {
          // Invite-only / admin-created clients may skip intake — still allow pick
          ranked = doctors.map(d => ({ doctor: d, matchPercent: 100 }));
        }

        if (cancelled) return;
        setMatches(ranked);
        if (ranked.length > 0) setSelected(ranked[0].doctor.uid);
      } catch (err) {
        console.error("[match] load failed:", err);
        if (!cancelled) {
          setError("We couldn’t load therapists. Please try again, or ask your admin to assign you.");
          setMatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  async function handleConfirm() {
    if (!user || !selected) return;
    setConfirming(true);
    setError(null);
    try {
      const pick = matches.find(m => m.doctor.uid === selected);
      if (!pick) throw new Error("No therapist selected.");

      await setDoc(doc(db, "assignments", user.uid), {
        clientId:        user.uid,
        clientName:      user.displayName ?? "",
        clientEmail:     user.email ?? "",
        doctorId:        selected,
        doctorName:      pick.doctor.displayName,
        matchPercent:    pick.matchPercent,
        assignedAt:      serverTimestamp(),
        assignedBy:      hasIntake ? "system" : "client",
        status:          "active",
        switchRequested: false,
        switchReason:    null,
      });

      await updateDoc(doc(db, "users", user.uid), {
        doctorId:  selected,
        onboarded: true,
      });

      // Intake may not exist for admin-created invite clients
      try {
        await updateDoc(doc(db, "intakes", user.uid), { status: "matched" });
      } catch {
        /* optional */
      }

      window.location.assign("/client");
    } catch (err) {
      console.error("[match] confirm failed:", err);
      setError("Could not confirm your match. Please try again or contact support.");
      setConfirming(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)" }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(141,198,63,0.15)" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
      <p className="text-white text-lg" style={{ fontFamily: "var(--font-dm-serif)" }}>
        Finding your best match...
      </p>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
        Analysing your responses
      </p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)" }}>

      <div className="px-6 py-5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(141,198,63,0.2)" }}>
          <Heart size={16} style={{ color: "#8DC63F" }} />
        </div>
        <span className="text-white font-semibold" style={{ fontFamily: "var(--font-dm-serif)" }}>Valeo</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">

        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(141,198,63,0.15)" }}>
            <Star size={24} style={{ color: "#8DC63F" }} />
          </div>
          <h1 className="text-3xl text-white mb-3" style={{ fontFamily: "var(--font-dm-serif)" }}>
            {hasIntake ? "Your Recommended Matches" : "Choose Your Therapist"}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            {hasIntake
              ? "Based on your responses, we found the best therapists for you. Select the one you feel most comfortable with."
              : "Select a therapist to continue. Your admin can also assign you from the Assignments console."}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
            style={{ background: "rgba(247,148,29,0.15)", border: "1px solid rgba(247,148,29,0.35)", color: "#F9A84D" }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}
                className="mt-2 text-xs font-semibold underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {matches.length === 0 && !error && (
          <div className="text-center py-12 rounded-3xl"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <RefreshCw size={32} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.3)" }} />
            <p className="text-white font-semibold mb-1">No available therapists right now</p>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
              Ask your admin to assign you from Assignments, or ensure a doctor account has accepting clients enabled.
            </p>
            <button onClick={() => router.push("/client")}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#8DC63F", color: "#2A4A1A" }}>
              Go to Dashboard
            </button>
          </div>
        )}

        {matches.length > 0 && (
          <>
            <div className="space-y-4 mb-8">
              {matches.map((m) => (
                <MatchCard key={m.doctor.uid} doctor={m.doctor}
                  matchPercent={m.matchPercent}
                  selected={selected === m.doctor.uid}
                  onSelect={() => setSelected(m.doctor.uid)} />
              ))}
            </div>

            <button onClick={handleConfirm} disabled={!selected || confirming}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold disabled:opacity-40 transition-all hover:-translate-y-0.5"
              style={{ background: "#8DC63F", color: "#2A4A1A" }}>
              {confirming
                ? <><Loader2 size={18} className="animate-spin" /> Confirming your match...</>
                : <>Confirm & Continue <ArrowRight size={18} /></>}
            </button>

            <p className="text-xs text-center mt-4" style={{ color: "rgba(255,255,255,0.3)" }}>
              You can request a different therapist at any time from your dashboard.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
