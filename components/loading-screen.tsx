"use client"

import { useEffect, useState } from "react"

export function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer)
          setTimeout(() => setIsComplete(true), 300)
          setTimeout(() => setIsHidden(true), 800)
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 50)

    return () => clearInterval(timer)
  }, [])

  if (isHidden) return null

  return (
    <div
      className={`fixed inset-0 z-[100] bg-foreground flex flex-col items-center justify-center transition-all duration-500 ${
        isComplete ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Logo */}
      <div className="mb-12">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-2 border-primary flex items-center justify-center mb-4">
            <span className="font-serif text-2xl text-primary">AI1</span>
          </div>
          <span className="text-xs tracking-[0.4em] text-background/50 uppercase">
            All In One
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-48 h-px bg-background/20 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-all duration-150 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Loading Text */}
      <div className="mt-8 flex items-center gap-2">
        <span className="text-xs tracking-[0.3em] text-background/40 uppercase">
          Loading Excellence
        </span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 bg-primary rounded-full animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
