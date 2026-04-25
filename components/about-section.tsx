"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Award, Users, Shield, Leaf } from "lucide-react"

const values = [
  {
    icon: Shield,
    title: "Uncompromising Quality",
    description: "Every team member is background-checked, professionally trained, and committed to excellence.",
  },
  {
    icon: Users,
    title: "Personalized Service",
    description: "Dedicated project managers ensure seamless communication and tailored solutions for your needs.",
  },
  {
    icon: Leaf,
    title: "Sustainable Practices",
    description: "Eco-conscious operations with recycling programs and environmentally responsible disposal.",
  },
  {
    icon: Award,
    title: "Industry Recognition",
    description: "Multiple awards for service excellence and customer satisfaction in the Bay Area.",
  },
]

const certifications = [
  "Licensed & Bonded",
  "$2M Liability Insurance",
  "BBB A+ Rating",
  "AMSA ProMover Certified",
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 lg:py-32 bg-secondary relative">
      {/* Decorative Line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-primary/30 to-primary/10" />
      
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">Our Story</span>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-balance">
            Built on Trust, Driven by Excellence
          </h2>
          <p className="text-muted-foreground mt-6 text-lg leading-relaxed text-balance">
            Since 1996, All In One (AI1) has set the standard for premium home services. 
            What began as a commitment to doing things differently has grown into the Bay Area's 
            most trusted name in luxury moving, landscaping, and property care.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-24">
          {/* Left - Stacked Images */}
          <div className="lg:col-span-5 relative">
            <div className="relative">
              <div className="aspect-[4/5] relative overflow-hidden shadow-2xl">
                <Image
                  src="/images/delivery-person.jpg"
                  alt="Professional service excellence"
                  fill
                  className="object-cover"
                />
              </div>
              {/* Floating Card */}
              <div className="absolute -bottom-8 -right-8 lg:-right-12 w-48 lg:w-56 bg-background p-6 shadow-xl border border-border/50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 fill-primary text-primary" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="font-serif text-3xl">4.9/5</p>
                  <p className="text-sm text-muted-foreground">Average rating from 500+ verified reviews</p>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -left-6 w-32 h-32 border-2 border-primary/20 -z-10 hidden lg:block" />
          </div>

          {/* Right - Values */}
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-4">
              <span className="text-xs tracking-[0.2em] text-primary uppercase font-medium">What Sets Us Apart</span>
              <h3 className="font-serif text-3xl md:text-4xl tracking-tight text-balance">
                A Different Standard of Service
              </h3>
              <p className="text-muted-foreground leading-relaxed text-balance">
                We believe luxury isn't just about what we do—it's about how we do it. Every interaction, 
                every detail, every moment is an opportunity to exceed expectations.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <div key={index} className="space-y-3">
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center">
                    <value.icon className="text-primary" size={24} />
                  </div>
                  <h4 className="font-medium text-foreground text-lg">{value.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Certifications Bar */}
        <div className="border-t border-b border-border py-10">
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
            {certifications.map((cert, index) => (
              <div key={index} className="flex items-center gap-2 text-foreground">
                <CheckCircle2 size={18} className="text-primary" />
                <span className="text-sm tracking-wide">{cert}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Link
            href="#contact"
            className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground tracking-wide hover:bg-primary/90 transition-all duration-300 group"
          >
            Experience the Difference
            <ArrowRight
              size={18}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </section>
  )
}
