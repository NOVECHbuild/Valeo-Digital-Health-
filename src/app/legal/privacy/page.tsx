import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | The Valeo Experience',
  description: 'How The Valeo Experience collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --forest: #2A4A1A; --forest-mid: #3D6B24; --green: #8DC63F;
          --orange: #F7941D; --leaf: #F2F8EA; --ivory: #FAFCF7;
          --charcoal: #22272B; --slate: #4A5568; --gray: #58595B;
        }
        body { font-family: 'DM Sans', sans-serif; color: var(--charcoal); background: var(--ivory); }
        h1, h2, h3 { font-family: 'DM Serif Display', serif; font-weight: 400; }
        .legal-nav { background: var(--forest); padding: 0 60px; height: 68px; display: flex; align-items: center; justify-content: space-between; }
        .legal-nav .wordmark { font-family: 'DM Serif Display', serif; font-size: 20px; color: white; text-decoration: none; }
        .legal-nav .back { color: rgba(255,255,255,0.7); font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .legal-nav .back:hover { color: var(--green); }
        .hero-strip { background: var(--forest); padding: 56px 60px 48px; border-bottom: 3px solid var(--green); }
        .hero-strip .label { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--green); font-weight: 600; margin-bottom: 12px; display: block; }
        .hero-strip h1 { font-size: 46px; color: white; margin-bottom: 12px; }
        .hero-strip .meta { color: rgba(255,255,255,0.55); font-size: 13px; }
        .content-wrap { max-width: 820px; margin: 0 auto; padding: 64px 60px 80px; }
        .notice-box { background: var(--leaf); border-left: 4px solid var(--orange); border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 48px; font-size: 14px; color: var(--slate); line-height: 1.6; }
        .section { margin-bottom: 48px; }
        .section h2 { font-family: 'DM Serif Display', serif; font-size: 26px; color: var(--forest); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(42,74,26,0.12); }
        .section h3 { font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; color: var(--charcoal); margin: 20px 0 8px; }
        .section p { font-size: 15px; color: var(--slate); line-height: 1.8; margin-bottom: 14px; }
        .section ul { padding-left: 20px; margin-bottom: 14px; }
        .section ul li { font-size: 15px; color: var(--slate); line-height: 1.8; margin-bottom: 6px; }
        .section a { color: var(--forest-mid); text-decoration: underline; }
        .legal-footer { background: var(--charcoal); padding: 32px 60px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .legal-footer .copy { color: rgba(255,255,255,0.4); font-size: 12px; }
        .legal-links { display: flex; gap: 20px; flex-wrap: wrap; }
        .legal-links a { color: rgba(255,255,255,0.55); font-size: 12px; text-decoration: none; transition: color 0.2s; }
        .legal-links a:hover { color: var(--green); }
        .legal-links a.active { color: var(--green); }
        @media (max-width: 640px) {
          .legal-nav, .hero-strip, .content-wrap, .legal-footer { padding-left: 20px; padding-right: 20px; }
          .hero-strip h1 { font-size: 32px; }
        }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

      <nav className="legal-nav">
        <Link href="/" className="wordmark">The Valeo Experience</Link>
        <Link href="/" className="back">← Back to Home</Link>
      </nav>

      <div className="hero-strip">
        <span className="label">Legal</span>
        <h1>Privacy Policy</h1>
        <p className="meta">The Valeo Experience Inc &nbsp;·&nbsp; Effective: June 1, 2026 &nbsp;·&nbsp; Last Updated: August 2026</p>
      </div>

      <div className="content-wrap">
        <div className="notice-box">
          <strong>Important notice:</strong> This Privacy Policy has been prepared in good faith as a professional template. We recommend periodic review by a qualified attorney familiar with St. Vincent &amp; the Grenadines law and applicable Caribbean privacy regulations. For privacy inquiries contact <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a>.
        </div>

        <div className="section">
          <h2>1. Introduction</h2>
          <p>The Valeo Experience Inc (&ldquo;The Valeo Experience&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a mental health platform operated by Dr. Jozelle M. Miller, PhD, and headquartered in Kingstown, St. Vincent &amp; the Grenadines. We are committed to protecting the privacy and confidentiality of all individuals who access our platform.</p>
          <p>This Privacy Policy describes how we collect, use, store, share, and protect your personal information when you visit our website at <strong>valeoexperience.com</strong>, create an account, or use our services. By accessing or using our platform, you agree to the practices described in this Policy.</p>
          <p>If you do not agree with this Policy, please do not use our platform or services.</p>
        </div>

        <div className="section">
          <h2>2. Information We Collect</h2>
          <h3>Information You Provide Directly</h3>
          <ul>
            <li><strong>Account information:</strong> name, email address, phone number, date of birth</li>
            <li><strong>Profile information:</strong> gender, location, preferred language, emergency contact</li>
            <li><strong>Health information:</strong> intake questionnaire responses, presenting concerns, mental health history, session notes, and assessment responses</li>
            <li><strong>Payment information:</strong> billing details processed securely through our payment processor (Stripe). We do not store full card numbers on our servers.</li>
            <li><strong>Communications:</strong> messages sent through our secure in-platform messaging system</li>
          </ul>
          <h3>Information Collected Automatically</h3>
          <ul>
            <li>Device type, operating system, and browser type</li>
            <li>IP address and approximate geographic location</li>
            <li>Pages visited, time spent, and interactions within the platform</li>
            <li>Session logs and error reports</li>
          </ul>
          <h3>Information from Third Parties</h3>
          <ul>
            <li>Google Meet: appointment scheduling and video session metadata</li>
            <li>Google Calendar: appointment confirmation data</li>
          </ul>
        </div>

        <div className="section">
          <h2>3. How We Use Your Information</h2>
          <p>We use your personal information for the following purposes:</p>
          <ul>
            <li>To provide, operate, and improve our mental health platform and services</li>
            <li>To schedule and facilitate therapy, coaching, and wellness sessions</li>
            <li>To process payments for services rendered</li>
            <li>To generate AI-assisted clinical documentation (SOAP notes and session summaries) accessible only to your assigned clinician</li>
            <li>To send appointment reminders, confirmations, and platform notifications</li>
            <li>To communicate with you about your care and account</li>
            <li>To comply with legal and regulatory obligations</li>
            <li>To maintain the security and integrity of the platform</li>
            <li>To conduct analytics that improve our service quality (using anonymised or aggregated data only)</li>
          </ul>
          <p>We do not use your health information for advertising purposes, and we do not sell your personal data to third parties.</p>
        </div>

        <div className="section">
          <h2>4. Information Sharing and Disclosure</h2>
          <p>We do not sell, rent, or trade your personal information. We may share your information only in the following limited circumstances:</p>
          <h3>Service Providers</h3>
          <p>We engage trusted third-party providers who assist in operating our platform, including Google (Firebase, Google Meet, Google Calendar, Gemini AI) and Stripe (payment processing). These providers are contractually bound to handle your data securely and only for the purposes we specify.</p>
          <h3>Clinical Team</h3>
          <p>Your health information is accessible to the licensed clinician assigned to your care (Dr. Jozelle M. Miller, PhD) and, where applicable, platform administrators for care coordination purposes.</p>
          <h3>Legal Requirements</h3>
          <p>We may disclose your information if required by law, court order, or governmental authority, or where necessary to protect the safety of you or others in an emergency.</p>
          <h3>Business Transfers</h3>
          <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred. You will be notified in advance of any such transfer.</p>
        </div>

        <div className="section">
          <h2>5. Data Security</h2>
          <p>We implement industry-standard security measures to protect your personal and health information:</p>
          <ul>
            <li>All data is encrypted in transit (TLS/HTTPS) and at rest via Google Firebase&apos;s security infrastructure</li>
            <li>Access to health records is role-restricted — only your assigned clinician and platform administrators can view clinical notes</li>
            <li>Payment transactions are processed through PCI-compliant infrastructure via Stripe</li>
            <li>Our platform is hosted on Vercel with enterprise-grade security and DDoS protection</li>
          </ul>
          <p>Despite these measures, no system is completely immune to security risks. We encourage you to use a strong, unique password and to contact us immediately if you suspect unauthorised access to your account.</p>
        </div>

        <div className="section">
          <h2>6. Data Retention</h2>
          <p>We retain your personal information for as long as necessary to provide our services and meet our legal obligations:</p>
          <ul>
            <li><strong>Account data:</strong> retained for the duration of your active account, plus 7 years after account closure for compliance purposes</li>
            <li><strong>Health records and clinical notes:</strong> retained for a minimum of 7 years from your last session, in accordance with standard mental health record-keeping requirements</li>
            <li><strong>Payment records:</strong> retained for 7 years for accounting and tax compliance</li>
            <li><strong>Communications:</strong> retained for the duration of your active account</li>
          </ul>
          <p>You may request deletion of certain non-clinical data at any time by contacting us. Clinical records may be subject to mandatory retention requirements that limit our ability to delete them on request.</p>
        </div>

        <div className="section">
          <h2>7. Your Rights</h2>
          <p>Depending on your location, you may have the following rights regarding your personal information:</p>
          <ul>
            <li><strong>Access:</strong> request a copy of the personal information we hold about you</li>
            <li><strong>Correction:</strong> request correction of inaccurate or incomplete data</li>
            <li><strong>Deletion:</strong> request deletion of non-clinical personal data, subject to legal retention requirements</li>
            <li><strong>Portability:</strong> request a machine-readable copy of your data</li>
            <li><strong>Objection:</strong> object to certain processing of your data</li>
            <li><strong>Withdrawal of consent:</strong> where processing is based on consent, you may withdraw at any time</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a>. We will respond within 30 days.</p>
        </div>

        <div className="section">
          <h2>8. Cookies and Tracking</h2>
          <p>Our platform uses essential cookies required for authentication and session management. We do not currently use advertising or third-party tracking cookies. You may disable cookies in your browser settings; however, this may affect platform functionality.</p>
        </div>

        <div className="section">
          <h2>9. Children&apos;s Privacy</h2>
          <p>Our platform is intended for users aged 18 and older. We do not knowingly collect personal information from individuals under 18. If you believe a minor has provided us with personal information, please contact us immediately and we will take steps to delete it.</p>
        </div>

        <div className="section">
          <h2>10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last Updated&rdquo; date at the top of this page and, where changes are material, notify registered users by email. Your continued use of the platform after any changes constitutes acceptance of the updated Policy.</p>
        </div>

        <div className="section">
          <h2>11. Contact Us</h2>
          <p>For questions, concerns, or to exercise your privacy rights, please contact:</p>
          <p>
            <strong>The Valeo Experience Inc</strong><br />
            Kingstown, St. Vincent &amp; the Grenadines<br />
            Email: <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a><br />
            Phone: (784) 498-7772
          </p>
        </div>
      </div>

      <footer className="legal-footer">
        <span className="copy">© 2026 The Valeo Experience Inc · All Rights Reserved</span>
        <div className="legal-links">
          <Link href="/legal/privacy" className="active">Privacy Policy</Link>
          <Link href="/legal/terms">Terms of Service</Link>
          <Link href="/legal/hipaa">HIPAA Notice</Link>
          <Link href="/legal/disclaimer">Disclaimer</Link>
          <Link href="/">Home</Link>
        </div>
      </footer>
    </>
  );
}
