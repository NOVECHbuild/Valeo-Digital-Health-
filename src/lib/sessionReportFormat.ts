// Shared formatting for AI clinical reports (Notes + Clinical File).

export function formatAIReport(r: any): string {
  if (!r) return "";
  const soap = r.soap ?? {};
  const lines: string[] = [];
  if (r.sessionSummary) {
    lines.push("## Session Summary", r.sessionSummary, "");
  }
  lines.push(
    "## SOAP",
    `**S — Subjective:** ${soap.subjective ?? "—"}`,
    `**O — Objective:** ${soap.objective ?? "—"}`,
    `**A — Assessment:** ${soap.assessment ?? "—"}`,
    `**P — Plan:** ${soap.plan ?? "—"}`,
    "",
  );
  if (Array.isArray(r.keyThemes) && r.keyThemes.length) {
    lines.push("## Key Themes", r.keyThemes.map((t: string) => `• ${t}`).join("\n"), "");
  }
  if (r.progressNotes) lines.push("## Progress", r.progressNotes, "");
  if (Array.isArray(r.followUpActions) && r.followUpActions.length) {
    lines.push("## Follow-up", r.followUpActions.map((a: string) => `• ${a}`).join("\n"), "");
  }
  if (r.nextSessionFocus) lines.push("## Next Session Focus", r.nextSessionFocus, "");
  const risk = r.riskFlags;
  if (risk && (risk.selfHarm || risk.suicidalIdeation || risk.harmToOthers || risk.substanceUse || risk.details)) {
    lines.push(
      "## Risk Flags",
      risk.details || "Flags present — review carefully.",
      "",
    );
  }
  lines.push("_AI-assisted draft — review for accuracy before relying on this note._");
  return lines.join("\n");
}

export function reportHasRisk(r: any): boolean {
  const f = r?.riskFlags;
  if (!f) return false;
  return !!(f.selfHarm || f.suicidalIdeation || f.harmToOthers || f.substanceUse || (f.details && String(f.details).trim()));
}
