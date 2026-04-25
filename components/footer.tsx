import Link from "next/link"
import { ArrowUpRight, Phone, Mail, MapPin, Instagram } from "lucide-react"

const footerLinks = {
  services: [
    { label: "Premium Moving", href: "#services" },
    { label: "Estate Landscaping", href: "#services" },
    { label: "Executive Hauling", href: "#services" },
    { label: "Gutter Maintenance", href: "#services" },
    { label: "Corporate Relocation", href: "#services" },
  ],
  company: [
    { label: "About Us", href: "#about" },
    { label: "Our Story", href: "#about" },
    { label: "Testimonials", href: "#about" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#contact" },
  ],
  resources: [
    { label: "Service Areas", href: "#" },
    { label: "Pricing Guide", href: "#" },
    { label: "Moving Checklist", href: "#" },
    { label: "FAQ", href: "#" },
  ],
  legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Accessibility", href: "#" },
    { label: "Insurance Info", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      {/* Main Footer */}
      <div className="container mx-auto px-6 py-16 lg:py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-8">
            <Link href="#home" className="flex items-center gap-3 group">
              <div className="w-12 h-12 border-2 border-background/30 flex items-center justify-center transition-all duration-300 group-hover:border-background">
                <div className="w-6 h-6 border border-background/30 group-hover:border-background transition-colors duration-300" />
              </div>
              <div>
                <span className="font-serif text-xl tracking-wide block">All In One</span>
                <span className="text-xs tracking-widest text-background/50 uppercase">AI1 Bay Area</span>
              </div>
            </Link>
            <p className="text-background/60 leading-relaxed max-w-sm text-balance">
              Setting the standard for premium home services since 1996. 
              Where white-glove service meets uncompromising excellence.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-4">
              <a href="tel:4088728340" className="flex items-center gap-3 text-background/70 hover:text-background transition-colors">
                <Phone size={18} className="text-primary" />
                <span>(408) 872-8340</span>
              </a>
              <a href="mailto:luxservicesbayarea@gmail.com" className="flex items-center gap-3 text-background/70 hover:text-background transition-colors">
                <Mail size={18} className="text-primary" />
                <span>luxservicesbayarea@gmail.com</span>
              </a>
              <div className="flex items-start gap-3 text-background/70">
                <MapPin size={18} className="text-primary mt-1 flex-shrink-0" />
                <span>531 Lasuen Mall #20051<br />Stanford, CA 94305</span>
              </div>
            </div>

            {/* Social Media */}
            <div className="flex items-center gap-4">
              <a 
                href="https://instagram.com/allinonebayarea" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 border border-background/30 flex items-center justify-center hover:bg-primary hover:border-primary transition-all duration-300 group"
                aria-label="Follow us on Instagram"
              >
                <Instagram size={18} className="text-background/70 group-hover:text-foreground" />
              </a>
              <a 
                href="https://tiktok.com/@allinonebayarea" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 border border-background/30 flex items-center justify-center hover:bg-primary hover:border-primary transition-all duration-300 group"
                aria-label="Follow us on TikTok"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="w-[18px] h-[18px] text-background/70 group-hover:text-foreground"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-6">
            <h4 className="text-sm font-medium tracking-widest uppercase text-background/40">
              Services
            </h4>
            <ul className="space-y-4">
              {footerLinks.services.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-background/60 hover:text-background transition-colors duration-300 text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight size={12} className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-6">
            <h4 className="text-sm font-medium tracking-widest uppercase text-background/40">
              Company
            </h4>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-background/60 hover:text-background transition-colors duration-300 text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight size={12} className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-6">
            <h4 className="text-sm font-medium tracking-widest uppercase text-background/40">
              Resources
            </h4>
            <ul className="space-y-4">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-background/60 hover:text-background transition-colors duration-300 text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight size={12} className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-6">
            <h4 className="text-sm font-medium tracking-widest uppercase text-background/40">
              Legal
            </h4>
            <ul className="space-y-4">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-background/60 hover:text-background transition-colors duration-300 text-sm flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight size={12} className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-background/10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-background/40 text-sm">
              © {new Date().getFullYear()} All In One (AI1) Bay Area. All rights reserved.
            </p>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 text-background/40 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Available for bookings</span>
              </div>
              <span className="text-background/20 hidden sm:block">|</span>
              <span className="text-background/40 text-sm hidden sm:block">
                Serving SF, Peninsula, South Bay & East Bay
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
