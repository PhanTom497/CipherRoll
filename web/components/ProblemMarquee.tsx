'use client';

import { ArrowUpRight } from "lucide-react";

type ProblemStory = {
  source: string;
  handle: string;
  title: string;
  excerpt: string;
  url: string;
  domain: string;
  logoUrl: string;
  accent: string;
  accentSoft: string;
};

const problemStories: ProblemStory[] = [
  {
    source: "Binance News",
    handle: "Mainstream barrier",
    title: "Public payroll transfers reveal exactly what each worker gets paid",
    excerpt:
      "Once payroll moves directly onchain, anyone watching can infer compensation patterns, treasury timing, and who the company pays.",
    url: "https://www.binance.com/sv/square/post/292150818088050",
    domain: "binance.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=binance.com&sz=64",
    accent: "text-amber-300",
    accentSoft: "from-amber-300/0 via-amber-300/45 to-amber-300/0"
  },
  {
    source: "Fhenix",
    handle: "Privacy PMF",
    title: "Transparent ledgers break payroll, treasury privacy, and supplier confidentiality",
    excerpt:
      "Public finance rails expose balances, payroll movement, and strategic cash behavior that companies never intended to make searchable.",
    url: "https://www.fhenix.io/blog/privacy-pmf-stories-e3-shielded-stablecoins-as-institutional-infrastructure",
    domain: "fhenix.io",
    logoUrl: "https://www.google.com/s2/favicons?domain=fhenix.io&sz=64",
    accent: "text-cyan-300",
    accentSoft: "from-cyan-300/0 via-cyan-300/40 to-cyan-300/0"
  },
  {
    source: "r/cscareerquestions",
    handle: "Workplace fallout",
    title: "A coworker learned one employee's salary and team trust collapsed",
    excerpt:
      "The post describes gossip, resentment, social exclusion, and fear around reviews after private compensation data leaked.",
    url: "https://www.reddit.com/r/cscareerquestions/comments/9d29vw/please_help_me_coworker_found_out_my_salary_and/",
    domain: "reddit.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
    accent: "text-rose-300",
    accentSoft: "from-rose-300/0 via-rose-300/40 to-rose-300/0"
  },
  {
    source: "r/managers",
    handle: "Management tension",
    title: "Managers end up containing the damage after salary oversharing",
    excerpt:
      "Even casual disclosure turns into a fairness, reporting, and trust issue that management has to clean up later.",
    url: "https://www.reddit.com/r/managers/comments/1rrv4ny/new_direct_report_sharing_his_salary/",
    domain: "reddit.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
    accent: "text-amber-300",
    accentSoft: "from-amber-300/0 via-amber-300/35 to-amber-300/0"
  },
  {
    source: "r/personalfinance",
    handle: "Pay secrecy",
    title: "Workers still struggle with what should stay private and what becomes leverage",
    excerpt:
      "Salary visibility is already sensitive. Removing consent from that disclosure makes the problem worse, not better.",
    url: "https://www.reddit.com/r/personalfinance/comments/olq8nk/pay_secrecy_in_the_workplace/",
    domain: "reddit.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
    accent: "text-violet-300",
    accentSoft: "from-violet-300/0 via-violet-300/38 to-violet-300/0"
  },
  {
    source: "r/Salary",
    handle: "Peer comparison",
    title: "Learning a coworker's pay can instantly change morale and self-worth",
    excerpt:
      "Compensation never lands neutrally. The moment it becomes visible, it shifts negotiation, confidence, and team dynamics.",
    url: "https://www.reddit.com/r/Salary/comments/1phts93/my_coworker_told_me_her_salary_and_now_i_feel/",
    domain: "reddit.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
    accent: "text-orange-300",
    accentSoft: "from-orange-300/0 via-orange-300/38 to-orange-300/0"
  },
  {
    source: "r/CryptoCurrency",
    handle: "Crypto payroll pain",
    title: "Paying salaries in crypto sounds easy until taxes, fees, and traceability hit",
    excerpt:
      "Crypto wages are fast, but public payment rails and repeated conversions quickly create privacy and compliance friction.",
    url: "https://www.reddit.com/r/CryptoCurrency/comments/pw9c4z/i_pay_some_of_my_employees_through_crypto_and/",
    domain: "reddit.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
    accent: "text-lime-300",
    accentSoft: "from-lime-300/0 via-lime-300/35 to-lime-300/0"
  },
  {
    source: "r/tifu",
    handle: "Accidental exposure",
    title: "Even unintended salary discovery can damage relationships at work",
    excerpt:
      "Once compensation becomes visible, the emotional and social cost lands on both the employee and the employer.",
    url: "https://www.reddit.com/r/tifu/comments/1shfptg/tifu_by_accidentally_learning_my_coworkers_salary/",
    domain: "reddit.com",
    logoUrl: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64",
    accent: "text-pink-300",
    accentSoft: "from-pink-300/0 via-pink-300/35 to-pink-300/0"
  }
];

function ProblemCard({ story }: { story: ProblemStory }) {
  return (
    <a
      href={story.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/card relative flex h-[200px] w-[296px] shrink-0 flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[#0b0b0b]/96 p-5 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-white/16 hover:bg-[#101010]"
    >
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${story.accentSoft} opacity-70`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_30%)] opacity-80" />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={story.logoUrl}
              alt={story.source}
              className="h-5 w-5 rounded-sm object-contain opacity-95"
            />
          </div>
          <div>
            <div className={`text-[11px] font-semibold ${story.accent}`}>{story.source}</div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/28">{story.handle}</div>
          </div>
        </div>

        <div className="rounded-lg border border-white/8 p-2 text-white/28 transition-colors duration-300 group-hover/card:text-white/72">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>

      <h3
        className="mb-2 overflow-hidden text-[16px] font-semibold leading-[1.18] tracking-[-0.03em] text-white transition-colors duration-300 group-hover/card:text-white/92"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical"
        }}
      >
        {story.title}
      </h3>

      <p
        className="mt-auto overflow-hidden text-[11px] leading-[1.55] text-white/40 transition-colors duration-300 group-hover/card:text-white/55"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical"
        }}
      >
        {story.excerpt}
      </p>
    </a>
  );
}

function ScrollRail({
  stories,
  animationClass
}: {
  stories: ProblemStory[];
  animationClass: string;
}) {
  const items = [...stories, ...stories];

  return (
    <div
      className="group overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 7%, black 93%, transparent)"
      }}
    >
      <div
        className={`flex w-max gap-5 px-1 ${animationClass} group-hover:[animation-play-state:paused]`}
      >
        {items.map((story, index) => (
          <ProblemCard key={`${story.title}-${index}`} story={story} />
        ))}
      </div>
    </div>
  );
}

export default function ProblemMarquee() {
  const firstRow = problemStories.slice(0, 4);
  const secondRow = problemStories.slice(4);

  return (
    <section className="relative z-10 overflow-hidden bg-black px-6 py-24 md:px-12 lg:px-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#ffffff_0.7px,transparent_0.7px)] [background-size:14px_14px]" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/40">
            The Problem
          </div>
          <div className="relative inline-block">
            <h2 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-[38px] lg:text-[44px]">
              Public Payroll <span className="italic text-white/78">Exposes People</span>
            </h2>
            <svg
              aria-hidden="true"
              viewBox="0 0 320 38"
              className="pointer-events-none absolute -bottom-5 right-0 h-6 w-[210px] opacity-80 md:w-[240px]"
            >
              <path
                d="M6 24 C62 8, 122 8, 178 20 S270 30, 314 14"
                fill="none"
                stroke="rgba(255,255,255,0.34)"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-[15px] leading-[1.85] text-white/42 md:text-[17px]">
            Salaries, treasury timing, and payment relationships should not become public just because a company wants programmable payroll.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <ScrollRail
              stories={firstRow}
              animationClass="animate-[cipherroll-problem-scroll_44s_linear_infinite]"
            />
          </div>

          <div>
            <ScrollRail
              stories={secondRow}
              animationClass="animate-[cipherroll-problem-scroll-reverse_48s_linear_infinite]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
