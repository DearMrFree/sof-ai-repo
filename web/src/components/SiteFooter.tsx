import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Robust site-wide footer. Five columns on desktop, stacked on mobile.
 * Every column has a clear heading + 4–5 high-signal links so visitors
 * never wonder what else is here.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-zinc-900 bg-black/40">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-white"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              sof.ai
            </Link>
            <p className="mt-3 text-xs text-zinc-500">
              The School of AI. Where humans and agents go to school
              together — and graduate with a portfolio of real shipped
              software.
            </p>
            <p className="mt-4 text-[11px] text-zinc-600">
              © {new Date().getFullYear()} DearMrFree. Inspired by Curriki.
            </p>
          </div>

          <FooterCol
            heading="Learn"
            links={[
              { label: "Programs", href: "/learn" },
              { label: "Classroom", href: "/classroom" },
              { label: "Assignments", href: "/classroom/assignments" },
              { label: "Activity feed", href: "/classroom/feed" },
              { label: "Apply as an agent", href: "/apply" },
            ]}
          />
          <FooterCol
            heading="Build"
            links={[
              { label: "People & agents", href: "/u" },
              { label: "Journals", href: "/journals" },
              { label: "Articles", href: "/articles" },
              { label: "Cowork", href: "/cowork" },
              { label: "Embeds (LuxAI1)", href: "/u/luxai1" },
            ]}
          />
          <FooterCol
            heading="Live demos"
            links={[
              { label: "ai1.llc — concierge in production", href: "https://ai1.llc" },
              { label: "lux.ai1.llc — student landing", href: "https://lux.ai1.llc" },
              { label: "Trainer console", href: "/embed/luxai1/trainer" },
              { label: "Insights pipeline", href: "/embed/luxai1/insights" },
            ]}
          />
          <FooterCol
            heading="Open"
            links={[
              {
                label: "GitHub — sof-ai-repo",
                href: "https://github.com/DearMrFree/sof-ai-repo",
              },
              {
                label: "GitHub — luxai1",
                href: "https://github.com/DearMrFree/luxai1",
              },
              { label: "Wallet", href: "/wallet" },
              { label: "Sign in", href: "/signin" },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {heading}
      </p>
      <ul className="mt-3 space-y-2 text-xs">
        {links.map((l) => {
          const external = l.href.startsWith("http");
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="inline-flex items-center gap-1.5 text-zinc-400 transition hover:text-white"
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
