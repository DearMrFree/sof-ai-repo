"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Star, Shield, Clock, Award, ChevronDown } from "lucide-react"

const trustBadges = [
  { icon: Shield, label: "Fully Insured" },
  { icon: Award, label: "5-Star Rated" },
  { icon: Clock, label: "Same-Day Service" },
]

export function HeroSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <section id="home" className="min-h-screen mobile-full-height relative overflow-hidden grain-overlay">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-secondary/50" />
        <div 
          className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl transition-transform duration-1000 ease-out" 
          style={{ transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)` }}
        />
        <div 
          className="absolute top-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-2xl transition-transform duration-1000 ease-out" 
          style={{ transform: `translate(${-mousePosition.x}px, ${-mousePosition.y}px)` }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20 lg:pt-40 lg:pb-28 relative">
        {/* Top Trust Bar - Horizontally scrollable on mobile */}
        <div className="mb-8 sm:mb-12 lg:mb-16 opacity-0 animate-fade-in -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 overflow-x-auto scrollbar-hide scroll-touch sm:flex-wrap sm:justify-center lg:justify-start pb-2 sm:pb-0">
            {trustBadges.map((badge, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
                <badge.icon size={16} className="text-primary" />
                <span className="text-xs sm:text-sm tracking-wide whitespace-nowrap">{badge.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={12} className="fill-primary text-primary" />
              ))}
              <span className="text-xs sm:text-sm text-muted-foreground ml-2 whitespace-nowrap">500+ Reviews</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          {/* Left Column - Text */}
          <div className="lg:col-span-4 space-y-8 opacity-0 animate-fade-in-up">
            <div className="space-y-4">
              <span className="inline-block text-xs tracking-[0.25em] text-primary uppercase font-medium bg-primary/10 px-4 py-2">
                Est. 1996 | Bay Area
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[1.05] tracking-tight">
                <span className="text-balance">Luxury at Your Doorstep</span>
              </h1>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-md text-lg text-balance">
              Where white-glove service meets uncompromising excellence. Trusted by Fortune 500 executives and discerning homeowners throughout the Bay Area.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center gap-3 px-6 sm:px-8 py-4 bg-primary text-primary-foreground tracking-wide hover:bg-primary/90 transition-all duration-300 group touch-target active-scale"
              >
                Get Your Proposal
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="#services"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-4 border border-foreground/20 text-foreground tracking-wide hover:bg-foreground hover:text-background transition-all duration-300 touch-target active-scale"
              >
                Explore Services
              </Link>
            </div>
          </div>

          {/* Center Column - Main Image */}
          <div className="lg:col-span-4 opacity-0 animate-fade-in-up animation-delay-200">
            <div className="relative aspect-[3/4] lg:aspect-[3/4] overflow-hidden shadow-2xl">
              <Image
                src="/images/hero-workers.jpg"
                alt="Professional workers inspecting luxury renovation"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent" />
              {/* Floating Badge */}
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 bg-background/95 backdrop-blur-sm p-3 sm:p-4 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Clients</p>
                    <p className="font-serif text-base sm:text-lg">2,500+</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-border" />
                  <div className="text-center flex-1">
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Since</p>
                    <p className="font-serif text-base sm:text-lg">1996</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-border" />
                  <div className="text-center flex-1">
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Rating</p>
                    <p className="font-serif text-base sm:text-lg">4.9/5</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Description + Image */}
          <div className="lg:col-span-4 space-y-6 opacity-0 animate-slide-in-right animation-delay-300">
            <div className="bg-card p-6 lg:p-8 border border-border/50 space-y-4">
              <span className="text-xs tracking-[0.2em] text-primary uppercase font-medium">Our Promise</span>
              <p className="text-foreground leading-relaxed text-balance">
                At All In One (AI1), we deliver an experience that transcends ordinary service. Every detail is orchestrated with precision, every interaction handled with care.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Background-checked professionals
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  $2M liability coverage
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  100% satisfaction guarantee
                </li>
              </ul>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden shadow-xl hidden lg:block">
              <Image
                src="/images/delivery-person.jpg"
                alt="Professional delivery service"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Scrolling Marquee */}
      <div className="absolute bottom-0 left-0 right-0 bg-foreground py-5 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 mx-6">
              <span className="text-sm tracking-[0.3em] text-background/70 uppercase">Moving</span>
              <span className="text-primary/70 text-xs">&#9670;</span>
              <span className="text-sm tracking-[0.3em] text-background/70 uppercase">Landscaping</span>
              <span className="text-primary/70 text-xs">&#9670;</span>
              <span className="text-sm tracking-[0.3em] text-background/70 uppercase">Hauling</span>
              <span className="text-primary/70 text-xs">&#9670;</span>
              <span className="text-sm tracking-[0.3em] text-background/70 uppercase">Gutter Cleaning</span>
              <span className="text-primary/70 text-xs">&#9670;</span>
              <span className="text-sm tracking-[0.3em] text-background/70 uppercase">Estate Services</span>
              <span className="text-primary/70 text-xs">&#9670;</span>
              <span className="text-sm tracking-[0.3em] text-background/70 uppercase">Corporate Relocation</span>
              <span className="text-primary/70 text-xs">&#9670;</span>
            </div>
          ))}
        </div>
      </div>

            {/* Scroll Indicator */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 z-10">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">Scroll to explore</span>
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-1">
          <div className="w-1.5 h-3 bg-primary rounded-full animate-bounce" />
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.33%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </section>
  )
}
