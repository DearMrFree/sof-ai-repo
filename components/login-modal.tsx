"use client"

import { useState, useEffect, useRef } from "react"
import { X, ArrowRight, User, Building2, Shield, ChevronRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

const INDIVIDUAL_ACCOUNTS = [
  { email: "john@example.com",           name: "John Harrington",        detail: "Private Residence" },
  { email: "sarah@example.com",          name: "Sarah Chen",             detail: "Private Residence" },
  { email: "michael@example.com",        name: "Michael Thompson",       detail: "Private Residence" },
]
const CORPORATE_ACCOUNTS = [
  { email: "contact@techventures.com",   name: "Alex Rodriguez",         detail: "Tech Ventures Inc." },
  { email: "facilities@globalbiz.com",   name: "Jennifer Williams",      detail: "Global Business Solutions" },
  { email: "admin@innovation.com",       name: "David Park",             detail: "Innovation Labs" },
]
const ADMIN_ACCOUNTS = [
  { email: "admin@ai1.com",             name: "Admin User",              detail: "Administrator" },
  { email: "support@ai1.com",           name: "Support Manager",         detail: "Administrator" },
]

export function LoginModal() {
  const { isLoginOpen, closeLogin, login } = useAuth()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"individual" | "corporate" | "admin">("individual")
  const [isMobile, setIsMobile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (isLoginOpen) {
      setEmail("")
      setError("")
      if (!isMobile) {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }
  }, [isLoginOpen, isMobile])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogin()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [closeLogin])

  useEffect(() => {
    document.body.style.overflow = isLoginOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isLoginOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const success = login(email.trim().toLowerCase())
    if (!success) {
      setError("We couldn't find an account with that email address.")
      return
    }
    const found = email.trim().toLowerCase()
    if (found.includes("@ai1.com")) router.push("/admin")
    else router.push("/client-portal")
  }

  const handleQuickLogin = (quickEmail: string) => {
    const success = login(quickEmail)
    if (success) {
      if (quickEmail.includes("@ai1.com")) router.push("/admin")
      else router.push("/client-portal")
    }
  }

  if (!isLoginOpen) return null

  const tabs = [
    { key: "individual" as const, label: "Private",   icon: User,      accounts: INDIVIDUAL_ACCOUNTS },
    { key: "corporate"  as const, label: "Corporate", icon: Building2, accounts: CORPORATE_ACCOUNTS },
    { key: "admin"      as const, label: "Admin",     icon: Shield,    accounts: ADMIN_ACCOUNTS },
  ]
  const activeAccounts = tabs.find(t => t.key === tab)!.accounts

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to your portal"
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center ${isMobile ? "" : "p-4"}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
        onClick={closeLogin}
        aria-hidden="true"
      />

      {/* Panel - Full screen bottom sheet on mobile */}
      <div 
        className={`relative w-full bg-background shadow-2xl overflow-hidden ${
          isMobile 
            ? "max-h-[90vh] rounded-t-2xl animate-slide-up" 
            : "max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300"
        }`}
      >
        {/* Drag handle on mobile */}
        {isMobile && (
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>
        )}

        {/* Top gold accent bar - hidden on mobile since we have drag handle */}
        {!isMobile && <div className="h-1 w-full bg-primary" />}

        {/* Scrollable content */}
        <div className={`overflow-y-auto scroll-touch ${isMobile ? "max-h-[calc(90vh-1.5rem)]" : ""}`}>
          {/* Header */}
          <div className="flex items-start justify-between px-5 sm:px-8 pt-4 sm:pt-8 pb-4 sm:pb-6">
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-primary mb-1">AI1 Portal Access</p>
              <h2 className="font-serif text-2xl sm:text-3xl text-foreground leading-tight">Welcome Back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to manage your requests</p>
            </div>
            <button
              onClick={closeLogin}
              aria-label="Close sign in"
              className="p-3 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors -mt-1 -mr-2 touch-target active-scale"
            >
              <X size={22} />
            </button>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="px-5 sm:px-8 pb-5 sm:pb-6">
            <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                ref={inputRef}
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError("") }}
                placeholder="your@email.com"
                className="flex-1 px-4 py-3.5 sm:py-3 border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-base sm:text-sm"
              />
              <button
                type="submit"
                aria-label="Sign in"
                className="px-5 py-3.5 sm:py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap touch-target active-scale"
              >
                Sign In
                <ArrowRight size={16} />
              </button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">No password required for test accounts.</p>
          </form>

          {/* Divider */}
          <div className="px-5 sm:px-8 flex items-center gap-4 mb-5 sm:mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest uppercase">or choose a test account</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Tabs */}
          <div className="px-5 sm:px-8 mb-4">
            <div className="flex border border-border">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 text-xs font-medium tracking-wide uppercase transition-colors touch-target active-scale ${
                    tab === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Account list */}
          <div className="px-5 sm:px-8 pb-6 sm:pb-8 flex flex-col gap-2 safe-bottom">
            {activeAccounts.map(acc => (
              <button
                key={acc.email}
                onClick={() => handleQuickLogin(acc.email)}
                className="w-full flex items-center justify-between px-4 py-4 sm:py-3.5 border border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left group touch-target active-scale"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-9 sm:h-9 bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    <span className="font-serif text-sm text-foreground">{acc.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">{acc.detail}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
