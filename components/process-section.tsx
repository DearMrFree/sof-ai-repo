"use client"

import { Phone, ClipboardCheck, Calendar, Sparkles } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Phone,
    title: "Initial Consultation",
    description:
      "Connect with our concierge team for a personalized assessment of your needs. We listen carefully to understand your requirements and timeline.",
    accent: "Schedule a call or request a callback at your convenience.",
  },
  {
    number: "02",
    icon: ClipboardCheck,
    title: "Custom Proposal",
    description:
      "Receive a detailed, transparent proposal tailored to your specific needs. No hidden fees, no surprises—just clear pricing and comprehensive service details.",
    accent: "Proposals delivered within 24 hours.",
  },
  {
    number: "03",
    icon: Calendar,
    title: "Scheduled Service",
    description:
      "Your dedicated project manager coordinates every detail. From arrival time to completion, expect seamless communication throughout the process.",
    accent: "Real-time updates via SMS or email.",
  },
  {
    number: "04",
    icon: Sparkles,
    title: "Exceptional Results",
    description:
      "Experience the AI1 difference. Our post-service walkthrough ensures your complete satisfaction before we consider the job complete.",
    accent: "100% satisfaction guarantee.",
  },
]

export function ProcessSection() {
  return (
    <section className="py-24 lg:py-32 bg-card relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">
            How It Works
          </span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-balance">
            A Seamless Experience
          </h2>
          <p className="text-muted-foreground mt-6 text-lg text-balance">
            From your first inquiry to project completion, every step is designed for your
            convenience and peace of mind.
          </p>
        </div>

        {/* Process Timeline */}
        <div className="relative">
          {/* Connecting Line - Desktop */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-px bg-border" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative group">
                {/* Step Number & Icon */}
                <div className="relative mb-8">
                  <div className="w-20 h-20 bg-background border-2 border-border group-hover:border-primary transition-colors duration-300 flex items-center justify-center mx-auto lg:mx-0 relative z-10">
                    <step.icon
                      className="text-primary group-hover:scale-110 transition-transform duration-300"
                      size={32}
                    />
                  </div>
                  {/* Step Number */}
                  <span className="absolute -top-3 -right-3 lg:right-auto lg:-left-3 w-8 h-8 bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="text-center lg:text-left">
                  <h3 className="font-serif text-2xl text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4 text-balance">
                    {step.description}
                  </p>
                  <p className="text-sm text-primary font-medium">{step.accent}</p>
                </div>

                {/* Arrow for desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-24 -right-3 transform translate-x-1/2 z-20">
                    <div className="w-6 h-6 bg-background border-2 border-border rotate-45 border-l-0 border-b-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
