import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Zap, Shield, Globe, CreditCard, ArrowRight, CheckCircle,
  Wallet, Star, TrendingUp, XCircle, AlertCircle,
  Gift, Fingerprint, Ticket,
} from 'lucide-react';
import { LandingNav } from '../../components/landing/LandingNav';
import { LandingFooter } from '../../components/landing/LandingFooter';

/* -- Helpers --------------------------------------------------------------- */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay },
});
const stagger = (i: number) => fadeUp(i * 0.07);

/* -- Data ------------------------------------------------------------------ */
const FEATURES = [
  {
    icon: CreditCard,
    title: 'Instant Card Issuance',
    desc: 'Generate a Visa or Mastercard virtual card in seconds — unique PAN, CVV and expiry, ready to charge immediately.',
    accent: 'border-l-indigo-500',
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
  },
  {
    icon: Zap,
    title: 'Real-time Authorisations',
    desc: 'Every payment hits our engine in milliseconds. Approve or decline based on balance, limits, and fraud signals instantly.',
    accent: 'border-l-amber-500',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  {
    icon: AlertCircle,
    title: 'Smart Decline Handling',
    desc: 'Know exactly why a payment failed — insufficient funds, blocked merchant, 3DS failure. Full decline reason codes surfaced.',
    accent: 'border-l-rose-500',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
  },
  {
    icon: Gift,
    title: 'Voucher-to-Card Flow',
    desc: 'Buy a gift voucher, redeem it to load a pre-paid balance, and issue a virtual card on the spot. No bank account needed.',
    accent: 'border-l-emerald-500',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: Globe,
    title: 'International Payments',
    desc: 'Spend anywhere Visa or Mastercard is accepted — online, in apps, across 180+ countries. Multi-currency, low FX markup.',
    accent: 'border-l-cyan-500',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
  },
  {
    icon: Fingerprint,
    title: '3DS & Fraud Protection',
    desc: '3D Secure authentication, real-time fraud scoring, and instant card freeze built into every transaction.',
    accent: 'border-l-purple-500',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
  },
];

const STEPS = [
  {
    num: '01',
    icon: Wallet,
    title: 'Create a free account',
    desc: 'No monthly fees, no membership. Sign up in under 2 minutes — no paperwork or branch visits required.',
  },
  {
    num: '02',
    icon: Gift,
    title: 'Load your balance',
    desc: 'Buy a voucher, redeem a gift card, or top up directly. Funds land on your pre-paid balance instantly.',
  },
  {
    num: '03',
    icon: CreditCard,
    title: 'Issue & spend',
    desc: 'Generate a virtual card in seconds. Use it for any online purchase, subscription, or international payment.',
  },
];

const STATS = [
  { value: '500K+', label: 'Cards issued' },
  { value: '10M+', label: 'Authorisations' },
  { value: '99.1%', label: 'Auth success rate' },
  { value: '180+', label: 'Countries' },
];

const TESTIMONIALS = [
  {
    name: 'Tariro M.',
    role: 'Freelancer · Zimbabwe',
    body: 'I receive USD from international clients and issue a virtual card on the spot. No bank account, no delays — payments just work.',
    avatar: 'T',
    color: 'bg-indigo-600',
  },
  {
    name: 'Olumide A.',
    role: 'E-commerce · Nigeria',
    body: 'The voucher-to-card flow is brilliant. I buy a voucher, load it, and have a working Mastercard in 60 seconds flat.',
    avatar: 'O',
    color: 'bg-purple-600',
  },
  {
    name: 'Priya S.',
    role: 'Developer · South Africa',
    body: 'The decline reason codes alone are worth it. I can see exactly why a payment failed and fix it — no more guessing.',
    avatar: 'P',
    color: 'bg-emerald-600',
  },
];

/* -- Floating card visuals ------------------------------------------------- */
function FloatingCard() {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="relative w-64 sm:w-72 lg:w-80 h-40 sm:h-44 lg:h-48 rounded-2xl overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
        boxShadow: '0 24px 56px rgba(99,102,241,0.40)',
      }}
    >
      <div className="absolute inset-0 bg-noise opacity-30" />
      <div className="absolute top-5 left-5 w-9 h-6 rounded bg-gradient-to-br from-amber-300 to-amber-500 opacity-90" />
      <div className="absolute top-5 right-5 flex -space-x-2">
        <div className="w-7 h-7 rounded-full bg-red-500/80" />
        <div className="w-7 h-7 rounded-full bg-amber-500/80" />
      </div>
      <div className="absolute bottom-10 left-5 right-5">
        <p className="font-mono text-foreground/90 tracking-[0.18em] text-sm">4242 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 8765</p>
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
        <p className="text-foreground font-semibold text-xs tracking-wide uppercase">T. MUPFAWA</p>
        <p className="text-foreground/60 text-[10px] font-mono">08/28</p>
      </div>
    </motion.div>
  );
}

function FloatingCardSmall() {
  return (
    <motion.div
      animate={{ y: [0, 9, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      className="relative w-48 sm:w-52 lg:w-56 h-32 sm:h-34 lg:h-36 rounded-xl overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)',
        boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="absolute inset-0 bg-noise opacity-20" />
      <div className="absolute top-4 left-4 w-7 h-5 rounded bg-gradient-to-br from-amber-300 to-amber-400 opacity-80" />
      <div className="absolute bottom-4 left-4 right-4">
        <p className="font-mono text-foreground/70 tracking-[0.12em] text-[10px] mb-1.5">5262 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 1193</p>
        <div className="flex justify-between items-end">
          <p className="text-foreground/60 text-[10px] font-medium uppercase">O. ADEYEMI</p>
          <p className="text-foreground/40 text-[10px] font-mono">12/27</p>
        </div>
      </div>
    </motion.div>
  );
}

/* -- Auth feed mock -------------------------------------------------------- */
function AuthFeed() {
  const events = [
    { type: 'approved', merchant: 'Shopify Store', amount: '$49.99', currency: 'USD', time: '0.3s', flag: '🇺🇸' },
    { type: 'approved', merchant: 'Adobe Creative', amount: '$54.99', currency: 'USD', time: '0.2s', flag: '🇺🇸' },
    { type: 'declined', merchant: 'Unknown Merchant', amount: '$299.00', reason: 'Fraud signal', time: '0.1s', flag: '🌐' },
    { type: 'approved', merchant: 'DigitalOcean', amount: '$12.00', currency: 'USD', time: '0.4s', flag: '🇺🇸' },
  ];

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/[0.05]">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            e.type === 'approved' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
          }`}>
            {e.type === 'approved'
              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              : <XCircle className="w-3.5 h-3.5 text-rose-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-xs font-medium truncate">{e.flag} {e.merchant}</p>
            <p className="text-foreground/30 text-[10px]">
              {e.type === 'declined' ? e.reason : e.currency} · {e.time}
            </p>
          </div>
          <p className={`text-xs font-semibold tabular-nums flex-shrink-0 ${
            e.type === 'approved' ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {e.amount}
          </p>
        </div>
      ))}
    </div>
  );
}

/* -- Page ------------------------------------------------------------------ */
export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // React Router doesn't auto-scroll to URL hash fragments on navigation
  // the way a full page load does — clicking "How it works" / "For agents"
  // in the nav landed on this page without ever scrolling to the section,
  // which read as a dead "#" link.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      {/* -- Hero: full viewport width, no max-w cap ------------------------- */}
      <section ref={heroRef} className="relative min-h-[100svh] flex items-center overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="glow-orb w-[480px] h-[480px] -top-24 -left-24 bg-indigo-600 opacity-[0.10]" />
        <div className="glow-orb w-[400px] h-[400px] bottom-0 right-0 bg-purple-600 opacity-[0.07]" />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 w-full flex flex-col lg:flex-row min-h-[100svh]"
        >
          {/* Left: text with side padding, no max-w on the column */}
          <div className="flex-1 flex flex-col justify-center
                          px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-24
                          pt-24 pb-10 lg:py-0
                          text-center lg:text-left">
            <div className="max-w-xl mx-auto lg:mx-0">
              <motion.p {...fadeUp(0)}
                className="inline-block text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-4">
                Virtual cards for international payments
              </motion.p>

              <motion.h1 {...fadeUp(0.06)}
                className="font-display font-bold leading-[1.08] text-foreground mb-4
                           text-[1.875rem] sm:text-[2.375rem] lg:text-[2.75rem] xl:text-[3.125rem]">
                Your payments,{' '}
                <span className="text-gradient">everywhere</span>{' '}
                they need to be
              </motion.h1>

              <motion.p {...fadeUp(0.12)}
                className="text-foreground/50 text-sm sm:text-[0.9375rem] leading-relaxed mb-8">
                Instant virtual Visa &amp; Mastercard cards, voucher-to-card redemption, and
                real-time authorisations — built for international payments that actually work.
              </motion.p>

              <motion.div {...fadeUp(0.17)}
                className="flex flex-col sm:flex-row gap-2.5 justify-center lg:justify-start">
                <Link to="/auth/register"
                  className="btn-brand flex items-center justify-center gap-2 px-6 py-3 text-sm">
                  Issue your first card free
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <a href="#how-it-works"
                  className="btn-ghost flex items-center justify-center gap-2 px-6 py-3 text-sm">
                  See how it works
                </a>
              </motion.div>

              <motion.div {...fadeUp(0.22)}
                className="flex flex-wrap items-center gap-4 mt-7 justify-center lg:justify-start">
                {['Free to join', 'No monthly fees', '180+ countries'].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-foreground/35 text-xs">
                    <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Right: card visuals fill the right ~45% of the viewport */}
          <motion.div
            {...fadeUp(0.14)}
            className="hidden lg:flex flex-shrink-0 items-center justify-center
                       w-[44%] xl:w-[46%] relative
                       pr-8 xl:pr-14 2xl:pr-24"
          >
            <div className="absolute w-96 h-96 rounded-full blur-3xl bg-indigo-600/18" />
            <div className="relative w-full max-w-md h-80 xl:h-96">
              <div className="absolute top-8 right-0 xl:right-8">
                <FloatingCard />
              </div>
              <div className="absolute bottom-4 left-0 xl:left-8 z-10">
                <FloatingCardSmall />
              </div>
            </div>
          </motion.div>

          {/* Mobile: card shown below text */}
          <motion.div
            {...fadeUp(0.18)}
            className="lg:hidden flex justify-center pb-10 px-4 relative"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-60 h-60 rounded-full blur-3xl bg-indigo-600/15" />
            </div>
            <div className="relative z-10">
              <FloatingCard />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* -- Stats ----------------------------------------------------------- */}
      <section className="border-y border-foreground/[0.06] bg-foreground/[0.015] py-8 sm:py-10 px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {STATS.map((s, i) => (
            <motion.div key={s.label} {...stagger(i)} className="text-center">
              <p className="font-display font-bold text-gradient text-3xl sm:text-4xl tabular-nums mb-0.5">{s.value}</p>
              <p className="text-foreground/40 text-xs sm:text-sm">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* -- Features -------------------------------------------------------- */}
      <section id="features" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="mb-10 sm:mb-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-indigo-400 font-semibold text-xs uppercase tracking-widest mb-2">Built for real payments</p>
              <h2 className="font-display font-bold text-foreground text-2xl sm:text-[1.875rem] lg:text-[2.25rem]">
                Everything from issuance to settlement
              </h2>
            </div>
            <p className="text-foreground/40 text-sm sm:text-[0.9375rem] max-w-sm lg:text-right lg:pb-1">
              From the moment a card is created to every authorisation decision — full visibility, full control.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...stagger(i)}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={`glass-card p-5 border-l-2 ${f.accent} cursor-default`}
              >
                <div className={`w-9 h-9 rounded-xl ${f.iconBg} flex items-center justify-center mb-3 ${f.iconColor}`}>
                  <f.icon className="w-4 h-4" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-[0.9375rem] mb-1.5">{f.title}</h3>
                <p className="text-foreground/45 text-xs sm:text-[0.8125rem] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -- How it works ---------------------------------------------------- */}
      <section id="how-it-works" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10 bg-foreground/[0.01] border-y border-foreground/[0.05]">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="mb-10 sm:mb-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-purple-400 font-semibold text-xs uppercase tracking-widest mb-2">Pay per use</p>
              <h2 className="font-display font-bold text-foreground text-2xl sm:text-[1.875rem] lg:text-[2.25rem]">
                Card in hand in under 60 seconds
              </h2>
            </div>
            <p className="text-foreground/40 text-sm sm:text-[0.9375rem] max-w-sm lg:text-right lg:pb-1">
              No subscription. No waiting. Join free, load balance with a voucher, and start spending globally.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
            {STEPS.map((step, i) => (
              <motion.div key={step.num} {...stagger(i)} className="relative">
                <span className="absolute -top-2 -left-1 font-display font-bold text-[5rem] sm:text-[6rem]
                                 text-foreground/[0.04] leading-none select-none pointer-events-none">
                  {step.num}
                </span>
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl glass-card border border-indigo-500/20 flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground text-base mb-2">{step.title}</h3>
                  <p className="text-foreground/45 text-xs sm:text-[0.8125rem] leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Authorisation showcase ------------------------------------------ */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div {...fadeUp()} className="relative order-2 lg:order-1">
            <div className="glow-orb w-52 h-52 -left-8 top-8 bg-indigo-600 opacity-[0.12]" />
            <div className="glass-card p-5 relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-foreground/40 text-[10px] uppercase tracking-wider mb-0.5">Active card</p>
                  <p className="font-mono text-foreground text-sm font-semibold tracking-widest">4242 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 8765</p>
                </div>
                <div className="text-right">
                  <p className="text-foreground/40 text-[10px] mb-0.5">Balance</p>
                  <p className="font-display font-bold text-foreground text-xl tabular-nums">$248.50</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <p className="text-emerald-400 text-xs font-medium">Authorisation engine active</p>
                <p className="text-emerald-400/60 text-[10px] ml-auto">~0.3s avg</p>
              </div>
              <p className="text-foreground/30 text-[10px] uppercase tracking-wider mb-2">Recent authorisations</p>
              <AuthFeed />
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="order-1 lg:order-2">
            <p className="text-indigo-400 font-semibold text-xs uppercase tracking-widest mb-3">Real-time engine</p>
            <h2 className="font-display font-bold text-foreground leading-tight mb-4 text-2xl sm:text-[1.875rem] lg:text-[2.25rem]">
              Every authorisation, every decline — in real time
            </h2>
            <p className="text-foreground/45 text-sm sm:text-[0.9375rem] leading-relaxed mb-6">
              Our authorisation engine processes every payment request in milliseconds.
              Approved transactions land instantly; declines include full reason codes so you
              always know exactly what happened.
            </p>
            <div className="space-y-3 mb-7">
              {[
                'Full Visa & Mastercard authorisation flow',
                'Decline codes: insufficient funds, 3DS failure, fraud block',
                'Per-card spend limits and category controls',
                'Instant card freeze on suspicious activity',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-foreground/65 text-sm">{item}</p>
                </div>
              ))}
            </div>
            <Link to="/auth/register" className="btn-brand inline-flex items-center gap-2 px-6 py-3 text-sm">
              Get started free <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* -- Voucher partner banner ------------------------------------------ */}
      {/* Carries the #for-agents anchor: agents sell vouchers for cash and
          local rails — the old "build a card issuance business" pitch was
          removed because we don't offer that programme. */}
      <section id="for-agents" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            {...fadeUp()}
            className="relative overflow-hidden rounded-3xl border border-amber-500/20
                       bg-gradient-to-br from-amber-600/[0.08] via-transparent to-emerald-600/[0.06] p-8 sm:p-10 lg:p-12"
          >
            <div className="glow-orb w-80 h-80 -right-20 -bottom-20 bg-amber-500 opacity-[0.07]" />
            <div className="glow-orb w-56 h-56 -left-10 -top-10 bg-emerald-500 opacity-[0.06]" />

            <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-14">

              {/* Left: headline + copy */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-amber-400 font-semibold text-xs uppercase tracking-widest">
                    Voucher partner programme
                  </span>
                </div>

                <h2 className="font-display font-bold text-foreground text-2xl sm:text-[1.875rem] leading-tight mb-3">
                  Sell vouchers.{' '}
                  <span className="bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent">
                    Earn on every redemption.
                  </span>
                </h2>

                <p className="text-foreground/50 text-sm sm:text-[0.9375rem] leading-relaxed max-w-lg">
                  Want to issue and sell ePay Smart redemption vouchers through your business or network?
                  Fill in a short application — we review every request and respond within 2 business days.
                  Approval is required; accepted partners get access to our full voucher distribution toolkit.
                </p>
              </div>

              {/* Divider */}
              <div className="hidden lg:block w-px self-stretch bg-foreground/[0.07] flex-shrink-0" />

              {/* Right: bullet points + CTA */}
              <div className="lg:w-72 flex-shrink-0 space-y-5">
                <ul className="space-y-2.5">
                  {[
                    'Set your own voucher denominations',
                    'Earn commission on every redemption',
                    'Quick 2-minute application form',
                    'Subject to review & approval',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-foreground/65 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/auth/register"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold
                             bg-amber-500 hover:bg-amber-400 text-black rounded-xl
                             transition-all duration-200 active:scale-[0.98]"
                >
                  Apply to become a partner
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <p className="text-foreground/25 text-[11px] text-center">
                  Simple application · Response within 2 business days
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* -- Security -------------------------------------------------------- */}
      <section id="security" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="mb-10 sm:mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-emerald-400 font-semibold text-xs uppercase tracking-widest mb-2">Trust &amp; safety</p>
              <h2 className="font-display font-bold text-foreground text-2xl sm:text-[1.875rem] lg:text-[2.25rem]">
                Security at every layer
              </h2>
            </div>
            <p className="text-foreground/40 text-sm sm:text-[0.9375rem] max-w-sm lg:text-right lg:pb-1">
              Every card, every authorisation, every transaction flows through security-first infrastructure.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: '256-bit AES encryption', desc: 'Card data encrypted at rest and in transit.' },
              { icon: Fingerprint, title: '3D Secure (3DS)', desc: 'Cardholder authentication on every online transaction.' },
              { icon: AlertCircle, title: 'Fraud scoring', desc: 'ML models flag anomalies before they complete.' },
              { icon: TrendingUp, title: 'KYC & AML compliance', desc: 'Full identity verification pipeline, always on.' },
            ].map((item, i) => (
              <motion.div key={item.title} {...stagger(i)}
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="glass-card p-5 border border-emerald-500/10 cursor-default"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                  <item.icon className="w-4 h-4" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-sm mb-1.5">{item.title}</h3>
                <p className="text-foreground/40 text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Testimonials ---------------------------------------------------- */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10 bg-foreground/[0.01] border-y border-foreground/[0.05]">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="mb-10 sm:mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-indigo-400 font-semibold text-xs uppercase tracking-widest mb-2">Real users</p>
              <h2 className="font-display font-bold text-foreground text-2xl sm:text-[1.875rem] lg:text-[2.25rem]">
                Payments that actually go through
              </h2>
            </div>
            <p className="text-foreground/40 text-sm lg:text-right lg:pb-1 max-w-xs">
              Real people, real transactions — see what our users say.
            </p>
          </motion.div>

          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory
                          md:grid md:grid-cols-3 md:overflow-visible md:pb-0"
               style={{ WebkitOverflowScrolling: 'touch' }}>
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} {...stagger(i)}
                className="glass-card p-5 flex flex-col gap-3 cursor-default flex-shrink-0
                           w-[78vw] max-w-[300px] snap-start
                           md:w-auto md:max-w-none md:flex-shrink"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-foreground/65 text-xs sm:text-[0.8125rem] leading-relaxed flex-1">"{t.body}"</p>
                <div className="flex items-center gap-2.5 pt-2 border-t border-foreground/[0.06]">
                  <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center text-foreground font-bold text-xs flex-shrink-0`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-xs">{t.name}</p>
                    <p className="text-foreground/35 text-[10px]">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -- CTA ------------------------------------------------------------- */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto text-center">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-b from-indigo-600/10 to-transparent p-10 sm:p-14">
            <div className="glow-orb w-64 h-64 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 opacity-[0.18]" />
            <motion.div {...fadeUp()} className="relative">
              <h2 className="font-display font-bold text-foreground leading-tight mb-4 text-[1.875rem] sm:text-[2.375rem]">
                Ready to start accepting{' '}
                <span className="text-gradient">international payments?</span>
              </h2>
              <p className="text-foreground/45 text-sm sm:text-[0.9375rem] leading-relaxed mb-8">
                Join free. No monthly fee. Issue your first virtual card in under a minute
                and start spending across 180+ countries.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <Link to="/auth/register"
                  className="btn-brand flex items-center justify-center gap-2 px-8 py-3.5 text-sm">
                  Issue your first card free
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link to="/login"
                  className="btn-ghost flex items-center justify-center gap-2 px-8 py-3.5 text-sm">
                  Sign in
                </Link>
              </div>
              <p className="text-foreground/25 text-xs mt-5">Free to join · Pay per use · No monthly fee</p>
            </motion.div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
