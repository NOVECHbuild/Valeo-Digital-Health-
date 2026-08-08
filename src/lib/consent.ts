// Telehealth consent — versioned platform acknowledgments (not legal advice).
// Bump CONSENT_VERSION when checkbox copy changes so clients re-sign.

export const CONSENT_VERSION = "2026-08-08";

export type ConsentAccepted = {
  privacy:           boolean;
  terms:             boolean;
  hipaaNotice:       boolean;
  telehealth:        boolean;
  sessionRecording:  boolean;
  emergency:         boolean;
};

export type ConsentRecord = {
  clientId:        string;
  clientName:      string;
  typedSignature:  string;
  version:         string;
  accepted:        ConsentAccepted;
  signedAt:        any;
  userAgent?:      string;
  doctorId?:       string;
};

export function allAccepted(a: ConsentAccepted): boolean {
  return !!(
    a.privacy &&
    a.terms &&
    a.hipaaNotice &&
    a.telehealth &&
    a.sessionRecording &&
    a.emergency
  );
}

export function isConsentCurrent(version?: string | null): boolean {
  return version === CONSENT_VERSION;
}

export const CONSENT_ACKS: {
  key: keyof ConsentAccepted;
  label: string;
  link?: { href: string; text: string };
}[] = [
  {
    key:   "privacy",
    label: "I have read and agree to the Privacy Policy.",
    link:  { href: "/legal/privacy", text: "Privacy Policy" },
  },
  {
    key:   "terms",
    label: "I have read and agree to the Terms of Service.",
    link:  { href: "/legal/terms", text: "Terms of Service" },
  },
  {
    key:   "hipaaNotice",
    label: "I acknowledge the platform privacy / health-information notice.",
    link:  { href: "/legal/hipaa", text: "HIPAA / privacy notice" },
  },
  {
    key:   "telehealth",
    label: "I understand sessions may be delivered by secure video and that this platform is not for emergencies.",
    link:  { href: "/legal/disclaimer", text: "Disclaimer" },
  },
  {
    key:   "sessionRecording",
    label:
      "I understand my therapist may record or transcribe sessions (e.g. via Google Meet) and may use AI tools to help draft clinical notes. Recordings and notes are kept in my therapist's private clinical file — not shared with me in the app, and not transferred if I later work with a different therapist on this platform.",
  },
  {
    key:   "emergency",
    label: "In an emergency I will call local emergency services (e.g. 911) or go to the nearest emergency facility — not rely on this platform.",
  },
];
