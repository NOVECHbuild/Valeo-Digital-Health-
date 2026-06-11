import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | The Valeo Experience',
  description: 'Terms and conditions governing use of The Valeo Experience platform.',
};

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --forest: #2A4A1A; --forest-mid: #3D6B24; --green: #8DC63F; --orange: #F7941D; --leaf: #F2F8EA; --ivory: #FAFCF7; --charcoal: #22272B; --slate: #4A5568; }
  body { font-family: 'DM Sans', sans-serif; color: var(--charcoal); background: var(--ivory); }
  h1, h2, h3 { font-family: 'DM Serif Display', serif; font-weight: 400; }
  .legal-nav { background: var(--forest); padding: 0 60px; height: 68px; display: flex; align-items: center; justify-content: space-between; }
  .legal-nav .wordmark { font-family: 'DM Serif Display', serif; font-size: 20px; color: white; text-decoration: none; }
  .legal-nav .back { color: rgba(255,255,255,0.7); font-size: 13px; text-decoration: none; transition: color 0.2s; }
  .legal-nav .back:hover { color: var(--green); }
  .hero-strip { background: var(--forest); padding: 56px 60px 48px; border-bottom: 3px solid var(--orange); }
  .hero-strip .label { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--orange); font-weight: 600; margin-bottom: 12px; display: block; }
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
  .legal-links a:hover, .legal-links a.active { color: var(--green); }
  @media (max-width: 640px) {
    .legal-nav, .hero-strip, .content-wrap, .legal-footer { padding-left: 20px; padding-right: 20px; }
    .hero-strip h1 { font-size: 32px; }
  }
`;

export default function TermsOfServicePage() {
  return (
    <>
      <style>{SHARED_STYLES}</style>
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
        <h1>Terms of Service</h1>
        <p className="meta">The Valeo Experience Inc &nbsp;·&nbsp; Effective: June 1, 2026 &nbsp;·&nbsp; Last Updated: June 2026</p>
      </div>

      <div className="content-wrap">
        <div className="notice-box">
          <strong>Please read these Terms carefully.</strong> By accessing or using our platform, you agree to be bound by these Terms of Service. If you do not agree, you may not use our services. These Terms have been prepared in good faith; independent legal review is recommended. Contact us at <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a>.
        </div>

        <div className="section">
          <h2>1. Acceptance of Terms</h2>
          <p>These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you and The Valeo Experience Inc (&ldquo;The Valeo Experience&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), a company incorporated in St. Vincent &amp; the Grenadines. By creating an account or using our platform, you confirm that you have read, understood, and agreed to these Terms and our Privacy Policy.</p>
        </div>

        <div className="section">
          <h2>2. Description of Services</h2>
          <p>The Valeo Experience is a digital mental health platform that facilitates access to psychological services provided by Dr. Jozelle M. Miller, PhD, including:</p>
          <ul>
            <li>Individual therapy and psychological assessment</li>
            <li>Couples and family therapy</li>
            <li>Resilience coaching and personal development</li>
            <li>Workplace wellness programmes and consultations</li>
            <li>Keynote speaking engagements</li>
          </ul>
          <p>Our platform facilitates session scheduling, secure messaging, payment processing, and clinical documentation. It does not provide emergency mental health services.</p>
        </div>

        <div className="section">
          <h2>3. Eligibility</h2>
          <p>To use our platform, you must:</p>
          <ul>
            <li>Be at least 18 years of age</li>
            <li>Have the legal capacity to enter into a binding agreement</li>
            <li>Provide accurate and complete registration information</li>
            <li>Not be prohibited from using our services under applicable law</li>
          </ul>
          <p>Our services are available primarily to individuals in the Caribbean region, though we may serve clients internationally at our discretion.</p>
        </div>

        <div className="section">
          <h2>4. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Keep your password secure and not share it with any third party</li>
            <li>Notify us immediately at <a href="mailto:thevaleoexperience@gmail.com">thevaleoexperience@gmail.com</a> if you suspect unauthorised access</li>
            <li>Not create more than one account per person</li>
          </ul>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms or are used for fraudulent purposes.</p>
        </div>

        <div className="section">
          <h2>5. Telehealth Services</h2>
          <p>Sessions conducted through our platform constitute telehealth services delivered via secure video conferencing (Google Meet). By booking a session, you acknowledge that:</p>
          <ul>
            <li>Telehealth has inherent limitations compared to in-person care, including technological interruptions</li>
            <li>You are responsible for ensuring a private, secure environment during sessions</li>
            <li>Telehealth services are not appropriate for psychiatric emergencies</li>
            <li>Your clinician may determine at any time that in-person care is more appropriate for your needs</li>
            <li>All sessions are conducted in accordance with applicable professional ethics and standards</li>
          </ul>
        </div>

        <div className="section">
          <h2>6. Payment Terms</h2>
          <h3>Session Fees</h3>
          <p>Session fees are displayed on our platform and are charged in USD. Payment is processed securely through WiPay, our Caribbean payment gateway. Fees are due at the time of booking or as otherwise indicated at checkout.</p>
          <h3>Failed Payments</h3>
          <p>If a payment is declined, your appointment will not be confirmed. Please contact us to resolve payment issues prior to your scheduled session time.</p>
          <h3>Fee Changes</h3>
          <p>We reserve the right to modify our fees at any time. Changes will be communicated with reasonable notice prior to taking effect.</p>
        </div>

        <div className="section">
          <h2>7. Cancellation and Refund Policy</h2>
          <h3>Client Cancellations</h3>
          <ul>
            <li><strong>More than 24 hours notice:</strong> Full refund or credit toward a future session</li>
            <li><strong>Less than 24 hours notice:</strong> 50% of the session fee is non-refundable</li>
            <li><strong>No-show (no notice):</strong> Full session fee is forfeited</li>
          </ul>
          <h3>Clinician Cancellations</h3>
          <p>In the rare event that Dr. Miller must cancel a session, you will receive a full refund or the option to reschedule at no additional charge.</p>
          <h3>Refund Processing</h3>
          <p>Approved refunds are processed within 5–10 business days to your original payment method, subject to WiPay processing timelines.</p>
        </div>

        <div className="section">
          <h2>8. Confidentiality</h2>
          <p>All communications and health information shared through our platform are treated as strictly confidential in accordance with professional ethics standards and applicable law. Information may only be disclosed in the limited circumstances outlined in our Privacy Policy, including imminent risk of harm to self or others, or as required by law.</p>
        </div>

        <div className="section">
          <h2>9. User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Provide false or misleading information during registration or sessions</li>
            <li>Use the platform for any unlawful purpose</li>
            <li>Harass, threaten, or abuse any clinician, staff member, or other user</li>
            <li>Attempt to reverse engineer, hack, or compromise the security of our platform</li>
            <li>Share your account credentials with others</li>
            <li>Record sessions without the express written consent of all parties</li>
            <li>Use the platform&apos;s messaging system for purposes unrelated to your care</li>
          </ul>
          <p>Violation of these conduct standards may result in immediate account suspension and, where appropriate, reporting to law enforcement.</p>
        </div>

        <div className="section">
          <h2>10. Intellectual Property</h2>
          <p>All content on this platform — including text, graphics, logos, and software — is the property of The Valeo Experience Inc or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from our content without our express written permission.</p>
          <p>Assessment tools, worksheets, and resources provided through the platform are for your personal use only and may not be shared or republished.</p>
        </div>

        <div className="section">
          <h2>11. Disclaimer of Warranties</h2>
          <p>Our platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied. We do not warrant that the platform will be uninterrupted, error-free, or free of viruses or harmful components. We do not guarantee specific outcomes from any psychological or coaching service.</p>
        </div>

        <div className="section">
          <h2>12. Limitation of Liability</h2>
          <p>To the fullest extent permitted by applicable law, The Valeo Experience Inc shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform or services, including but not limited to loss of data, loss of income, or emotional distress. Our total liability to you for any claim shall not exceed the total amount paid by you for services in the three months preceding the claim.</p>
        </div>

        <div className="section">
          <h2>13. Governing Law and Dispute Resolution</h2>
          <p>These Terms are governed by and construed in accordance with the laws of St. Vincent &amp; the Grenadines. Any dispute arising from or relating to these Terms shall first be subject to good-faith negotiation. If unresolved, disputes shall be submitted to the courts of St. Vincent &amp; the Grenadines, which shall have exclusive jurisdiction.</p>
        </div>

        <div className="section">
          <h2>14. Changes to These Terms</h2>
          <p>We may update these Terms from time to time. When we do, we will update the &ldquo;Last Updated&rdquo; date and notify registered users by email for material changes. Continued use of the platform after any update constitutes acceptance of the revised Terms.</p>
        </div>

        <div className="section">
          <h2>15. Contact</h2>
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
          <Link href="/legal/privacy">Privacy Policy</Link>
          <Link href="/legal/terms" className="active">Terms of Service</Link>
          <Link href="/legal/hipaa">HIPAA Notice</Link>
          <Link href="/legal/disclaimer">Disclaimer</Link>
          <Link href="/">Home</Link>
        </div>
      </footer>
    </>
  );
}
