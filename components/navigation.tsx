"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X, Phone, LogIn, ChevronRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { UserMenu } from "@/components/user-menu"

const navLinks = [
  { href: "/",                 label: "Home" },
  { href: "/#services",        label: "Services" },
  { href: "/#global-presence", label: "Global" },
  { href: "/#about",           label: "About" },
  { href: "/#contact",         label: "Contact" },
]

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, openLogin } = useAuth()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isMobileMenuOpen])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 safe-top ${
        isScrolled
          ? "bg-background/98 backdrop-blur-md shadow-sm py-2 sm:py-3"
          : "bg-transparent py-3 sm:py-5"
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 flex items-center justify-between" aria-label="Main navigation">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group" aria-label="All In One AI1 — home">
          <div className="w-9 h-9 sm:w-11 sm:h-11 border-2 border-primary flex items-center justify-center transition-all duration-300 group-hover:bg-primary">
            <div className="w-4 h-4 sm:w-5 sm:h-5 border border-primary group-hover:border-primary-foreground transition-colors duration-300" />
          </div>
          <div className="hidden sm:block">
            <span className="font-serif text-lg tracking-wide text-foreground block leading-tight">All In One</span>
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">AI1 Bay Area</span>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm tracking-wide text-muted-foreground hover:text-foreground transition-colors duration-300 relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side - Desktop */}
        <div className="hidden lg:flex items-center gap-4">
          <a
            href="tel:4088728340"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Call us at (408) 872-8340"
          >
            <Phone size={16} className="text-primary" />
            <span>(408) 872-8340</span>
          </a>

          {user ? (
            <UserMenu />
          ) : (
            <button
              onClick={openLogin}
              aria-label="Sign in to your portal"
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-sm text-foreground hover:bg-secondary hover:border-primary/50 transition-all duration-300"
            >
              <LogIn size={15} className="text-primary" />
              Sign In
            </button>
          )}

          <Link
            href="/quote"
            className="px-6 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-primary/90 transition-all duration-300"
          >
            Get Quote
          </Link>
        </div>

        {/* Mobile toggle */}
        <div className="flex lg:hidden items-center gap-2">
          {/* Quick call button on mobile */}
          <a
            href="tel:4088728340"
            className="p-2.5 text-primary touch-target active-scale"
            aria-label="Call us"
          >
            <Phone size={20} />
          </a>
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 text-foreground touch-target active-scale"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu - Full screen overlay */}
      <div
        id="mobile-menu"
        className={`lg:hidden fixed inset-0 top-[56px] bg-background z-40 transition-all duration-300 mobile-full-height ${
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div className="h-full overflow-y-auto scroll-touch no-overscroll">
          <div className="container mx-auto px-4 py-6 flex flex-col">
            {/* Navigation links */}
            <div className="flex flex-col">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-4 text-lg tracking-wide text-foreground border-b border-border/50 touch-target active-scale"
                >
                  <span>{link.label}</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-border my-6" />

            {/* Contact section */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-3">Contact</p>
              <a
                href="tel:4088728340"
                className="flex items-center gap-3 py-3 text-foreground touch-target"
              >
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                  <Phone size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium">(408) 872-8340</p>
                  <p className="text-xs text-muted-foreground">Tap to call</p>
                </div>
              </a>
            </div>

            {/* Auth section */}
            <div className="mt-auto pb-8 safe-bottom">
              {user ? (
                <div className="space-y-3">
                  <div className="p-4 bg-secondary border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Signed in as</p>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Link
                    href={user.type === "admin" ? "/admin" : "/client-portal"}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 border border-primary text-primary text-center tracking-wide hover:bg-primary/5 transition-all duration-300 touch-target active-scale"
                  >
                    Go to My Portal
                    <ChevronRight size={16} />
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => { setIsMobileMenuOpen(false); openLogin() }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 border border-border text-foreground tracking-wide hover:bg-secondary transition-all duration-300 touch-target active-scale"
                >
                  <LogIn size={18} className="text-primary" />
                  Sign In to Your Portal
                </button>
              )}

              <Link
                href="/quote"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full mt-3 flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground tracking-wide hover:bg-primary/90 transition-all duration-300 touch-target active-scale"
              >
                Get Your Quote
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
