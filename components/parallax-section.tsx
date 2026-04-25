"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"

export function ParallaxSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        const scrollProgress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
        setOffset(scrollProgress * 100)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <section ref={ref} className="relative h-[80vh] lg:h-screen overflow-hidden">
      {/* Parallax Background */}
      <div
        className="absolute inset-0 w-full h-[120%]"
        style={{ transform: `translateY(${-offset * 0.2}px)` }}
      >
        <Image
          src="/images/hero-workers.jpg"
          alt="Premium service excellence"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-foreground/70" />
      </div>

      {/* Content */}
      <div className="relative h-full flex items-center justify-center">
        <div className="container mx-auto px-6 text-center">
          <span className="inline-block text-xs tracking-[0.3em] text-primary uppercase font-medium bg-background/10 backdrop-blur-sm px-6 py-3 mb-8">
            Experience The Difference
          </span>

          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-background max-w-4xl mx-auto leading-tight text-balance">
            Where Precision Meets Luxury
          </h2>

          <p className="text-background/80 max-w-2xl mx-auto mt-8 text-lg lg:text-xl text-balance">
            Every project is an opportunity to exceed expectations. Discover why the Bay Area&apos;s
            most discerning clients trust AI1 for their home service needs.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link
              href="/quote"
              className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground tracking-wide hover:bg-primary/90 transition-all duration-300 group"
            >
              Get Started Today
              <ArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>

            <button className="inline-flex items-center gap-3 px-8 py-4 border border-background/30 text-background tracking-wide hover:bg-background/10 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-full border border-background/50 flex items-center justify-center group-hover:bg-background/10 transition-colors duration-300">
                <Play size={16} className="ml-0.5" />
              </div>
              Watch Our Story
            </button>
          </div>

          {/* Floating Stats */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-12 bg-background/10 backdrop-blur-md px-10 py-6 border border-background/10">
            <div className="text-center">
              <p className="font-serif text-3xl text-background">30+</p>
              <p className="text-xs text-background/60 tracking-widest uppercase mt-1">Years</p>
            </div>
            <div className="w-px h-10 bg-background/20" />
            <div className="text-center">
              <p className="font-serif text-3xl text-background">2,500+</p>
              <p className="text-xs text-background/60 tracking-widest uppercase mt-1">Clients</p>
            </div>
            <div className="w-px h-10 bg-background/20" />
            <div className="text-center">
              <p className="font-serif text-3xl text-background">12</p>
              <p className="text-xs text-background/60 tracking-widest uppercase mt-1">Countries</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
