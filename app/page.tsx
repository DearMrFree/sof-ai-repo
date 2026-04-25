import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { StatsSection } from "@/components/stats-section"
import { ServicesSection } from "@/components/services-section"
import { ProcessSection } from "@/components/process-section"
import { CorporateSection } from "@/components/corporate-section"
import { ParallaxSection } from "@/components/parallax-section"
import { GlobalPresenceGlobe } from "@/components/global-presence-globe"
import { AwardsSection } from "@/components/awards-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { AboutSection } from "@/components/about-section"
import { FAQSection } from "@/components/faq-section"
import { ContactSection } from "@/components/contact-section"
import { Footer } from "@/components/footer"
import { FloatingCTA } from "@/components/floating-cta"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <HeroSection />
      <StatsSection />
      <ServicesSection />
      <ProcessSection />
      <CorporateSection />
      <ParallaxSection />
      <GlobalPresenceGlobe />
      <AwardsSection />
      <TestimonialsSection />
      <AboutSection />
      <FAQSection />
      <ContactSection />
      <Footer />
      <FloatingCTA />
    </main>
  )
}
