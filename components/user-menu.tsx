"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ChevronDown, LayoutDashboard, LogOut, User, Building2, Shield } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  if (!user) return null

  const portalHref = user.type === "admin" ? "/admin" : "/client-portal"
  const TypeIcon = user.type === "admin" ? Shield : user.type === "corporation" ? Building2 : User
  const typeLabel = user.type === "admin" ? "Administrator" : user.type === "corporation" ? "Corporate" : "Private Client"

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors group touch-target active-scale"
      >
        {/* Avatar */}
        <div className="w-9 h-9 bg-primary flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-sm text-primary-foreground leading-none">{user.name.charAt(0)}</span>
        </div>
        <div className="hidden xl:block text-left">
          <p className="text-xs font-medium text-foreground leading-tight">{user.name.split(" ")[0]}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{typeLabel}</p>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border shadow-xl z-50">
          {/* User info */}
          <div className="px-5 py-4 border-b border-border bg-secondary/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center flex-shrink-0">
                <span className="font-serif text-base text-primary-foreground">{user.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                {user.company && (
                  <p className="text-xs text-primary truncate">{user.company}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <TypeIcon size={11} className="text-primary" />
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{typeLabel}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-2">
            <Link
              href={portalHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors touch-target active-scale"
            >
              <LayoutDashboard size={16} className="text-primary" />
              {user.type === "admin" ? "Admin Dashboard" : "My Portal"}
            </Link>
            <Link
              href="/quote"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors touch-target active-scale"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              New Request
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-border py-2">
            <button
              onClick={() => { logout(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-target active-scale"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
