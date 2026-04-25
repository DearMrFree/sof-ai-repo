import type { Metadata } from "next"
import { QuoteWizard } from "@/components/quote-wizard"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Request a Proposal | All In One (AI1)",
  description:
    "Request a bespoke proposal for premium relocation, estate landscaping, property management, and corporate services. White-glove service for discerning private and corporate clients.",
}

export default function QuotePage() {
  return (
    <main>
      <Navigation />
      <QuoteWizard />
      <Footer />
    </main>
  )
}
