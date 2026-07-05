import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Globe, Shield, Zap, Heart,
  TrendingUp, Users, Award, Target,
} from 'lucide-react';
import { LandingNav } from '../../components/landing/LandingNav';
import { LandingFooter } from '../../components/landing/LandingFooter';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay },
});

const VALUES = [
  {
    icon: Shield,
    title: 'Trust, above all',
    desc: 'Every feature we ship starts with one question: does this make our users more financially secure? We never compromise on safety or compliance.',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Globe,
    title: 'Borderless by design',
    desc: 'Financial borders are a legacy problem. We build for a world where your geography doesn\'t determine your access to great financial tools.',
    color: 'from-cyan-500/20 to-violet-500/20',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  {
    icon: Zap,
    title: 'Speed as respect',
    desc: 'Making someone wait for their money is a form of disrespect. We engineer for instant — instant transfers, instant cards, instant support.',
    color: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: Heart,
    title: 'Radical simplicity',
    desc: 'Finance can be complex under the hood and beautifully simple on the surface. We sweat the details so you never have to.',
    color: 'from-rose-500/20 to-pink-500/20',
    border: 'border-rose-500/20',
    iconColor: 'text-rose-400',
  },
];

const MILESTONES = [
  {
    year: '2021',
    title: 'The idea',
    desc: 'Two engineers in Harare, frustrated by wire transfer fees eating 15% of every payment, decided to build the solution they\'d always wanted.',
  },
  {
    year: '2022',
    title: 'Private beta',
    desc: 'Launched to 500 invite-only users across Zimbabwe, Nigeria, and South Africa. Processed $2M in first-month volume — 6× our forecast.',
  },
  {
    year: '2023',
    title: 'Series A',
    desc: 'Raised $18M led by a Pan-African fintech fund. Expanded to 12 countries, launched virtual card issuance, and onboarded our first agent partners.',
  },
  {
    year: '2024',
    title: '1 million users',
    desc: 'Crossed 1M registered users. Launched the agent platform, multi-currency wallets, and gift voucher ecosystem. Processed $1B cumulative volume.',
  },
  {
    year: '2025',
    title: 'Global expansion',
    desc: 'Added European and Asian markets. Partnered with Visa and Mastercard for enhanced card programs. Launched real-time FX for 50+ currency pairs.',
  },
  {
    year: '2026',
    title: 'Today',
    desc: 'Over 2 million active users. $4B+ processed. Building the infrastructure for the next generation of African fintech.',
  },
];

const TEAM = [
  { name: 'Takudzwa Moyo', role: 'CEO & Co-founder', avatar: 'T', color: 'bg-violet-600', detail: 'Former VP Engineering at a Johannesburg payments startup. MSc Computer Science, University of Cape Town.' },
  { name: 'Amara Osei', role: 'CTO & Co-founder', avatar: 'A', color: 'bg-purple-600', detail: 'Led infrastructure at a Lagos-based e-commerce unicorn. 12 years building distributed financial systems.' },
  { name: 'Sade Adeyemi', role: 'Chief Product Officer', avatar: 'S', color: 'bg-emerald-600', detail: 'Previously Product Director at a Nairobi mobile money platform. Passionate about fintech UX for emerging markets.' },
  { name: 'Priya Nair', role: 'Chief Risk Officer', avatar: 'P', color: 'bg-rose-600', detail: 'Former Head of Compliance at a UK challenger bank. Expert in AML, KYC, and cross-border regulatory frameworks.' },
  { name: 'David Mwangi', role: 'VP of Growth', avatar: 'D', color: 'bg-amber-600', detail: 'Built and scaled agent networks across East Africa. Grew three fintech products from zero to $100M ARR.' },
  { name: 'Yuki Tanaka', role: 'Head of Security', avatar: 'Y', color: 'bg-cyan-600', detail: 'Former security researcher at a major global bank. Specialises in payment system threat modelling and fraud prevention.' },
];

const STATS = [
  { icon: Users, value: '2M+', label: 'Active users', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { icon: TrendingUp, value: '$4B+', label: 'Volume processed', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { icon: Globe, value: '30+', label: 'Countries served', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { icon: Award, value: '4.9★', label: 'Average user rating', color: 'text-amber-400', bg: 'bg-amber-500/10' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LandingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-28 px-6 lg:px-12 text-center overflow-hidden">
        <div className="glow-orb w-[600px] h-[600px] -top-40 left-1/2 -translate-x-1/2 bg-violet-600 opacity-[0.09]" />
        <div className="glow-orb w-[400px] h-[400px] top-20 -right-20 bg-purple-600 opacity-[0.07]" />

        <motion.div {...fadeUp()} className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-6">
            <Target className="w-3 h-3" />
            Our mission
          </div>
          <h1 className="font-display font-bold text-5xl lg:text-6xl xl:text-7xl text-foreground mb-6 leading-[1.05]">
            We exist to make money{' '}
            <span className="text-gradient">move freely</span>
          </h1>
          <p className="text-foreground/45 text-xl leading-relaxed max-w-2xl mx-auto">
            Financial access is a human right. We're building the infrastructure that makes it real —
            for freelancers, traders, agents, and families across Africa and beyond.
          </p>
        </motion.div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 lg:px-12 border-y border-foreground/[0.06] bg-foreground/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div key={s.label} {...fadeUp(i * 0.08)} className="text-center">
              <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center mx-auto mb-3`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <p className={`font-display font-bold text-4xl mb-1 ${s.color}`}>{s.value}</p>
              <p className="text-foreground/40 text-sm">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Story ────────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div {...fadeUp()}>
            <p className="text-violet-400 font-semibold text-sm uppercase tracking-widest mb-4">Our story</p>
            <h2 className="font-display font-bold text-4xl lg:text-5xl text-foreground leading-tight mb-6">
              Born out of frustration. Built with purpose.
            </h2>
            <div className="space-y-5 text-foreground/50 text-base leading-relaxed">
              <p>
                It started with a single $500 payment. Takudzwa, one of our co-founders, was trying to pay
                a freelancer in Lagos for web design work. Three days, two failed wire transfers, and $75 in
                fees later — the freelancer still didn't have their money.
              </p>
              <p>
                That moment crystallised everything. Africa's 1.4 billion people were being served by
                infrastructure built in the 1970s. The fees were extractive, the delays were insulting,
                and the experience was broken. Nobody was building the modern layer.
              </p>
              <p>
                So we did. ePay Smart is the platform we wish had existed — instant, affordable, and built
                specifically for how people in our part of the world actually move money.
              </p>
            </div>
          </motion.div>

          {/* Decorative card stack */}
          <motion.div {...fadeUp(0.12)} className="relative h-72 flex items-center justify-center">
            <div className="glow-orb w-72 h-72 bg-violet-600 opacity-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="glass-card p-6 w-72 absolute rotate-[-4deg] top-4 left-8 border border-violet-500/20">
              <p className="text-foreground/40 text-xs mb-2">2021 — Harare, Zimbabwe</p>
              <p className="text-foreground font-medium text-sm">"What if sending money felt like sending a message?"</p>
            </div>
            <div className="glass-card p-6 w-72 absolute rotate-[3deg] top-12 left-16 border border-purple-500/20 bg-gradient-to-br from-purple-600/10 to-violet-600/5">
              <p className="text-foreground/40 text-xs mb-2">2024 — 1 million users</p>
              <p className="text-foreground font-medium text-sm">"We processed $1B in volume. The mission is working."</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-12 bg-foreground/[0.01] border-y border-foreground/[0.05]">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-purple-400 font-semibold text-sm uppercase tracking-widest mb-3">What we stand for</p>
            <h2 className="font-display font-bold text-4xl lg:text-5xl text-foreground mb-4">Our values</h2>
            <p className="text-foreground/40 text-lg max-w-xl mx-auto">
              These aren't words on a wall. They're decisions we make every day.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: 1.02, y: -4 }}
                className={`glass-card p-7 border ${v.border} bg-gradient-to-br ${v.color} cursor-default`}
              >
                <div className={`w-11 h-11 rounded-xl bg-foreground/5 flex items-center justify-center mb-5 ${v.iconColor}`}>
                  <v.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-xl mb-3">{v.title}</h3>
                <p className="text-foreground/50 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-12 max-w-5xl mx-auto">
        <motion.div {...fadeUp()} className="text-center mb-16">
          <p className="text-cyan-400 font-semibold text-sm uppercase tracking-widest mb-3">The journey</p>
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-foreground mb-4">Where we've been</h2>
          <p className="text-foreground/40 text-lg">Five years of building, one milestone at a time.</p>
        </motion.div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[22px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/30 via-purple-500/30 to-indigo-500/10 hidden sm:block" />

          <div className="space-y-10">
            {MILESTONES.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-6 sm:gap-8"
              >
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center z-10">
                    <span className="text-foreground font-bold text-[10px]">{m.year}</span>
                  </div>
                </div>
                <div className="pb-2">
                  <p className="text-foreground font-display font-semibold text-lg mb-1">{m.title}</p>
                  <p className="text-foreground/45 text-sm leading-relaxed">{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-12 bg-foreground/[0.01] border-y border-foreground/[0.05]">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-3">The people</p>
            <h2 className="font-display font-bold text-4xl lg:text-5xl text-foreground mb-4">Meet the team</h2>
            <p className="text-foreground/40 text-lg max-w-xl mx-auto">
              Builders, operators, and thinkers united by one mission: financial access for everyone.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEAM.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="glass-card p-6 cursor-default"
              >
                <div className={`w-14 h-14 rounded-2xl ${member.color} flex items-center justify-center text-foreground font-bold text-xl mb-4`}>
                  {member.avatar}
                </div>
                <p className="text-foreground font-display font-semibold text-lg">{member.name}</p>
                <p className="text-violet-400 text-sm font-medium mb-3">{member.role}</p>
                <p className="text-foreground/40 text-xs leading-relaxed">{member.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Join us CTA ──────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-purple-600/5 p-10 lg:p-16 text-center overflow-hidden">
            <div className="glow-orb w-80 h-80 bg-violet-600 opacity-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            <motion.div {...fadeUp()} className="relative">
              <h2 className="font-display font-bold text-4xl lg:text-5xl text-foreground mb-5 leading-tight">
                Join us on the mission
              </h2>
              <p className="text-foreground/45 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
                Whether you're signing up as a user, becoming an agent, or joining our team —
                there's a place for you in the ePay Smart story.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/auth/register"
                  className="btn-brand flex items-center justify-center gap-2 px-10 py-4 text-base">
                  Open a free account <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="/#how-it-works"
                  className="btn-ghost flex items-center justify-center gap-2 px-10 py-4 text-base">
                  How it works
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
