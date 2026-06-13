// src/app/api/ai/session-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rateLimit";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Clinical summary prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a clinical documentation assistant for a health psychologist. 
Your role is to analyse session transcripts and generate structured clinical notes.
You must be objective, clinically accurate, and use professional psychological terminology.
Never invent or assume details not present in the transcript.
Always flag uncertainty with phrases like "client appeared to" or "possible indication of".`;

const SUMMARY_PROMPT = (transcript: string) => `
Analyse this therapy session transcript and produce a structured clinical report in the following JSON format.
Return ONLY valid JSON, no markdown, no preamble.

Transcript:
"""
${transcript}
"""

Required JSON structure:
{
  "sessionSummary": "2-3 sentence plain-language summary of what was covered",
  "soap": {
    "subjective": "What the client reported — symptoms, feelings, concerns in their own words",
    "objective": "Observable behaviours, affect, presentation noted during the session",
    "assessment": "Clinical impression, patterns, progress toward treatment goals",
    "plan": "Next steps, homework assigned, referrals, follow-up timing"
  },
  "keyThemes": ["theme1", "theme2", "theme3"],
  "moodIndicators": {
    "overall": "positive | neutral | distressed | mixed",
    "affect": "flat | restricted | appropriate | labile | expansive",
    "notes": "brief clinical note on affect presentation"
  },
  "riskFlags": {
    "selfHarm": false,
    "suicidalIdeation": false,
    "harmToOthers": false,
    "substanceUse": false,
    "details": "Any risk-related content noted. Empty string if none."
  },
  "progressNotes": "Assessment of progress toward treatment goals since last session",
  "followUpActions": [
    "Action 1",
    "Action 2"
  ],
  "recommendedInterventions": ["CBT technique", "mindfulness exercise", etc],
  "nextSessionFocus": "Suggested focus areas for the next session",
  "clinicalConfidence": "high | medium | low — based on transcript clarity and completeness"
}`;

// ── Transcription prompt ───────────────────────────────────────────────────
const TRANSCRIPTION_PROMPT = `
Transcribe this therapy session audio accurately.
Format as a conversation with speaker labels:
THERAPIST: [what was said]
CLIENT: [what was said]

If you cannot distinguish speakers clearly, label as SPEAKER 1 and SPEAKER 2.
Include natural pauses as [...] and note significant emotional moments in (parentheses).
Do not summarise — transcribe verbatim.`;

export async function POST(req: NextRequest) {
  try {
    // Clinical tool — doctors/admins only.
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (gate.role !== "doctor" && gate.role !== "admin") {
      return NextResponse.json({ error: "Doctor access required." }, { status: 403 });
    }
    if (!rateLimit(`ai:${gate.uid}`, 15, 60_000)) {
      return NextResponse.json({ error: "Too many requests — please wait a moment." }, { status: 429 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let transcript    = "";
    let appointmentId = "";
    let audioUsed     = false;
    let preview       = false;   // preview = generate SOAP only, do not save to Firestore

    // ── Mode 1: Audio file upload ──────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form          = await req.formData();
      appointmentId       = (form.get("appointmentId") as string) ?? "";
      preview             = form.get("preview") === "true";
      const audioFile     = form.get("audio") as File;

      if (!audioFile) {
        return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
      }

      const audioBytes  = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(audioBytes).toString("base64");
      const mimeType    = audioFile.type as "audio/mp3" | "audio/wav" | "audio/ogg" | "audio/m4a" | "audio/webm";

      // Use Gemini 1.5 Pro for audio transcription (supports audio natively)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const transcriptionResult = await model.generateContent([
        { inlineData: { mimeType, data: base64Audio } },
        TRANSCRIPTION_PROMPT,
      ]);

      transcript = transcriptionResult.response.text();
      audioUsed  = true;

    // ── Mode 2: Raw transcript text ────────────────────────────────────────
    } else {
      const body    = await req.json();
      transcript    = body.transcript;
      appointmentId = body.appointmentId ?? "";
      preview       = body.preview === true;

      if (!transcript?.trim()) {
        return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
      }
    }

    // appointmentId is only required when we intend to save a report.
    // In preview mode (e.g. Doctor Notes AI Assist) we generate SOAP without saving.
    if (!preview && !appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    // ── Generate clinical summary ──────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model:          "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const summaryResult = await model.generateContent(SUMMARY_PROMPT(transcript));
    const rawJson       = summaryResult.response.text();

    // Parse JSON safely
    let clinicalReport: any;
    try {
      const cleaned = rawJson.replace(/```json|```/g, "").trim();
      clinicalReport = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned malformed JSON", raw: rawJson }, { status: 500 });
    }

    // ── Preview mode — return SOAP without persisting anything ─────────────
    // Used by Doctor Notes "AI Assist": the doctor reviews and saves the note
    // manually, so we do not write to sessionReports or touch the appointment.
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        transcript,
        clinicalReport,
      });
    }

    // Load appointment for metadata
    const apptSnap = await adminDb.collection("appointments").doc(appointmentId).get();
    const appt     = apptSnap.data();

    // Build full session report document
    const reportData = {
      appointmentId,
      clientId:      appt?.clientId   ?? "",
      doctorId:      appt?.doctorId   ?? "",
      clientName:    appt?.clientName ?? "",
      sessionType:   appt?.type       ?? "",
      sessionDate:   appt?.date       ?? "",
      sessionTime:   appt?.time       ?? "",
      duration:      appt?.duration   ?? 0,
      transcript,
      audioUsed,
      clinicalReport,
      generatedAt:   new Date().toISOString(),
      status:        "draft", // doctor can mark as "finalised"
    };

    // Save to Firestore sessionReports collection
    await adminDb.collection("sessionReports").doc(appointmentId).set(reportData);

    // Also update the appointment to mark it has a report
    await adminDb.collection("appointments").doc(appointmentId).update({
      hasSessionReport: true,
      reportGeneratedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      transcript,
      clinicalReport,
      reportId: appointmentId,
    });

  } catch (err: any) {
    console.error("[ai/session-summary]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

// ── GET — load existing report ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appointmentId    = searchParams.get("appointmentId");

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
  }

  const snap = await adminDb.collection("sessionReports").doc(appointmentId).get();
  if (!snap.exists) {
    return NextResponse.json({ exists: false }, { status: 404 });
  }

  return NextResponse.json({ exists: true, report: snap.data() });
}
