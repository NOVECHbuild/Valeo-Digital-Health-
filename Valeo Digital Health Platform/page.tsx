'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Scroll-triggered reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

    // Nav scroll shadow
    const handleScroll = () => {
      if (navRef.current) {
        navRef.current.classList.toggle('scrolled', window.scrollY > 20);
      }
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleTabClick = (tab: string) => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --ocean: #0D3B44; --ocean-mid: #1A535C; --teal: #4ECDC4; --teal-light: #7EDDD7;
          --coral: #E8604C; --coral-light: #FF8B7B; --sand: #F5EFE0; --cream: #FAF8F3;
          --ivory: #FFFDF9; --charcoal: #22272B; --slate: #4A5568; --mist: #8A9BA8;
          --gold: #D4A853; --gold-light: #F0C878;
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; color: var(--charcoal); background: var(--ivory); overflow-x: hidden; }
        h1, h2, h3 { font-family: 'DM Serif Display', serif; font-weight: 400; line-height: 1.1; }
        h4 { font-family: 'DM Sans', sans-serif; font-weight: 600; }

        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.75s cubic-bezier(.22,1,.36,1), transform 0.75s cubic-bezier(.22,1,.36,1); }
        .reveal.visible { opacity: 1; transform: none; }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }

        nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 0 40px; display: flex; align-items: center; justify-content: space-between; height: 72px; background: rgba(255,253,249,0.92); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(13,59,68,0.08); transition: background 0.3s, box-shadow 0.3s; }
        nav.scrolled { box-shadow: 0 2px 24px rgba(13,59,68,0.1); }
        .nav-logo { display: flex; flex-direction: column; line-height: 1; text-decoration: none; }
        .nav-logo .wordmark { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--ocean); letter-spacing: -0.3px; }
        .nav-logo .tagline-sm { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--teal); font-weight: 500; margin-top: 2px; }
        .nav-links { display: flex; gap: 36px; list-style: none; }
        .nav-links a { text-decoration: none; color: var(--slate); font-size: 14px; font-weight: 500; letter-spacing: 0.2px; transition: color 0.2s; }
        .nav-links a:hover { color: var(--ocean); }
        .nav-actions { display: flex; gap: 12px; align-items: center; }
        .btn-ghost { background: none; border: 1.5px solid var(--ocean); color: var(--ocean); padding: 9px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .btn-ghost:hover { background: var(--ocean); color: white; }
        .btn-cta { background: var(--coral); color: white; padding: 10px 22px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; box-shadow: 0 4px 16px rgba(232,96,76,0.35); transition: all 0.25s; }
        .btn-cta:hover { background: #d14f3b; box-shadow: 0 6px 24px rgba(232,96,76,0.45); transform: translateY(-1px); }

        .hero { min-height: 100vh; background: var(--ocean); position: relative; overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; align-items: center; padding: 120px 80px 80px; gap: 60px; }
        .hero-bg-circle-1 { position: absolute; top: -180px; right: -180px; width: 680px; height: 680px; background: radial-gradient(circle, rgba(78,205,196,0.18) 0%, transparent 70%); border-radius: 50%; }
        .hero-bg-circle-2 { position: absolute; bottom: -120px; left: 200px; width: 420px; height: 420px; background: radial-gradient(circle, rgba(232,96,76,0.14) 0%, transparent 70%); border-radius: 50%; }
        .hero-bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(78,205,196,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(78,205,196,0.04) 1px, transparent 1px); background-size: 60px 60px; }
        .hero-wave { position: absolute; bottom: -2px; left: 0; right: 0; }
        .hero-left { position: relative; z-index: 2; }
        .hero-eyebrow { display: inline-flex; align-items: center; gap: 10px; background: rgba(78,205,196,0.15); border: 1px solid rgba(78,205,196,0.3); padding: 7px 16px; border-radius: 100px; color: var(--teal-light); font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; margin-bottom: 28px; animation: fadeDown 0.8s cubic-bezier(.22,1,.36,1) forwards; }
        .hero-eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--teal); flex-shrink: 0; }
        .hero-headline { font-family: 'DM Serif Display', serif; font-size: clamp(44px, 5vw, 68px); color: white; line-height: 1.05; margin-bottom: 28px; animation: fadeUp 0.9s 0.1s cubic-bezier(.22,1,.36,1) both; }
        .hero-headline em { font-style: italic; color: var(--teal-light); }
        .hero-body { color: rgba(255,255,255,0.72); font-size: 18px; line-height: 1.75; max-width: 500px; margin-bottom: 40px; animation: fadeUp 0.9s 0.2s cubic-bezier(.22,1,.36,1) both; }
        .hero-actions { display: flex; gap: 16px; flex-wrap: wrap; animation: fadeUp 0.9s 0.3s cubic-bezier(.22,1,.36,1) both; }
        .btn-hero-primary { background: var(--coral); color: white; padding: 16px 34px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none; box-shadow: 0 8px 32px rgba(232,96,76,0.4); transition: all 0.25s; display: inline-block; }
        .btn-hero-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(232,96,76,0.5); }
        .btn-hero-secondary { background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.25); color: white; padding: 15px 30px; border-radius: 8px; font-size: 16px; font-weight: 500; text-decoration: none; backdrop-filter: blur(8px); transition: all 0.25s; display: inline-block; }
        .btn-hero-secondary:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.4); }
        .hero-trust-row { display: flex; gap: 28px; margin-top: 48px; flex-wrap: wrap; animation: fadeUp 0.9s 0.4s cubic-bezier(.22,1,.36,1) both; }
        .trust-badge { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.65); font-size: 13px; }
        .trust-badge svg { color: var(--teal); flex-shrink: 0; }
        .hero-right { position: relative; z-index: 2; animation: fadeUp 1s 0.15s cubic-bezier(.22,1,.36,1) both; }
        .hero-card-main { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 40px; position: relative; }
        .hero-card-photo { width: 100%; aspect-ratio: 4/5; border-radius: 14px; overflow: hidden; background: linear-gradient(160deg, rgba(78,205,196,0.3) 0%, rgba(13,59,68,0.8) 100%); display: flex; align-items: center; justify-content: center; position: relative; }
        .hero-card-photo-placeholder { text-align: center; color: rgba(255,255,255,0.5); font-size: 14px; padding: 40px; }
        .hero-card-photo-placeholder .icon { font-size: 56px; margin-bottom: 12px; display: block; }
        .stat-float { position: absolute; background: white; border-radius: 14px; padding: 16px 22px; box-shadow: 0 16px 48px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 14px; }
        .stat-float-1 { bottom: 0px; left: -60px; }
        .stat-float-2 { top: 40px; right: -40px; }
        .stat-float-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .stat-float-icon.teal { background: rgba(78,205,196,0.15); }
        .stat-float-icon.coral { background: rgba(232,96,76,0.12); }
        .stat-float-num { font-family: 'DM Serif Display'; font-size: 24px; color: var(--ocean); line-height: 1; }
        .stat-float-lbl { font-size: 11px; color: var(--mist); letter-spacing: 0.5px; margin-top: 2px; }

        .stats-band { background: var(--sand); padding: 60px 80px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px; border-top: 1px solid rgba(13,59,68,0.08); }
        .stat-item { text-align: center; }
        .stat-num { font-family: 'DM Serif Display', serif; font-size: 44px; color: var(--ocean); line-height: 1; margin-bottom: 6px; }
        .stat-lbl { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--mist); font-weight: 500; }
        .stat-sep { width: 1px; background: rgba(13,59,68,0.12); margin: auto; }

        section { padding: 100px 80px; }
        .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--teal); font-weight: 600; margin-bottom: 16px; display: block; }
        .section-title { font-size: clamp(36px, 4vw, 52px); color: var(--ocean); margin-bottom: 20px; }
        .section-desc { font-size: 18px; color: var(--slate); line-height: 1.7; max-width: 620px; }

        .services { background: var(--cream); }
        .services-header { margin-bottom: 64px; }
        .services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .service-card { background: white; border-radius: 18px; padding: 44px 40px; border: 1px solid rgba(13,59,68,0.08); transition: all 0.35s cubic-bezier(.22,1,.36,1); cursor: pointer; position: relative; overflow: hidden; }
        .service-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(78,205,196,0.04) 0%, transparent 60%); opacity: 0; transition: opacity 0.3s; }
        .service-card:hover { transform: translateY(-8px); box-shadow: 0 24px 64px rgba(13,59,68,0.12); border-color: rgba(78,205,196,0.3); }
        .service-card:hover::after { opacity: 1; }
        .service-icon-wrap { width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 28px; }
        .icon-coral { background: rgba(232,96,76,0.1); }
        .icon-teal { background: rgba(78,205,196,0.12); }
        .icon-gold { background: rgba(212,168,83,0.12); }
        .service-title { font-family: 'DM Serif Display', serif; font-size: 26px; color: var(--ocean); margin-bottom: 14px; }
        .service-desc { font-size: 15px; color: var(--slate); line-height: 1.7; margin-bottom: 28px; }
        .service-link { color: var(--teal); font-size: 14px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: gap 0.2s; }
        .service-link:hover { gap: 10px; }

        .about { background: white; }
        .about-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .about-image-wrap { position: relative; }
        .about-photo { width: 100%; aspect-ratio: 3/4; background: linear-gradient(160deg, var(--sand) 0%, rgba(78,205,196,0.2) 100%); border-radius: 20px; overflow: hidden; display: flex; align-items: center; justify-content: center; color: var(--mist); font-size: 14px; }
        .about-photo-inner { text-align: center; }
        .about-photo-inner .ph-icon { font-size: 64px; display: block; margin-bottom: 12px; }
        .about-badge { position: absolute; bottom: -24px; right: -24px; background: var(--ocean); color: white; border-radius: 16px; padding: 28px 32px; box-shadow: 0 16px 48px rgba(13,59,68,0.25); }
        .about-badge-num { font-family: 'DM Serif Display'; font-size: 48px; line-height: 1; color: var(--teal); }
        .about-badge-lbl { font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 4px; }
        .about-content { padding-left: 20px; }
        .about-name { font-size: 14px; font-weight: 500; color: var(--coral); letter-spacing: 0.5px; margin-bottom: 8px; }
        .about-title-text { font-family: 'DM Serif Display'; font-size: clamp(32px,3.5vw,46px); color: var(--ocean); margin-bottom: 24px; }
        .about-body { font-size: 16px; color: var(--slate); line-height: 1.8; margin-bottom: 36px; }
        .credentials { list-style: none; display: flex; flex-direction: column; gap: 16px; margin-bottom: 40px; }
        .cred-item { display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px; background: var(--cream); border-radius: 10px; border-left: 3px solid var(--teal); }
        .cred-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--teal); flex-shrink: 0; margin-top: 4px; }
        .cred-text { font-size: 14px; color: var(--charcoal); line-height: 1.5; }

        .approach { background: var(--ocean); padding: 100px 80px; }
        .approach-header { margin-bottom: 60px; }
        .approach-header .section-label { color: var(--teal-light); }
        .approach-header .section-title { color: white; }
        .approach-header .section-desc { color: rgba(255,255,255,0.65); }
        .tabs-nav { display: flex; gap: 0; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 6px; width: fit-content; margin-bottom: 48px; }
        .tab-btn { padding: 12px 28px; border-radius: 8px; border: none; background: none; color: rgba(255,255,255,0.6); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .tab-btn.active { background: white; color: var(--ocean); box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
        .tab-content { display: none; }
        .tab-content.active { display: grid; grid-template-columns: 1.2fr 1fr; gap: 64px; align-items: center; }
        .tab-image { aspect-ratio: 4/3; background: linear-gradient(135deg, rgba(78,205,196,0.2) 0%, rgba(232,96,76,0.15) 100%); border-radius: 18px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); font-size: 14px; }
        .tab-title { font-family: 'DM Serif Display'; font-size: 34px; color: white; margin-bottom: 18px; }
        .tab-desc { font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.8; margin-bottom: 32px; }
        .tab-features { display: flex; flex-direction: column; gap: 14px; margin-bottom: 36px; }
        .tab-feature { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(255,255,255,0.85); }
        .tab-feature-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); flex-shrink: 0; }
        .pricing-chip { display: inline-flex; align-items: baseline; gap: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 16px 24px; margin-bottom: 28px; }
        .pricing-chip .amount { font-family: 'DM Serif Display'; font-size: 36px; color: var(--teal-light); }
        .pricing-chip .per { color: rgba(255,255,255,0.5); font-size: 14px; }

        .process { background: var(--cream); }
        .process-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; margin-top: 64px; position: relative; }
        .process-connector { position: absolute; top: 36px; left: 12.5%; right: 12.5%; height: 2px; background: linear-gradient(90deg, var(--teal) 0%, var(--coral) 100%); opacity: 0.3; }
        .process-step { text-align: center; position: relative; z-index: 1; }
        .step-num { width: 72px; height: 72px; border-radius: 50%; background: white; border: 2px solid var(--teal); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-family: 'DM Serif Display'; font-size: 28px; color: var(--ocean); box-shadow: 0 8px 24px rgba(78,205,196,0.2); position: relative; }
        .step-num::before { content: ''; position: absolute; inset: -6px; border-radius: 50%; border: 1px dashed rgba(78,205,196,0.35); }
        .step-title { font-family: 'DM Serif Display'; font-size: 22px; color: var(--ocean); margin-bottom: 10px; }
        .step-desc { font-size: 14px; color: var(--slate); line-height: 1.7; }

        .testimonials { background: white; }
        .testimonials-header { text-align: center; margin-bottom: 64px; }
        .testimonials-header .section-desc { margin: 0 auto; }
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .testi-card { background: var(--cream); border-radius: 18px; padding: 40px 36px; border: 1px solid rgba(13,59,68,0.06); position: relative; transition: all 0.3s ease; }
        .testi-card:hover { box-shadow: 0 16px 48px rgba(13,59,68,0.09); transform: translateY(-4px); }
        .testi-quote { font-family: 'Cormorant Garamond'; font-size: 72px; font-weight: 300; color: var(--teal); line-height: 0.5; display: block; margin-bottom: 24px; opacity: 0.5; }
        .testi-text { font-size: 16px; color: var(--charcoal); line-height: 1.75; margin-bottom: 32px; font-style: italic; }
        .testi-author { display: flex; align-items: center; gap: 14px; }
        .testi-avatar { width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, var(--teal), var(--ocean)); display: flex; align-items: center; justify-content: center; font-family: 'DM Serif Display'; font-size: 18px; color: white; }
        .testi-name { font-size: 15px; font-weight: 600; color: var(--ocean); }
        .testi-role { font-size: 12px; color: var(--mist); margin-top: 2px; }
        .testi-stars { color: var(--gold); font-size: 14px; margin-top: 10px; letter-spacing: 2px; }

        .cta-section { background: linear-gradient(135deg, var(--coral) 0%, #c94532 100%); padding: 100px 80px; display: grid; grid-template-columns: 1fr auto; gap: 60px; align-items: center; position: relative; overflow: hidden; }
        .cta-section::before { content: ''; position: absolute; top: -80px; right: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%); border-radius: 50%; }
        .cta-label { color: rgba(255,255,255,0.75); font-size: 12px; letter-spacing: 2.5px; text-transform: uppercase; font-weight: 500; margin-bottom: 16px; display: block; }
        .cta-title { font-family: 'DM Serif Display'; font-size: clamp(36px, 4vw, 52px); color: white; margin-bottom: 16px; line-height: 1.1; }
        .cta-body { color: rgba(255,255,255,0.8); font-size: 18px; line-height: 1.6; }
        .cta-actions { flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; align-items: flex-end; }
        .btn-cta-white { background: white; color: var(--coral); padding: 18px 40px; border-radius: 8px; font-size: 16px; font-weight: 700; text-decoration: none; transition: all 0.2s; white-space: nowrap; box-shadow: 0 8px 32px rgba(0,0,0,0.15); display: inline-block; }
        .btn-cta-white:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
        .cta-contact { color: rgba(255,255,255,0.8); font-size: 14px; text-align: center; }
        .cta-contact strong { display: block; font-size: 18px; color: white; margin-bottom: 4px; }

        footer { background: var(--charcoal); color: white; padding: 80px 80px 40px; }
        .footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 64px; }
        .footer-brand .wordmark-f { font-family: 'DM Serif Display'; font-size: 26px; color: white; margin-bottom: 16px; display: block; }
        .footer-tagline { color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.7; margin-bottom: 20px; }
        .footer-contact { color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.8; }
        .footer-contact a { color: var(--teal); text-decoration: none; }
        .footer-col h5 { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--teal); margin-bottom: 20px; font-weight: 600; }
        .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .footer-col a { color: rgba(255,255,255,0.6); text-decoration: none; font-size: 14px; transition: color 0.2s; }
        .footer-col a:hover { color: white; }
        .footer-bottom { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 32px; display: flex; justify-content: space-between; align-items: center; }
        .footer-copy { color: rgba(255,255,255,0.4); font-size: 13px; }
        .social-row { display: flex; gap: 12px; }
        .social-btn { width: 38px; height: 38px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
        .social-btn:hover { background: var(--teal); border-color: var(--teal); color: white; }

        @keyframes fadeDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }

        @media (max-width: 1024px) {
          .hero, section, .stats-band, .cta-section, footer { padding-left: 40px; padding-right: 40px; }
          .hero { grid-template-columns: 1fr; }
          .hero-right { display: none; }
          .about-inner, .tab-content.active { grid-template-columns: 1fr; }
          .about-image-wrap { display: none; }
          .about-content { padding-left: 0; }
          .services-grid, .testimonials-grid { grid-template-columns: 1fr 1fr; }
          .process-grid { grid-template-columns: 1fr 1fr; }
          .process-connector { display: none; }
          .stats-band { grid-template-columns: repeat(3, 1fr); }
          .footer-top { grid-template-columns: 1fr 1fr; }
          .cta-section { grid-template-columns: 1fr; }
          .cta-actions { align-items: flex-start; }
        }
        @media (max-width: 640px) {
          nav { padding: 0 20px; }
          .nav-links { display: none; }
          .hero, section, .stats-band, .cta-section, footer { padding-left: 20px; padding-right: 20px; }
          .services-grid, .testimonials-grid, .process-grid { grid-template-columns: 1fr; }
          .stats-band { grid-template-columns: 1fr 1fr; }
          .footer-top { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav ref={navRef} id="main-nav">
        <Link href="/" className="nav-logo">
          <span className="wordmark">The Valeo Experience</span>
          <span className="tagline-sm">Caribbean Mental Health</span>
        </Link>
        <ul className="nav-links">
          <li><a href="#services">Services</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#process">How It Works</a></li>
          <li><a href="#testimonials">Stories</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <div className="nav-actions">
          <Link href="/login" className="btn-ghost">Sign In</Link>
          <Link href="/register" className="btn-cta">Get Started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-bg-circle-1"></div>
        <div className="hero-bg-circle-2"></div>
        <div className="hero-bg-grid"></div>
        <div className="hero-left">
          <div className="hero-eyebrow">Caribbean-First Mental Health Platform</div>
          <h1 className="hero-headline">
            Transform Your Life,<br />
            <em>Reclaim Your Power</em>
          </h1>
          <p className="hero-body">
            Expert psychological support rooted in Caribbean understanding. Whether navigating anxiety, healing from trauma, or stepping into your fullest potential—your journey begins here.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn-hero-primary">Begin Your Transformation</Link>
            <a href="#services" className="btn-hero-secondary">Explore Services</a>
          </div>
          <div className="hero-trust-row">
            <span className="trust-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><polyline points="5,8 7,10 11,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Health Psychologist PhD
            </span>
            <span className="trust-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><polyline points="5,8 7,10 11,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              15+ Years Experience
            </span>
            <span className="trust-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><polyline points="5,8 7,10 11,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              HIPAA Compliant
            </span>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-card-main">
            <div className="hero-card-photo">
              <div className="hero-card-photo-placeholder">
                <span className="icon">🌺</span>
                Professional photo of<br />Dr. Jozelle Miller
              </div>
            </div>
          </div>
          <div className="stat-float stat-float-1">
            <div className="stat-float-icon teal">⭐</div>
            <div>
              <div className="stat-float-num">4.9/5</div>
              <div className="stat-float-lbl">Client Rating</div>
            </div>
          </div>
          <div className="stat-float stat-float-2">
            <div className="stat-float-icon coral">🌿</div>
            <div>
              <div className="stat-float-num">500+</div>
              <div className="stat-float-lbl">Lives Transformed</div>
            </div>
          </div>
        </div>
        <svg className="hero-wave" viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#FAF8F3" />
        </svg>
      </section>

      {/* STATS BAND */}
      <div className="stats-band">
        <div className="stat-item reveal"><div className="stat-num">500+</div><div className="stat-lbl">Lives Transformed</div></div>
        <div className="stat-sep"></div>
        <div className="stat-item reveal reveal-delay-1"><div className="stat-num">PhD</div><div className="stat-lbl">Health Psychology</div></div>
        <div className="stat-sep"></div>
        <div className="stat-item reveal reveal-delay-2"><div className="stat-num">15+</div><div className="stat-lbl">Years Experience</div></div>
        <div className="stat-sep"></div>
        <div className="stat-item reveal reveal-delay-3"><div className="stat-num">4.9★</div><div className="stat-lbl">Client Rating</div></div>
        <div className="stat-sep"></div>
        <div className="stat-item reveal reveal-delay-4"><div className="stat-num">100%</div><div className="stat-lbl">Confidential Care</div></div>
      </div>

      {/* SERVICES */}
      <section className="services" id="services">
        <div className="services-header reveal">
          <span className="section-label">What We Offer</span>
          <h2 className="section-title">Find the Support<br />That Fits Your Journey</h2>
          <p className="section-desc">From individual therapy to workplace wellness—we meet you where you are with culturally-informed, evidence-based care.</p>
        </div>
        <div className="services-grid">
          {[
            { icon: '🧠', cls: 'icon-coral', title: 'Individual Therapy', desc: 'One-on-one psychological support for anxiety, depression, trauma, and life\'s most challenging transitions. Your story is unique—your therapy should be too.', link: 'Explore Individual Therapy →' },
            { icon: '💞', cls: 'icon-teal', title: 'Couples & Families', desc: 'Heal relationships, restore communication, and build deeper bonds with those who matter most. Navigating life together, better.', link: 'Explore Couples Therapy →', delay: 'reveal-delay-1' },
            { icon: '🏢', cls: 'icon-gold', title: 'Workplace Wellness', desc: 'Corporate programs, team workshops, and leadership development that build thriving cultures and resilient teams across the Caribbean.', link: 'Explore Workplace Programs →', delay: 'reveal-delay-2' },
            { icon: '🎙️', cls: 'icon-teal', title: 'Keynote Speaking', desc: 'Internationally recognized presentations on mental health, resilience, and the Caribbean experience. Powerful, practical, and deeply personal.', link: 'Book a Speaking Engagement →', delay: 'reveal-delay-1' },
            { icon: '📚', cls: 'icon-coral', title: 'Books & Resources', desc: 'Three published books on resilience, healing, and transformation—distilled wisdom to support your journey between sessions.', link: 'View Publications →', delay: 'reveal-delay-2' },
            { icon: '✨', cls: 'icon-gold', title: 'Resilience Coaching', desc: 'Future-focused coaching to unlock your fullest potential, overcome mental blocks, and step into the version of yourself you know you can be.', link: 'Start Coaching →', delay: 'reveal-delay-3' },
          ].map((s, i) => (
            <div key={i} className={`service-card reveal ${s.delay || ''}`}>
              <div className={`service-icon-wrap ${s.cls}`}>{s.icon}</div>
              <div className="service-title">{s.title}</div>
              <p className="service-desc">{s.desc}</p>
              <Link href="/register" className="service-link">{s.link}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section className="about" id="about">
        <div className="about-inner">
          <div className="about-image-wrap reveal">
            <div className="about-photo">
              <div className="about-photo-inner">
                <span className="ph-icon">👩‍⚕️</span>
                Professional portrait of<br />Dr. Jozelle M. Miller
              </div>
            </div>
            <div className="about-badge">
              <div className="about-badge-num">15+</div>
              <div className="about-badge-lbl">Years of<br />Transformative Practice</div>
            </div>
          </div>
          <div className="about-content reveal reveal-delay-1">
            <div className="about-name">Dr. Jozelle M. Miller, PhD</div>
            <h2 className="about-title-text">Your Partner<br />in Transformation</h2>
            <p className="about-body">For over 15 years, I&apos;ve had the privilege of walking alongside individuals and families through their darkest moments—and celebrating with them as they rediscover their light. My approach combines cutting-edge psychology with deep cultural understanding. Because healing happens best when you&apos;re truly seen, heard, and understood in your full Caribbean context.</p>
            <ul className="credentials">
              {[
                'PhD in Health Psychology — rigorous academic training meets real-world practice',
                'Published Author of 3 Books on Resilience, Healing & Caribbean Mental Health',
                'International Keynote Speaker — conferences across the Caribbean and beyond',
                'Specialising in Trauma Recovery, Anxiety, and Workplace Mental Health',
                'Based in Kingstown, St. Vincent & the Grenadines',
              ].map((c, i) => (
                <li key={i} className="cred-item">
                  <div className="cred-dot"></div>
                  <div className="cred-text">{c}</div>
                </li>
              ))}
            </ul>
            <Link href="/register" className="btn-cta">Meet Dr. Miller</Link>
          </div>
        </div>
      </section>

      {/* APPROACH TABS */}
      <section className="approach" id="approach">
        <div className="approach-header reveal">
          <span className="section-label">Our Approach</span>
          <h2 className="section-title">The Valeo Experience Method</h2>
          <p className="section-desc">Evidence-based methods combined with Caribbean cultural wisdom. Choose your pathway:</p>
        </div>
        <div className="tabs-nav reveal">
          {['therapy', 'coaching', 'workplace', 'speaking'].map((tab) => (
            <button key={tab} className={`tab-btn${tab === 'therapy' ? ' active' : ''}`} data-tab={tab} onClick={() => handleTabClick(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="tab-content active" id="tab-therapy">
          <div className="tab-image">📷 Therapy Session Image</div>
          <div className="tab-body">
            <h3 className="tab-title">Individual Therapy</h3>
            <p className="tab-desc">Personalized psychological support tailored to you. Using evidence-based modalities including CBT, trauma-informed care, and culturally-adaptive techniques.</p>
            <div className="tab-features">
              {['Comprehensive psychological assessment','Personalised evidence-based treatment plan','Secure virtual or in-person sessions','Emotional intelligence development','Progress tracking & between-session resources'].map((f,i) => <div key={i} className="tab-feature"><div className="tab-feature-dot"></div>{f}</div>)}
            </div>
            <div className="pricing-chip"><span className="amount">$75</span><span className="per">/ session</span></div>
            <br />
            <Link href="/register" className="btn-hero-primary">Book Free Consultation</Link>
          </div>
        </div>

        <div className="tab-content" id="tab-coaching">
          <div className="tab-image">📷 Coaching Session Image</div>
          <div className="tab-body">
            <h3 className="tab-title">Resilience Coaching</h3>
            <p className="tab-desc">Forward-focused coaching for those ready to break through mental barriers and operate at their fullest potential. Not therapy—transformation.</p>
            <div className="tab-features">
              {['Goal mapping and vision clarity sessions','Mindset shift frameworks','Accountability structure and milestones','Leadership and emotional intelligence development','Flexible scheduling for busy professionals'].map((f,i) => <div key={i} className="tab-feature"><div className="tab-feature-dot"></div>{f}</div>)}
            </div>
            <div className="pricing-chip"><span className="amount">Request</span><span className="per">/ a Quote</span></div>
            <br />
            <Link href="/register" className="btn-hero-primary">Start Coaching</Link>
          </div>
        </div>

        <div className="tab-content" id="tab-workplace">
          <div className="tab-image">📷 Workplace Workshop Image</div>
          <div className="tab-body">
            <h3 className="tab-title">Workplace Wellness Programs</h3>
            <p className="tab-desc">Bespoke organisational programs that reduce burnout, improve team cohesion, and create psychologically safe workplaces across the Caribbean.</p>
            <div className="tab-features">
              {['Workplace mental health assessments','Custom workshop design and facilitation','Leadership resilience training','Ongoing staff wellness check-ins','Crisis intervention support'].map((f,i) => <div key={i} className="tab-feature"><div className="tab-feature-dot"></div>{f}</div>)}
            </div>
            <div className="pricing-chip"><span className="amount">Request</span><span className="per">a Quote</span></div>
            <br />
            <Link href="/register" className="btn-hero-primary">Request a Proposal</Link>
          </div>
        </div>

        <div className="tab-content" id="tab-speaking">
          <div className="tab-image">📷 Keynote Speaking Image</div>
          <div className="tab-body">
            <h3 className="tab-title">Keynote Speaking</h3>
            <p className="tab-desc">Internationally acclaimed presentations on mental health, Caribbean resilience, and the psychology of transformation. Memorable, practical, and life-changing.</p>
            <div className="tab-features">
              {['Conferences, summits, and corporate events','Topics tailored to your audience','Available regionally and internationally','Virtual and in-person presentations','Pre-event consultation included'].map((f,i) => <div key={i} className="tab-feature"><div className="tab-feature-dot"></div>{f}</div>)}
            </div>
            <div className="pricing-chip"><span className="amount">Request</span><span className="per">a Quote</span></div>
            <br />
            <Link href="/register" className="btn-hero-primary">Book Dr. Miller</Link>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="process" id="process">
        <span className="section-label reveal">Your Journey</span>
        <h2 className="section-title reveal">Four Simple Steps<br />to Transformation</h2>
        <div className="process-grid">
          <div className="process-connector"></div>
          {[
            { n: '1', title: 'Free Consultation', desc: 'A 15-minute introductory call to explore your goals, answer your questions, and ensure we\'re a great fit.' },
            { n: '2', title: 'Assessment', desc: 'Complete a comprehensive intake assessment so Dr. Miller can fully understand your unique history and needs.', d: 'reveal-delay-1' },
            { n: '3', title: 'Your Plan', desc: 'Receive a personalised treatment or coaching plan built specifically around your goals and circumstances.', d: 'reveal-delay-2' },
            { n: '4', title: 'Grow & Heal', desc: 'Begin your sessions, track your progress, and step into the most empowered version of yourself.', d: 'reveal-delay-3' },
          ].map((s, i) => (
            <div key={i} className={`process-step reveal ${s.d || ''}`}>
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials" id="testimonials">
        <div className="testimonials-header">
          <span className="section-label reveal">Client Stories</span>
          <h2 className="section-title reveal">Transformations in Their Words</h2>
          <p className="section-desc reveal">Real journeys from real people who found healing, clarity, and power through The Valeo Experience.</p>
        </div>
        <div className="testimonials-grid">
          {[
            { init: 'S', name: 'Sarah M.', role: 'Individual Therapy Client', text: 'Dr. Miller helped me understand and overcome anxiety I\'d been carrying for years. Her approach is warm, professional, and genuinely culturally attuned. I\'m finally living the life I know I deserve.' },
            { init: 'J', name: 'James T.', role: 'CEO, Caribbean Tech Co.', text: 'The workplace wellness programme transformed our team culture completely. Productivity is up, stress is down, and our people feel genuinely valued. The best investment we\'ve ever made.', d: 'reveal-delay-1' },
            { init: 'M', name: 'Michelle L.', role: 'Resilience Coaching Client', text: 'After years of struggling alone, Dr. Miller gave me both the tools and the safe space to heal from deep trauma. Her approach is evidence-based and deeply compassionate in equal measure.', d: 'reveal-delay-2' },
          ].map((t, i) => (
            <div key={i} className={`testi-card reveal ${t.d || ''}`}>
              <span className="testi-quote">&ldquo;</span>
              <p className="testi-text">{t.text}</p>
              <div className="testi-author">
                <div className="testi-avatar">{t.init}</div>
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role}</div>
                  <div className="testi-stars">★ ★ ★ ★ ★</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="book">
        <div className="reveal">
          <span className="cta-label">Ready to Begin?</span>
          <h2 className="cta-title">Your Transformation<br />is One Step Away</h2>
          <p className="cta-body">Book your free 15-minute consultation today. No pressure, no commitment—just a conversation about what&apos;s possible for you.</p>
        </div>
        <div className="cta-actions reveal reveal-delay-1">
          <Link href="/register" className="btn-cta-white">Book Free Consultation</Link>
          <div className="cta-contact">
            <strong>(784) 498-7772</strong>
            Mon–Wed 3–9pm &nbsp;|&nbsp; Thu–Fri 2–5pm
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="wordmark-f">The Valeo Experience</span>
            <p className="footer-tagline">Transforming lives through culturally-informed, evidence-based mental health care in the heart of the Caribbean.</p>
            <p className="footer-contact">
              Kingstown, St. Vincent &amp; the Grenadines<br />
              (784) 498-7772<br />
              <a href="mailto:info@valeoexperience.com">info@valeoexperience.com</a>
            </p>
          </div>
          <div className="footer-col">
            <h5>Services</h5>
            <ul>
              <li><Link href="/register">Individual Therapy</Link></li>
              <li><Link href="/register">Couples Therapy</Link></li>
              <li><Link href="/register">Group Therapy</Link></li>
              <li><Link href="/register">Workplace Wellness</Link></li>
              <li><Link href="/register">Life Coaching</Link></li>
              <li><Link href="/register">Keynote Speaking</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>About</h5>
            <ul>
              <li><a href="#about">Dr. Jozelle Miller</a></li>
              <li><a href="#approach">Our Approach</a></li>
              <li><a href="#testimonials">Testimonials</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Platform</h5>
            <ul>
              <li><Link href="/login">Sign In</Link></li>
              <li><Link href="/register">Get Started</Link></li>
              <li><Link href="/register">Book a Session</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Legal</h5>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">HIPAA Notice</a></li>
              <li><a href="#">Disclaimer</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© 2026 The Valeo Experience · All Rights Reserved</div>
          <div className="social-row">
            <a href="#" className="social-btn">f</a>
            <a href="#" className="social-btn">in</a>
            <a href="#" className="social-btn">ig</a>
          </div>
        </div>
      </footer>
    </>
  );
}
