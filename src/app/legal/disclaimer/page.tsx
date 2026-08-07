import Link from 'next/link';

export const metadata = {
  title: 'Disclaimer | The Valeo Experience',
  description: 'Important disclaimers regarding the services and information provided by The Valeo Experience.',
};

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --forest: #2A4A1A; --forest-mid: #3D6B24; --green: #8DC63F; --orange: #F7941D; --leaf: #F2F8EA; --ivory: #FAFCF7; --charcoal: #22272B; --slate: #4A5568; }
  body { font-family: var(--font-dm-sans), 'DM Sans', sans-serif; color: var(--charcoal); background: var(--ivory); }
  h1, h2, h3 { font-family: var(--font-dm-serif), 'DM Serif Display', serif; font-weight: 400; }
  .legal-nav { background: var(--forest); padding: 0 60px; height: 68px; display: flex; align-items: center; justify-content: space-between; }
  .legal-nav .wordmark { font-family: var(--font-dm-serif), 'DM Serif Display', serif; font-size: 20px; color: white; text-decoration: none; }
  .legal-nav .back { color: rgba(255,255,255,0.7); font-size: 13px; text-decoration: none; transition: color 0.2s; }
  .legal-nav .back:hover { color: var(--green); }
  .hero-strip { background: var(--forest); padding: 56px 60px 48px; border-bottom: 3px solid var(--orange); }
  .hero-strip .label { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--orange); font-weight: 600; margin-bottom: 12px; display: block; }
  .hero-strip h1 { font-size: 46px; color: white; margin-bottom: 12px; }
  .hero-strip .meta { color: rgba(255,255,255,0.55); font-size: 13px; }
  .content-wrap { max-width: 820px; margin: 0 auto; padding: 64px 60px 80px; }
  .notice-box { background: var(--leaf); border-left: 4px solid var(--orange); border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 48px; font-size: 14px; color: var(--slate); line-height: 1.6; }
  .section { margin-bottom: 48px; }
  .section h2 { font-family: var(--font-dm-serif), 'DM Serif Display', serif; font-size: 26px; color: var(--forest); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(42,74,26,0.12); }
  .section p { font-size: 15px; color: var(--slate); line-height: 1.8; margin-bottom: 14px; }
  .section ul { padding-left: 20px; margin-bottom: 14px; }
  .section ul li { font-size: 15px; color: var(--slate); line-height: 1.8; margin-bottom: 6px; }
  .section a { color: var(--forest-mid); text-decoration: underline; }
  .emergency-box { background: rgba(247, 148, 29, 0.08); border: 1.5px solid var(--orange); border-radius: 8px; padding: 20px 24px; margin: 32px 0; }
  .emergency-box h3 { font-family: var(--font-dm-sans), 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; color: var(--orange); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .emergency-box p { font-size: 14px; color: var(--charcoal); line-height: 1.7; margin: 0; }
  .emergency-box a { color: var(--forest-mid); font-weight: 600; text-decoration: underline; }
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

export default function DisclaimerPage() {
  return (
    <>
      <style>{STYLES}</style>
<nav className="legal-nav">
        <Link href="/" className="wordmark">The Valeo Experience</Link>
        <Link href="/" className="back">← Back to Home</Link>
      </nav>

      <div className="hero-strip">
        <span className="label">Legal</span>
        <h1>Disclaimer</h1>
        <p className="meta">The Valeo Experience Inc &nbsp;·&nbsp; Effective: June 1, 2026 &nbsp;·&nbsp; Last Updated: August 2026</p>
      </div>

      <div className="content-wrap">
        <div className="notice-box">
          <strong>Please read this Disclaimer carefully.</strong> It sets out important limitations and clarifications about the services and information provided through The Valeo Experience platform. By using our platform, you acknowledge and accept the terms set out below.
        </div>

        <div className="section">
          <h2>1. Not a Medical Emergency Service</h2>
          <p>The Valeo Experience is a scheduled telehealth platform and is <strong>not equipped to handle psychiatric emergencies.</strong> Our services require advance appointment booking and do not provide real-time crisis intervention.</p>

          <div className="emergency-box">
            <h3>⚠ If You Are in Crisis</h3>
            <p>
              If you are experiencing a mental health emergency, are in immediate danger, or are having thoughts of suicide or self-harm, <strong>please contact emergency services in your country immediately.</strong><br /><br />
              <strong>Caribbean Emergency Services:</strong> Dial <strong>911</strong> or your country&apos;s local emergency number.<br />
              <strong>International Association for Suicide Prevention:</strong> <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer">Find a crisis centre</a>.<br /><br />
              You may also speak with someone at a local hospital emergency department or contact a trusted person in your life immediately.
            </p>
          </div>
        </div>

        <div className="section">
          <h2>2. Professional Services Disclaimer</h2>
          <p>Services provided through The Valeo Experience are delivered by Dr. Jozelle M. Miller, PhD, a licensed health psychologist. These services are professional in nature and are governed by the ethical standards of the psychological profession.</p>
          <p>However, psychological and coaching services do not guarantee specific outcomes. Progress in therapy depends on many factors unique to each individual, including the nature of the presenting concern, consistency of attendance, personal effort, and other life circumstances. Results will vary from person to person.</p>
        </div>

        <div className="section">
          <h2>3. General Information on This Website</h2>
          <p>The content published on this website — including articles, blog posts, resource materials, service descriptions, and educational information — is provided for general informational purposes only. It does not constitute medical advice, psychological diagnosis, or clinical treatment.</p>
          <p>General information on this website should not be used as a substitute for professional consultation with a qualified mental health provider. If you have concerns about your mental health, please book an appointment or consult a qualified professional in your area.</p>
        </div>

        <div className="section">
          <h2>4. AI-Assisted Features</h2>
          <p>Our platform uses artificial intelligence (Google Gemini) to assist Dr. Miller with session summaries and clinical documentation (SOAP notes). These AI outputs are:</p>
          <ul>
            <li>Tools to assist the clinician — not standalone clinical records</li>
            <li>Always reviewed and finalised by Dr. Miller before being used in your care</li>
            <li>Not the basis for diagnoses or treatment decisions without clinical review</li>
          </ul>
          <p>AI-generated content is intended to reduce administrative burden and improve documentation accuracy, not to replace clinical judgement.</p>
        </div>

        <div className="section">
          <h2>5. Technology and Platform Availability</h2>
          <p>We make every effort to ensure our platform is available and functioning reliably. However, we do not guarantee uninterrupted access to the platform or that it will be free from technical errors. Factors outside our control — including internet connectivity, third-party service outages, or device compatibility — may affect your ability to access the platform.</p>
          <p>If you are unable to access a scheduled session due to a technical issue on our end, we will work with you to reschedule at no additional charge. Connectivity issues on your end are not grounds for a refund unless reasonable notice is given.</p>
        </div>

        <div className="section">
          <h2>6. Third-Party Links and Resources</h2>
          <p>Our platform or website may contain links to third-party websites or resources for informational purposes. We do not endorse, control, or take responsibility for the content, privacy practices, or accuracy of any linked third-party sites. Accessing external links is at your own discretion and risk.</p>
        </div>

        <div className="section">
          <h2>7. Testimonials and Results</h2>
          <p>Any testimonials or success stories featured on this website reflect individual experiences and are not representative of typical or guaranteed outcomes. Each client&apos;s experience is unique and results will vary based on individual circumstances.</p>
        </div>

        <div className="section">
          <h2>8. Jurisdictional Limitations</h2>
          <p>The Valeo Experience is incorporated in St. Vincent &amp; the Grenadines and primarily serves clients in the Caribbean region. Clients accessing the platform from other jurisdictions are responsible for ensuring that their use complies with local laws. We make no representation that our services are appropriate or available in all jurisdictions.</p>
        </div>

        <div className="section">
          <h2>9. Limitation of Liability</h2>
          <p>To the fullest extent permitted by applicable law, The Valeo Experience Inc, its directors, officers, clinicians, and staff shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of or reliance on information provided through our platform or website.</p>
          <p>This limitation applies to all claims whether based in contract, tort, negligence, or otherwise, and whether or not The Valeo Experience has been advised of the possibility of such damages.</p>
        </div>

        <div className="section">
          <h2>10. Changes to This Disclaimer</h2>
          <p>We reserve the right to update this Disclaimer at any time. Changes will be reflected by updating the date at the top of this page. Continued use of the platform following any update constitutes acceptance of the revised Disclaimer.</p>
        </div>

        <div className="section">
          <h2>11. Contact</h2>
          <p>If you have questions about this Disclaimer, please contact us:</p>
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
          <Link href="/legal/terms">Terms of Service</Link>
          <Link href="/legal/hipaa">HIPAA Notice</Link>
          <Link href="/legal/disclaimer" className="active">Disclaimer</Link>
          <Link href="/">Home</Link>
        </div>
      </footer>
    </>
  );
}
