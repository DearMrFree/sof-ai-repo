"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Building2, Users, Briefcase, Clock } from "lucide-react"

const corporateFeatures = [
  {
    icon: Building2,
    title: "Office Relocations",
    description: "Seamless transitions for offices of any size with minimal disruption to your operations.",
  },
  {
    icon: Users,
    title: "Executive Moving",
    description: "White-glove relocation services for C-suite executives and their families.",
  },
  {
    icon: Briefcase,
    title: "Corporate Accounts",
    description: "Dedicated account management with preferred pricing and priority scheduling.",
  },
  {
    icon: Clock,
    title: "After-Hours Service",
    description: "Flexible scheduling including evenings and weekends to minimize business impact.",
  },
]

export function CorporateSection() {
  return (
    <section className="py-24 lg:py-32 bg-card relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 left-0 w-1/3 h-full bg-secondary/30" />
      
      <div className="container mx-auto px-6 relative">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left - Image Grid */}
          <div className="relative">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-7 aspect-[3/4] relative overflow-hidden shadow-2xl">
                <Image
                  src="/images/hero-workers.jpg"
                  alt="Corporate relocation team"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="col-span-5 space-y-4 pt-16">
                <div className="aspect-square relative overflow-hidden shadow-xl">
                  <Image
                    src="/images/moving-service.jpg"
                    alt="Professional moving"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="aspect-square relative overflow-hidden bg-primary flex items-center justify-center">
                  <div className="text-center p-6">
                    <span className="font-serif text-4xl lg:text-5xl text-primary-foreground">8+</span>
                    <p className="text-primary-foreground/80 text-sm mt-2">Years Serving<br/>Corporate Clients</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative Frame */}
            <div className="absolute -bottom-6 -right-6 w-48 h-48 border-2 border-primary/20 -z-10 hidden lg:block" />
          </div>

          {/* Right - Content */}
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">Corporate Services</span>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-5xl tracking-tight text-balance">
                Enterprise-Grade Solutions for Discerning Businesses
              </h2>
              <p className="text-muted-foreground leading-relaxed text-lg text-balance">
                From Fortune 500 headquarters to boutique firms, we deliver corporate relocation 
                and property services with the professionalism your business demands.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {corporateFeatures.map((feature, index) => (
                <div key={index} className="group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary transition-colors duration-300">
                      <feature.icon className="text-primary group-hover:text-primary-foreground transition-colors duration-300" size={22} />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="#contact"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground tracking-wide hover:bg-primary/90 transition-all duration-300 group"
              >
                Request Corporate Quote
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="tel:4088728340"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-foreground/20 text-foreground tracking-wide hover:bg-foreground hover:text-background transition-all duration-300"
              >
                Call (408) 872-8340
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
