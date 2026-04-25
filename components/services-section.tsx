"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Check, ChevronRight } from "lucide-react"

const CATEGORIES = [
  { id: "private", label: "Private Residences" },
  { id: "corporate", label: "Corporate & Institutional" },
  { id: "all", label: "All Services" },
]

const services = [
  // ── PRIVATE ──────────────────────────────────────────────────
  {
    id: 1,
    category: "private",
    title: "White-Glove Relocation",
    subtitle: "Residential Moving",
    description:
      "Your home, your history, your heirlooms — moved with the reverence they deserve. Our master-certified crews handle every object as if it were irreplaceable, because to you, it is.",
    features: [
      "Custom hand-wrapped packing for all valuables",
      "Climate-controlled specialty transport",
      "Fine art, antique & piano specialists",
      "Full disassembly, reassembly & placement",
      "Same-day settling service available",
      "Up to $2M property coverage included",
    ],
    image: "/images/moving-service.jpg",
    tag: "Most Requested",
    audience: "private",
  },
  {
    id: 2,
    category: "private",
    title: "Fine Art & Valuables Handling",
    subtitle: "Specialty Transport",
    description:
      "Sculptures, paintings, wine collections, and statement furnishings transported under museum-grade protocols. Every piece catalogued, insured, and delivered flawlessly.",
    features: [
      "Museum-grade crating and packing",
      "Climate & humidity-controlled transport",
      "GPS-tracked vehicle monitoring",
      "White-glove installation on arrival",
      "Full provenance documentation",
      "International shipping coordination",
    ],
    image: "/images/fine-art-handling.jpg",
    tag: null,
    audience: "private",
  },
  {
    id: 3,
    category: "private",
    title: "Estate Landscaping",
    subtitle: "Curated Grounds Design",
    description:
      "A landscape that matches the stature of your property. From architectural planting schemes to year-round estate maintenance, we shape outdoor environments worthy of Architectural Digest.",
    features: [
      "Master landscape architect consultation",
      "Bespoke seasonal planting programmes",
      "Smart irrigation system installation",
      "Hardscape and water feature design",
      "Weekly & monthly estate maintenance",
      "Licensed, bonded horticulturists on staff",
    ],
    image: "/images/landscaping-service.jpg",
    tag: null,
    audience: "private",
  },
  {
    id: 4,
    category: "private",
    title: "Property Concierge",
    subtitle: "Complete Home Management",
    description:
      "One point of contact for every need your property demands. From emergency repairs to seasonal preparation and vendor coordination, we manage your home so you never have to.",
    features: [
      "Dedicated estate manager assigned",
      "24/7 emergency response line",
      "Vetted vendor network access",
      "Pre-arrival & post-departure service",
      "Seasonal property preparation",
      "Full vendor invoice management",
    ],
    image: "/images/concierge-services.jpg",
    tag: "Exclusive",
    audience: "private",
  },
  {
    id: 5,
    category: "private",
    title: "Surface & Exterior Restoration",
    subtitle: "Pressure Washing & Property Detailing",
    description:
      "Restore every surface of your estate to showroom condition. Driveways, stonework, decks, and facade — returned to their original splendour with precision cleaning technology.",
    features: [
      "Soft-wash & high-pressure systems",
      "Natural stone & pavers specialist",
      "Exterior facade deep cleaning",
      "Pool surrounds & outdoor entertaining areas",
      "Eco-certified, non-toxic solutions",
      "Bi-annual maintenance programmes",
    ],
    image: "/images/pressure-washing.jpg",
    tag: null,
    audience: "private",
  },
  {
    id: 6,
    category: "private",
    title: "Gutter & Roof Care",
    subtitle: "Preventive Property Protection",
    description:
      "Safeguard your investment against the silent threats of water damage. Comprehensive inspection, cleaning, and preventive maintenance keeps your estate protected season after season.",
    features: [
      "Full gutter system flush & inspection",
      "Downspout clearing & alignment",
      "Minor repair & sealant application",
      "Roof debris removal",
      "Post-storm emergency clearance",
      "Annual maintenance contracts available",
    ],
    image: "/images/gutter-cleaning.jpg",
    tag: null,
    audience: "private",
  },

  // ── CORPORATE ─────────────────────────────────────────────────
  {
    id: 7,
    category: "corporate",
    title: "Corporate Relocation",
    subtitle: "Office & Commercial Moving",
    description:
      "Enterprise-scale moves executed with zero operational disruption. From single-floor offices to multi-site campus relocations, our project managers ensure your business is fully operational from day one.",
    features: [
      "Dedicated corporate project manager",
      "After-hours & weekend scheduling",
      "IT infrastructure decommission & setup",
      "Workstation tagging & inventory system",
      "Confidential document handling protocols",
      "COI, bonding & compliance documentation",
    ],
    image: "/images/corporate-relocation.jpg",
    tag: "Corporate",
    audience: "corporate",
  },
  {
    id: 8,
    category: "corporate",
    title: "Executive Relocation Programme",
    subtitle: "C-Suite & Senior Leadership Moving",
    description:
      "Relocating top talent demands a flawless experience. Our executive programme provides white-glove, door-to-door relocation with personal coordination, discretion, and zero-compromise standards.",
    features: [
      "Personal relocation coordinator",
      "Private vehicle transport options",
      "Destination settling-in services",
      "Temporary furnished housing coordination",
      "Spouse & family support services",
      "Strict NDA and confidentiality standards",
    ],
    image: "/images/moving-service.jpg",
    tag: "Executive",
    audience: "corporate",
  },
  {
    id: 9,
    category: "corporate",
    title: "Facility Management Services",
    subtitle: "Commercial Grounds & Maintenance",
    description:
      "Keep your corporate campus, headquarters, or commercial property immaculate. Ongoing grounds maintenance, exterior cleaning, and reactive property services — all under one accountable partner.",
    features: [
      "Commercial landscaping & grounds keeping",
      "Exterior pressure washing programmes",
      "Gutter & drainage maintenance contracts",
      "Parking facility cleaning & maintenance",
      "Emergency storm response services",
      "Quarterly reporting & service reviews",
    ],
    image: "/images/estate-management.jpg",
    tag: null,
    audience: "corporate",
  },
  {
    id: 10,
    category: "corporate",
    title: "Debris & Site Clearance",
    subtitle: "Commercial Hauling",
    description:
      "Construction sites, office fit-outs, and commercial cleanouts handled with industrial capacity and complete discretion. We clear, dispose, and recycle responsibly — keeping your project on schedule.",
    features: [
      "Same-day & next-day capacity available",
      "Construction & renovation debris",
      "E-waste & secure data destruction",
      "Donation & recycling coordination",
      "LEED-compliant disposal documentation",
      "National account pricing available",
    ],
    image: "/images/hauling-service.jpg",
    tag: null,
    audience: "corporate",
  },
]

export function ServicesSection() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filtered =
    activeCategory === "all"
      ? services
      : services.filter((s) => s.category === activeCategory)

  return (
    <section id="services" className="py-24 lg:py-36 bg-background relative">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-14 lg:mb-20">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-px bg-primary" />
              <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">Services</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight text-balance leading-[1.05]">
              Crafted for Those Who<br className="hidden lg:block" /> Demand Excellence
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm mt-6 lg:mt-0 leading-relaxed">
            Comprehensive property and relocation services for discerning private clients and world-class organisations.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-0 mb-14 border-b border-border">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setExpandedId(null) }}
              className={`px-6 py-4 text-sm tracking-wide transition-all duration-200 border-b-2 -mb-px ${
                activeCategory === cat.id
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Services List */}
        <div className="divide-y divide-border border-t border-b border-border">
          {filtered.map((service, index) => {
            const isExpanded = expandedId === service.id
            return (
              <div
                key={service.id}
                className="group"
              >
                {/* Row — always visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : service.id)}
                  className="w-full grid grid-cols-[1fr_auto] lg:grid-cols-[80px_1fr_280px_auto] items-center gap-6 py-7 lg:py-8 text-left transition-colors duration-200 hover:bg-secondary/40 px-4 lg:px-6"
                  aria-expanded={isExpanded}
                >
                  {/* Index */}
                  <span className="hidden lg:block font-serif text-4xl text-muted-foreground/30 leading-none tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* Title block */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-serif text-xl lg:text-2xl text-foreground tracking-tight">
                        {service.title}
                      </h3>
                      {service.tag && (
                        <span className="text-[10px] tracking-[0.2em] uppercase border border-primary text-primary px-2.5 py-0.5">
                          {service.tag}
                        </span>
                      )}
                    </div>
                    <span className="text-xs tracking-widest text-muted-foreground uppercase">
                      {service.subtitle}
                    </span>
                  </div>

                  {/* Description preview — desktop only */}
                  <p className="hidden lg:block text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {service.description}
                  </p>

                  {/* Expand icon */}
                  <ChevronRight
                    size={18}
                    className={`text-primary flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>

                {/* Expanded Panel */}
                <div
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="grid lg:grid-cols-2 gap-0 border-t border-border">
                    {/* Image */}
                    <div className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[420px] overflow-hidden">
                      <Image
                        src={service.image}
                        alt={service.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-foreground/20" />
                      <div className="absolute bottom-6 left-6">
                        <span className="text-xs tracking-widest text-white/80 uppercase">{service.subtitle}</span>
                        <p className="font-serif text-2xl text-white mt-1">{service.title}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-col justify-between p-8 lg:p-12 bg-secondary/30">
                      <div>
                        <p className="text-muted-foreground leading-relaxed mb-8">
                          {service.description}
                        </p>

                        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase mb-5">
                          What&apos;s Included
                        </p>
                        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                          {service.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                              <Check size={14} className="text-primary mt-0.5 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-10 border-t border-border mt-10">
                        <Link
                          href="/quote"
                          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground text-sm tracking-widest uppercase hover:bg-primary/90 transition-all duration-300 group/btn"
                        >
                          Request a Proposal
                          <ArrowUpRight
                            size={15}
                            className="transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
                          />
                        </Link>
                        <Link
                          href="/#contact"
                          className="text-sm text-muted-foreground hover:text-foreground underline-reveal transition-colors duration-200"
                        >
                          Schedule a consultation
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-10 border-t border-border">
          <div>
            <p className="font-serif text-2xl text-foreground">Need something bespoke?</p>
            <p className="text-muted-foreground mt-1 text-sm">
              We design custom service programmes for estates, portfolios, and enterprise accounts.
            </p>
          </div>
          <Link
            href="/#contact"
            className="inline-flex items-center gap-2 px-8 py-4 border border-foreground text-foreground text-sm tracking-widest uppercase hover:bg-foreground hover:text-background transition-all duration-300 group/cta flex-shrink-0"
          >
            Speak with Our Team
            <ArrowUpRight size={15} className="transition-transform duration-300 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
          </Link>
        </div>

      </div>
    </section>
  )
}
