"use client"

import { useEffect, useRef, useState, ReactNode } from "react"

type AnimationType = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale" | "blur"

interface ScrollRevealProps {
  children: ReactNode
  animation?: AnimationType
  delay?: number
  duration?: number
  threshold?: number
  className?: string
}

export function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  duration = 800,
  threshold = 0.1,
  className = "",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  const getAnimationStyles = () => {
    const baseStyles = {
      transition: `all ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    }

    if (!isVisible) {
      switch (animation) {
        case "fade-up":
          return { ...baseStyles, opacity: 0, transform: "translateY(40px)" }
        case "fade-in":
          return { ...baseStyles, opacity: 0 }
        case "slide-left":
          return { ...baseStyles, opacity: 0, transform: "translateX(-60px)" }
        case "slide-right":
          return { ...baseStyles, opacity: 0, transform: "translateX(60px)" }
        case "scale":
          return { ...baseStyles, opacity: 0, transform: "scale(0.9)" }
        case "blur":
          return { ...baseStyles, opacity: 0, filter: "blur(10px)" }
        default:
          return { ...baseStyles, opacity: 0 }
      }
    }

    return {
      ...baseStyles,
      opacity: 1,
      transform: "translateY(0) translateX(0) scale(1)",
      filter: "blur(0)",
    }
  }

  return (
    <div ref={ref} style={getAnimationStyles()} className={className}>
      {children}
    </div>
  )
}
