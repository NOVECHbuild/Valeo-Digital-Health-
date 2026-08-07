import Link from 'next/link';

export const metadata = {
  title: 'HIPAA Notice & Health Data Privacy | The Valeo Experience',
  description: 'Notice of Privacy Practices and health data protections for clients of The Valeo Experience.',
};

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --forest: #2A4A1A; --forest-mid: #3D6B24; --green: #8DC63F; --orange: #F7941D; --leaf: #F2F8EA; --ivory: #FAFCF7; --charcoal: #22272B; --slate: #4A5568; }
  body { font-family: 'DM Sans', sans-serif; color: var(--charcoal); background: var(--ivory); }
  h1, h2, h3 { font-family: 'DM Serif Display', serif; font-weight: 400; }
  .legal-nav { background: var(--forest); padding: 0 60px; height: 68px; display: flex; align-items: center; justify-content: space-between; }
  .legal-nav .wordmark { font-family: 'DM Serif Display', serif; font-size: 20px; color: white; text-decoration: none; }
  .legal-nav .back { color: rgba(255,255,255,0.7); font-size: 13px; text-decoration: none; transition: color 0.2s; }
  .legal-nav .back:hover { color: var(--green); }
  .hero-strip { background: var(--forest); padding: 56px 60px 48px; border-bottom: 3px solid var(--green); }
  .hero-strip .label { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--green); font-weight: 600; margin-bottom: 12px; display: block; }
  .hero-strip h1 { font-size: 46px; color: white; margin-bottom: 12px; }
  .hero-strip .meta { color: rgba(255,255,255,0.55); font-size: 13px; }
  .content-wrap { max-width: 820px; margin: 0 auto; padding: 64px 60px 80px; }
  .notice-box { background: var(--leaf); border-left: 4px solid var(--orange); border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 48px; font-size: 14px; color: var(--slate); line-height: 1.6; }
  .notice-box.required { border-left-color: var(--forest); background: rgba(42,74,26,0.06); }
  .section { margin-bottom: 48px; }
  .section h2 { font-family: 'DM Serif Display', serif; font-size: 26px; color: var(--forest); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(42,74,26,0.12); }
  .section h3 { font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; color: var(--charcoal); margin: 20px 0 8px; }
  .section p { font-size: 15px; color: var(--slate); line-height: 1.8; margin-bottom: 14px; }
  .section ul { padding-left: 20px; margin-bottom: 14px; }
  .section ul li { font-size: 15px; color: var(--slate); line-height: 1.8; margin-bottom: 6px; }
  .section a { color: var(--forest-mid); text-decoration: underline; }
  .part-divider { border: none; border-top: 2px solid var(--green); margin: 56px 0; opacity: 0.4; }
  .part-label { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--forest-mid); margin-bottom: 8px; margin-top: 56px; }
  .part-desc { font-size: 14px; color: var(--slate); margin-bottom: 40px; }
  .legal-footer { background: var(--charcoal); padding: 32px 60px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
  .legal-footer .copy { color: rgba(255,255,255,0.4); font-size: 12px; }
  .legal-links { display: flex; gap: 20px; flex-wrap: wrap; }
  .legal-links a { color: rgba(255,255,255,0.55); font-size: 12px; text-decoration: none; transition: color 0.2s; }
  .legal-links a:hover, .legal-links a.active { color: var(--green); }
  @media (max-width: 640px) {
    .legal-nav, .hero-strip, .content-wrap, .legal-footer { padding-left: 20px; padding-right: 20px; }
    .hero-strip h1 { font-size: 30px; }
  }
`;

export default function HipaaNoticePage() {
  return (
    <>
      <style>{STYLES}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

      <nav className="legal-nav">
        <Link href="/" className="wordmark">The Valeo Experience</Link>
        <Link href="/" className="back">← Back to Home</Link>
      </nav>

      <div className="hero-strip">
        <span className="label">Legal · Health Data</span>
        <h1>HIPAA Notice &amp; Health Data Privacy</h1>
        <p className="meta">The Valeo Experience Inc &nbsp;·&nbsp; Effective: June 1, 2026 &nbsp;·&nbsp; Last Updated: August 2026</p>
      </div>

      <div className="content-wrap">
        <div className="notice-box">
          <strong>This document contains two parts:</strong> Part A is our formal HIPAA Notice of Privacy Practices, applicable to clients residing in or accessing services from the United States. Part B is our Caribbean Health Data Privacy Notice, which governs all other clients. Both apply if you are a US-based client who is also a Caribbean resident.
        </div>

        {/* ─── PART A: HIPAA ─── */}
        <p className="part-label">Part A — HIPAA Notice of Privacy Practices</p>
        <p className="part-desc">Applicable to clients in the United States or accessing services subject to HIPAA requirements.</p>

        <div className="notice-box required">
          <strong>THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.</strong>
        </div>

        <div className="section">
          <h2>A1. Our Commitment to Your Health Information</h2>
          <p>The Valeo Experience Inc, through its clinician Dr. Jozelle M. Miller, PhD, is required by the Health Insurance Portability and Accountability Act of 1996 (HIPAA) to maintain the privacy of your Protected Health Information (PHI), to provide you with this Notice of Privacy Practices, and to follow the terms of the notice currently in effect.</p>
          <p>PHI is information that identifies you and relates to your past, present, or future physical or mental health, the healthcare services we provide you, or the payment for those services.</p>
        </div>

        <div className="section">
          <h2>A2. How We May Use and Disclose Your Health Information</h2>
          <h3>Treatment</h3>
          <p>We use your PHI to provide, coordinate, or manage your mental health care. This includes sharing information with other providers involved in your care, with your consent, such as when coordinating with your primary care physician.</p>
          <h3>Payment</h3>
          <p>We may use your PHI to process payments for services rendered, including billing and payment verification through our payment processor (Stripe).</p>
          <h3>Healthcare Operations</h3>
          <p>We may use your PHI for quality assurance, training, and platform improvements. This includes AI-assisted generation of SOAP notes and session summaries, accessible only to your assigned clinician.</p>
          <h3>Authorised Uses and Disclosures</h3>
          <p>Other than treatment, payment, and healthcare operations, we will only use or disclose your PHI with your written authorisation, except as follows:</p>
          <ul>
            <li><strong>Serious threat to safety:</strong> We may disclose PHI to prevent a serious and imminent threat to your health or safety or that of another person</li>
            <li><strong>Required by law:</strong> We may disclose PHI when required by federal, state, or local law</li>
            <li><strong>Public health activities:</strong> As required by public health authorities</li>
            <li><strong>Judicial proceedings:</strong> In response to a court order, subpoena, or other lawful process</li>
            <li><strong>Law enforcement:</strong> As required by applicable law enforcement purposes</li>
            <li><strong>Minors:</strong> As required or permitted when a client is a minor</li>
          </ul>
        </div>

        <div className="section">
          <h2>A3. Your Rights Regarding Your Health Information</h2>
          <p>You have the following rights with respect to your PHI:</p>
          <h3>Right to Access</h3>
          <p>You may request access to inspect and receive a copy of your PHI. We will respond within 30 days. A reasonable fee may apply for copying.</p>
          <h3>Right to Amend</h3>
          <p>If you believe your PHI is inaccurate or incomplete, you may request an amendment. We may deny the request if we determine the information is accurate.</p>
          <h3>Right to an Accounting of Disclosures</h3>
          <p>You may request a list of disclosures we have made of your PHI in the past six years, other than those for treatment, payment, or healthcare operations.</p>
          <h3>Right to Request Restrictions</h3>
          <p>You may request restrictions on how we use or disclose your PHI. We are not required to agree to all restrictions, but we will accommodate reasonable requests where possible.</p>
          <h3>Right to Confidential Communications</h3>
          <p>You may request that we communicate your PHI in a specific way or at a specific location (e.g., email only, specific phone number).</p>
          <h3>Right to a Paper Copy of This Notice</h3>
          <p>You may request a paper copy of this Notice at any time, even if you have agreed to receive it electronically.</p>
        </div>

        <div className="section">
          <h2>A4. Our Duties</h2>
          <p>We are required to maintain the privacy of your PHI, provide you with this Notice, and follow the terms described herein. We reserve the right to change our privacy practices and to apply those changes to all PHI we maintain. Revised notices will be posted on our website and available upon request.</p>
        </div>

        <div className="section">
          <h2>A5. Complaints</h2>
          <p>If you believe your privacy rights have been violated, you may file a complaint with us or with the U.S. Department of Health and Human Services. You will not be penalised for filing a complaint.</p>
          <p>
            <strong>Contact us:</strong> <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a><br />
            <strong>HHS Office for Civil Rights:</strong> <a href="https://www.hhs.gov/ocr/privacy/hipaa/complaints" target="_blank" rel="noopener noreferrer">www.hhs.gov/ocr/privacy/hipaa/complaints</a> or 1-800-368-1019
          </p>
        </div>

        <hr className="part-divider" />

        {/* ─── PART B: Caribbean ─── */}
        <p className="part-label">Part B — Caribbean Health Data Privacy Notice</p>
        <p className="part-desc">Applicable to all clients, with particular relevance to those in the Caribbean region. US-based clients should read both Parts A and B.</p>

        <div className="section">
          <h2>B1. Governing Framework</h2>
          <p>The Valeo Experience Inc is incorporated in St. Vincent &amp; the Grenadines and primarily serves clients across the Caribbean region. While the Caribbean does not have a single unified health data privacy statute equivalent to HIPAA or GDPR, we are committed to responsible health information stewardship that meets or exceeds regional best practices and applicable local laws.</p>
          <p>We are guided by the following frameworks where applicable:</p>
          <ul>
            <li>The Electronic Transactions Act (St. Vincent &amp; the Grenadines)</li>
            <li>The Computer Misuse Act (SVG) and equivalent legislation across the region</li>
            <li>CARICOM data protection principles</li>
            <li>International standards including ISO 27001 and the OECD Privacy Guidelines</li>
            <li>Professional ethics standards for psychologists as established by the Caribbean Alliance of National Psychological Associations (CANPA)</li>
          </ul>
        </div>

        <div className="section">
          <h2>B2. What Health Information We Collect</h2>
          <p>As a mental health platform, we collect the following categories of health-related information:</p>
          <ul>
            <li>Mental health history, presenting concerns, and treatment goals from intake questionnaires</li>
            <li>Session notes and SOAP notes generated by or with the assistance of Dr. Miller</li>
            <li>Assessment results and psychological evaluation data</li>
            <li>Correspondence and messages related to your care</li>
            <li>Appointment history and treatment progress</li>
          </ul>
        </div>

        <div className="section">
          <h2>B3. How We Protect Your Health Information</h2>
          <p>We treat all health information with the highest degree of confidentiality. Our safeguards include:</p>
          <ul>
            <li><strong>Encryption:</strong> All health data is encrypted in transit (TLS/HTTPS) and at rest via Google Firebase&apos;s security infrastructure</li>
            <li><strong>Access control:</strong> Health records are accessible only to your assigned clinician and platform administrators for care coordination — no third parties</li>
            <li><strong>Data minimisation:</strong> We collect only the information necessary for your care</li>
            <li><strong>Secure communications:</strong> All messaging occurs within the platform&apos;s encrypted environment — we do not discuss client health matters via unsecured email or social media</li>
            <li><strong>AI processing:</strong> Session summaries and SOAP notes generated using Gemini AI are processed within Google&apos;s privacy-compliant infrastructure and stored only within your secure clinical record</li>
          </ul>
        </div>

        <div className="section">
          <h2>B4. Disclosures Without Your Consent</h2>
          <p>In limited circumstances, health information may be disclosed without your prior consent:</p>
          <ul>
            <li><strong>Risk of harm:</strong> If you disclose information indicating imminent risk of serious harm to yourself or others, we are ethically and legally obligated to take protective action, which may include contacting emergency services or third parties</li>
            <li><strong>Court orders:</strong> If we receive a valid court order or subpoena requiring disclosure</li>
            <li><strong>Mandatory reporting:</strong> Where local law requires reporting of specific information (e.g., abuse of a minor or vulnerable adult)</li>
            <li><strong>Professional consultation:</strong> With your implied consent, Dr. Miller may discuss your case with a supervising or consulting clinician, bound by equivalent confidentiality obligations, for the purpose of improving your care</li>
          </ul>
        </div>

        <div className="section">
          <h2>B5. Your Rights</h2>
          <p>All clients, regardless of location, have the following rights regarding their health information:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your health records held by our platform</li>
            <li><strong>Correction:</strong> Request that inaccurate information be corrected</li>
            <li><strong>Transparency:</strong> Know how your information is being used and who has accessed it</li>
            <li><strong>Confidentiality:</strong> Have your information kept strictly confidential except as described above</li>
            <li><strong>Withdrawal:</strong> Discontinue services at any time; your records will be retained in accordance with applicable retention requirements</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a>.</p>
        </div>

        <div className="section">
          <h2>B6. Third-Party Data Processors</h2>
          <p>We engage the following third-party processors who may handle health-adjacent data on our behalf:</p>
          <ul>
            <li><strong>Google LLC</strong> (Firebase, Google Meet, Gemini AI) — US-based, HIPAA-eligible Business Associate; governed by Google&apos;s Privacy Policy and Data Processing Addendum</li>
            <li><strong>Vercel Inc</strong> — platform hosting; does not access health data directly</li>
            <li><strong>Stripe, Inc.</strong> — payment processor; accesses billing and transaction data only, not clinical health information</li>
          </ul>
        </div>

        <div className="section">
          <h2>B7. Contact &amp; Concerns</h2>
          <p>For any questions about how your health information is handled, or to raise a concern, please contact:</p>
          <p>
            <strong>The Valeo Experience Inc</strong><br />
            Attn: Privacy Officer<br />
            Kingstown, St. Vincent &amp; the Grenadines<br />
            Email: <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a><br />
            Phone: (784) 498-7772
          </p>
        </div>
      </div>

      <footer className="legal-footer">
        <span className="copy">© 2026 The Valeo Experience Inc · All Rights Reserved</span>
        <div className="legal-links">
          <Link href="/legal/privacy">Privacy Policy</Link>
          <Link href="/legal/terms">Terms of Service</Link>
          <Link href="/legal/hipaa" className="active">HIPAA Notice</Link>
          <Link href="/legal/disclaimer">Disclaimer</Link>
          <Link href="/">Home</Link>
        </div>
      </footer>
    </>
  );
}
