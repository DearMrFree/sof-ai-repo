"use client"

import { Award, Trophy, Medal, Star, Crown, Gem } from "lucide-react"

const awards = [
  {
    year: "2025",
    title: "Best Moving Company",
    organization: "Bay Area Business Awards",
    icon: Trophy,
  },
  {
    year: "2024",
    title: "Excellence in Customer Service",
    organization: "National Home Services Association",
    icon: Medal,
  },
  {
    year: "2024",
    title: "Top Rated Landscaping",
    organization: "Silicon Valley Magazine",
    icon: Star,
  },
  {
    year: "2023",
    title: "Green Business Certification",
    organization: "California EPA",
    icon: Gem,
  },
  {
    year: "2023",
    title: "Luxury Service Provider",
    organization: "Forbes Home",
    icon: Crown,
  },
  {
    year: "2022",
    title: "Best of the Bay",
    organization: "SF Chronicle Readers Choice",
    icon: Award,
  },
]

const pressLogos = [
  { name: "Forbes", className: "text-2xl font-serif" },
  { name: "WSJ", className: "text-xl font-bold tracking-tighter" },
  { name: "Bloomberg", className: "text-lg font-medium" },
  { name: "TechCrunch", className: "text-lg font-bold" },
  { name: "Mercury News", className: "text-base font-medium" },
]

export function AwardsSection() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="container mx-auto px-6 relative">
        {/* Section Header */}
        <div className="text-center mb-20">
          <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">
            Recognition
          </span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-balance">
            Award-Winning Excellence
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mt-6 text-lg text-balance">
            Our commitment to exceptional service has been recognized by industry leaders and
            publications across the nation.
          </p>
        </div>

        {/* Awards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-24">
          {awards.map((award, index) => (
            <div
              key={index}
              className="group p-8 bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 relative overflow-hidden"
            >
              {/* Year Badge */}
              <div className="absolute top-4 right-4">
                <span className="text-xs tracking-widest text-muted-foreground">
                  {award.year}
                </span>
              </div>

              {/* Icon */}
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                <award.icon className="text-primary" size={28} />
              </div>

              {/* Content */}
              <h3 className="font-serif text-xl lg:text-2xl text-foreground mb-2">
                {award.title}
              </h3>
              <p className="text-sm text-muted-foreground">{award.organization}</p>

              {/* Hover Effect Line */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </div>
          ))}
        </div>

        {/* Press Section */}
        <div className="border-t border-border pt-16">
          <p className="text-center text-sm text-muted-foreground tracking-widest uppercase mb-10">
            As Featured In
          </p>
          <div className="flex flex-wrap justify-center items-center gap-10 lg:gap-16">
            {pressLogos.map((logo, index) => (
              <div
                key={index}
                className={`text-muted-foreground/40 hover:text-foreground transition-colors duration-300 cursor-default ${logo.className}`}
              >
                {logo.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
