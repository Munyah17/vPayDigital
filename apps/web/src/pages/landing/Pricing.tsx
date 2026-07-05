import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check, Zap, ArrowRight, CreditCard, Globe, Shield,
  BarChart3, Users, Headphones, Star, ChevronDown, ChevronUp,
} from 'lucide-react';
import { LandingNav } from '../../components/landing/LandingNav';
import { LandingFooter } from '../../components/landing/LandingFooter';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay },
});

/* ── Data ────────────────────────────────────────────────────────────────────── */
const PLANS = [
  {
    name: 'Personal',
    price: { monthly: 0, annual: 0 },
    desc: 'For individuals just getting started with digital finance.',
    badge: null,
    color: 'border-foreground/[0.08]',
    highlight: false,
    cta: 'Get started free',
    features: [
      '1 virtual card',
      'Multi-currency wallet (USD, EUR, GBP)',
      'Up to $1,000/month transfers',
      'Standard KYC verification',
      'Gift voucher redemption',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: { monthly: 9.99, annual: 7.99 },
    desc: 'For power users who need unlimited cards and advanced controls.',
    badge: 'Most popular',
    color: 'border-indigo-500/40',
    highlight: true,
    cta: 'Start Pro trial',
    features: [
      '5 virtual cards',
      'All 50+ currencies',
      'Unlimited transfers',
      'Priority KYC (same day)',
      'Spending analytics & insights',
      'Custom card spend limits',
      'Card freeze & unfreeze',
      'Chat & email support',
    ],
  },
  {
    name: 'Business',
    price: { monthly: 49.99, annual: 39.99 },
    desc: 'For agents, businesses, and teams moving serious volume.',
    badge: 'Agent ready',
    color: 'border-purple-500/30',
    highlight: false,
    cta: 'Contact sales',
    features: [
      'Unlimited virtual cards',
      'Agent dashboard & analytics',
      'Bulk card issuance',
      'API access (REST)',
      'Float management',
      'Customer portfolio tools',
      'Custom fee structures',
      'Dedicated account manager',
      'Phone, chat & email support',
    ],
  },
];

const COMPARE_ROWS = [
  { feature: 'Virtual cards', personal: '1', pro: '5', business: 'Unlimited' },
  { feature: 'Supported currencies', personal: '3', pro: '50+', business: '50+' },
  { feature: 'Monthly transfer limit', personal: '$1,000', pro: 'Unlimited', business: 'Unlimited' },
  { feature: 'KYC verification', personal: 'Standard', pro: 'Priority', business: 'Priority' },
  { feature: 'Spending analytics', personal: false, pro: true, business: true },
  { feature: 'API access', personal: false, pro: false, business: true },
  { feature: 'Agent dashboard', personal: false, pro: false, business: true },
  { feature: 'Float management', personal: false, pro: false, business: true },
  { feature: 'Custom fee structures', personal: false, pro: false, business: true },
  { feature: 'Support', personal: 'Email', pro: 'Chat & email', business: 'Phone, chat & email' },
];

const FAQS = [
  {
    q: 'Is the Personal plan really free forever?',
    a: 'Yes. The Personal plan is free with no hidden charges. You pay nothing monthly and can use your wallet, make transfers up to $1,000/month, and redeem vouchers at no cost.',
  },
  {
    q: 'Can I upgrade or downgrade my plan anytime?',
    a: 'Absolutely. You can change your plan at any time from Settings. Upgrades take effect immediately; downgrades apply at the start of your next billing cycle.',
  },
  {
    q: 'What happens if I exceed my transfer limit on the Personal plan?',
    a: "You'll be prompted to upgrade to Pro before completing the transfer. Your wallet balance is not affected — the transfer simply won't process until you upgrade or your limit resets next month.",
  },
  {
    q: 'How does the Business plan agent dashboard work?',
    a: 'Business accounts get a full agent portal to issue cards, track commissions, manage float, and view analytics — built for operations at scale.',
  },
  {
    q: 'Is there a free trial for paid plans?',
    a: 'Pro includes a 14-day free trial — no credit card required. Business plans are custom-quoted; contact our sales team for a demo.',
  },
  {
    q: 'What payment methods do you accept for subscriptions?',
    a: 'You can pay with any ePay Smart wallet balance (USD, EUR, GBP), virtual card, or bank transfer. Crypto payments are coming soon.',
  },
];

/* ── Sub-components ──────────────────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border border-foreground/[0.07] rounded-xl overflow-hidden cursor-pointer"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <p className="text-foreground/80 font-medium text-sm">{q}</p>
        {open
          ? <ChevronUp className="w-4 h-4 text-foreground/30 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-foreground/30 flex-shrink-0" />}
      </div>
      {open && (
        <div className="px-5 pb-4 border-t border-foreground/[0.06]">
          <p className="text-foreground/45 text-xs sm:text-[0.8125rem] leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

function Cell({ val }: { val: string | boolean }) {
  if (val === true) return <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" />;
  if (val === false) return <span className="text-foreground/20 text-xs">—</span>;
  return <span className="text-foreground/65 text-xs sm:text-[0.8125rem]">{val}</span>;
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LandingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-10 text-center overflow-hidden">
        <div className="glow-orb w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] -top-20 left-1/2 -translate-x-1/2 bg-indigo-600 opacity-[0.09]" />

        <motion.div {...fadeUp()} className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-semibold mb-5">
            <Zap className="w-3 h-3" />
            Simple, transparent pricing
          </div>
          <h1 className="font-display font-bold text-foreground mb-4 leading-[1.08]
                         text-[1.875rem] sm:text-[2.375rem] lg:text-[2.875rem]">
            Pay for what you{' '}
            <span className="text-gradient">actually need</span>
          </h1>
          <p className="text-foreground/45 text-sm sm:text-[0.9375rem] leading-relaxed mb-8">
            Start free. Upgrade when you're ready. No hidden fees, no surprises.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-foreground/[0.04] border border-foreground/[0.08] rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${!annual ? 'bg-foreground text-background' : 'text-foreground/50 hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${annual ? 'bg-foreground text-background' : 'text-foreground/50 hover:text-foreground'}`}
            >
              Annual
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Plan cards ───────────────────────────────────────────────────────── */}
      <section className="pb-16 sm:pb-20 px-4 sm:px-6 lg:px-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              className={`relative rounded-2xl border p-6 flex flex-col ${plan.color} ${
                plan.highlight
                  ? 'bg-gradient-to-b from-indigo-600/10 to-purple-600/5'
                  : 'bg-foreground/[0.02]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`px-3.5 py-1 rounded-full text-[11px] font-bold text-foreground ${
                    plan.highlight ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-purple-600'
                  }`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <p className="text-foreground font-display font-bold text-base mb-1">{plan.name}</p>
                <p className="text-foreground/40 text-xs leading-relaxed">{plan.desc}</p>
              </div>

              <div className="mb-6">
                {plan.price.monthly === 0 ? (
                  <div>
                    <span className="font-display font-bold text-[2.25rem] text-foreground">Free</span>
                    <p className="text-foreground/30 text-xs mt-0.5">No credit card required</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-end gap-0.5">
                      <span className="text-foreground/40 text-base font-medium self-start mt-1.5">$</span>
                      <span className="font-display font-bold text-[2.25rem] text-foreground tabular-nums">
                        {annual ? plan.price.annual : plan.price.monthly}
                      </span>
                      <span className="text-foreground/30 text-xs mb-1">/mo</span>
                    </div>
                    {annual && (
                      <p className="text-emerald-400 text-[11px] font-medium mt-0.5">
                        Billed annually — ${(plan.price.annual * 12).toFixed(0)}/yr
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Link
                to="/auth/register"
                className={`flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm mb-6 transition-all duration-200 ${
                  plan.highlight
                    ? 'btn-brand'
                    : 'bg-foreground/[0.05] text-foreground border border-foreground/[0.09] hover:bg-foreground/[0.09]'
                }`}
              >
                {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <div className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/60 text-xs leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Compare table ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-10 bg-foreground/[0.01] border-y border-foreground/[0.05]">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="mb-10">
            <h2 className="font-display font-bold text-foreground mb-2 text-2xl sm:text-[1.875rem]">Full feature comparison</h2>
            <p className="text-foreground/40 text-sm">Everything side-by-side so you can pick the right fit.</p>
          </motion.div>

          <motion.div {...fadeUp(0.08)} className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-foreground/[0.08]">
                  <th className="text-left pb-3 text-foreground/35 text-xs font-medium w-1/2">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.name} className="pb-3 text-center">
                      <span className={`text-xs font-semibold ${p.highlight ? 'text-gradient' : 'text-foreground/60'}`}>{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-foreground/[0.04] ${i % 2 === 0 ? '' : 'bg-foreground/[0.01]'}`}>
                    <td className="py-3 text-foreground/55 text-xs sm:text-[0.8125rem]">{row.feature}</td>
                    <td className="py-3 text-center"><Cell val={row.personal} /></td>
                    <td className="py-3 text-center"><Cell val={row.pro} /></td>
                    <td className="py-3 text-center"><Cell val={row.business} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-16 px-4 sm:px-6 lg:px-10 max-w-4xl mx-auto">
        <motion.div {...fadeUp()} className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            { icon: Shield, title: 'Bank-grade security', desc: '256-bit AES encryption at rest and in transit' },
            { icon: CreditCard, title: 'Instant card issuance', desc: 'Virtual cards ready in under 60 seconds' },
            { icon: Globe, title: '50+ currencies', desc: 'Hold and transfer in any major global currency' },
            { icon: Star, title: '4.9★ average rating', desc: 'From 50,000+ verified user reviews' },
          ].map((item, i) => (
            <motion.div key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              className="text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-2.5">
                <item.icon className="w-5 h-5" />
              </div>
              <p className="text-foreground font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-foreground/35 text-[11px] leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Enterprise CTA ───────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-16 px-4 sm:px-6 lg:px-10">
        <motion.div
          {...fadeUp()}
          className="max-w-3xl mx-auto rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-600/10 to-indigo-600/5 p-8 sm:p-12 text-center"
        >
          <div className="flex items-center justify-center gap-2.5 mb-5">
            {[BarChart3, Users, Headphones].map((Icon, i) => (
              <div key={i} className="w-9 h-9 rounded-xl bg-foreground/[0.04] border border-foreground/[0.07] flex items-center justify-center text-purple-400">
                <Icon className="w-4 h-4" />
              </div>
            ))}
          </div>
          <h2 className="font-display font-bold text-foreground mb-3 text-2xl sm:text-[1.875rem]">
            Need a custom plan for your team?
          </h2>
          <p className="text-foreground/45 text-sm sm:text-[0.9375rem] leading-relaxed mb-7 max-w-xl mx-auto">
            Enterprise deals, white-label options, custom SLAs, dedicated infrastructure — talk to our team and we'll build the right package.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <Link to="/auth/register"
              className="btn-brand flex items-center justify-center gap-2 px-6 py-3 text-sm">
              Start free trial <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a href="mailto:sales@epaysmart.live"
              className="btn-ghost flex items-center justify-center gap-2 px-6 py-3 text-sm">
              Talk to sales
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-10 bg-foreground/[0.01] border-t border-foreground/[0.05]">
        <div className="max-w-2xl mx-auto">
          <motion.div {...fadeUp()} className="mb-10">
            <h2 className="font-display font-bold text-foreground mb-2 text-2xl sm:text-[1.875rem]">
              Frequently asked questions
            </h2>
            <p className="text-foreground/40 text-sm">Still unsure? Here are the questions we hear most.</p>
          </motion.div>

          <motion.div {...fadeUp(0.08)} className="space-y-2.5">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
