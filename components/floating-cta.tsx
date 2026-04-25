"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"

export function FloatingCTA() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 600
      setVisible(shouldShow)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  if (dismissed || !visible) return null

  return (
    <div 
      className={`fixed z-40 animate-fade-in-up safe-bottom ${
        isMobile 
          ? "bottom-4 left-4 right-auto" 
          : "bottom-6 right-24"
      }`}
    >
      <div className="relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-2 -right-2 w-7 h-7 sm:w-6 sm:h-6 bg-background border border-border rounded-full flex items-center justify-center hover:bg-muted transition-colors shadow-sm touch-target active-scale"
          aria-label="Dismiss"
        >
          <X size={14} className="text-muted-foreground" />
        </button>
        
        <Link
          href="/quote"
          className={`flex items-center gap-2 sm:gap-3 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-300 group active-scale ${
            isMobile 
              ? "px-4 py-3 text-sm" 
              : "px-6 py-4"
          }`}
        >
          <span className="font-medium">Get Quote</span>
          <ArrowRight
            size={isMobile ? 16 : 18}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      </div>
    </div>
  )
}
