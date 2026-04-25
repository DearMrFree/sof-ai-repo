"use client"

import { useEffect, useRef, useState } from "react"

const stats = [
  { value: 2500, suffix: "+", label: "Satisfied Clients", description: "Homeowners and businesses served" },
  { value: 98, suffix: "%", label: "Client Retention", description: "Clients who return year after year" },
  { value: 15, suffix: "M+", prefix: "$", label: "Property Value Handled", description: "In belongings safely moved" },
  { value: 24, suffix: "hr", label: "Response Time", description: "Average quote delivery" },
]

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          const duration = 2000
          const steps = 60
          const increment = value / steps
          let current = 0
          const timer = setInterval(() => {
            current += increment
            if (current >= value) {
              setCount(value)
              clearInterval(timer)
            } else {
              setCount(Math.floor(current))
            }
          }, duration / steps)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [value, hasAnimated])

  return (
    <div ref={ref} className="font-serif text-5xl lg:text-6xl xl:text-7xl text-background">
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  )
}

export function StatsSection() {
  return (
    <section className="py-20 lg:py-28 bg-foreground text-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      <div className="container mx-auto px-6 relative">
        <div className="text-center mb-16">
          <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">The Numbers</span>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl mt-4 tracking-tight text-background text-balance">
            A Track Record of Excellence
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="text-center p-8 lg:p-6 relative group"
            >
              {index !== stats.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-20 bg-background/20" />
              )}
              <AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              <p className="font-medium text-background mt-3 tracking-wide">{stat.label}</p>
              <p className="text-sm text-background/60 mt-1">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
