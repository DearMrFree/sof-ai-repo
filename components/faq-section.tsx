"use client"

import { useState } from "react"
import { ChevronDown, HelpCircle } from "lucide-react"

const faqs = [
  {
    question: "What areas do you serve?",
    answer:
      "We proudly serve the entire San Francisco Bay Area, including San Francisco, Peninsula, South Bay, East Bay, and North Bay. Our headquarters are located in Stanford, CA, and we offer same-day service throughout Silicon Valley.",
  },
  {
    question: "Are your team members background-checked?",
    answer:
      "Absolutely. Every member of our team undergoes comprehensive background checks, drug screening, and professional training. We maintain the highest standards to ensure your complete peace of mind when our team enters your home.",
  },
  {
    question: "What insurance coverage do you carry?",
    answer:
      "We carry $2 million in general liability insurance and full workers' compensation coverage. Additionally, we offer supplemental valuation protection for high-value items during moving services.",
  },
  {
    question: "How do you handle delicate or valuable items?",
    answer:
      "Our white-glove service includes custom crating, museum-quality wrapping, and climate-controlled transport options for artwork, antiques, and high-value items. Each piece is inventoried and photographed before transport.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "We understand plans change. Cancellations made 48 hours before your scheduled service receive a full refund. For cancellations within 48 hours, a 50% fee applies. Emergency rescheduling is always accommodated at no additional charge.",
  },
  {
    question: "Do you offer corporate accounts?",
    answer:
      "Yes, we offer dedicated corporate accounts with priority scheduling, volume discounts, centralized billing, and a dedicated account manager. Many Fortune 500 companies in the Bay Area trust us for their executive relocations and office moves.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-24 lg:py-32 bg-card relative">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
          {/* Left Column - Header */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-px bg-primary" />
                <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">
                  FAQ
                </span>
              </div>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight text-balance">
                Common Questions
              </h2>
              <p className="text-muted-foreground mt-6 leading-relaxed text-balance">
                Everything you need to know about our services. Can&apos;t find the answer
                you&apos;re looking for? Our concierge team is here to help.
              </p>

              <div className="mt-8 p-6 bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-3 mb-3">
                  <HelpCircle className="text-primary" size={20} />
                  <span className="font-medium text-foreground">Need more help?</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Our team is available 7 days a week to answer your questions.
                </p>
                <a
                  href="tel:4088728340"
                  className="text-primary font-medium text-sm hover:underline"
                >
                  (408) 872-8340
                </a>
              </div>
            </div>
          </div>

          {/* Right Column - FAQ Items */}
          <div className="lg:col-span-8">
            <div className="space-y-0">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="border-b border-border last:border-b-0"
                >
                  <button
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full py-6 flex items-center justify-between text-left group"
                  >
                    <span
                      className={`font-medium text-lg pr-8 transition-colors duration-300 ${
                        openIndex === index ? "text-primary" : "text-foreground group-hover:text-primary"
                      }`}
                    >
                      {faq.question}
                    </span>
                    <div
                      className={`w-8 h-8 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        openIndex === index
                          ? "bg-primary text-primary-foreground rotate-180"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <ChevronDown size={18} />
                    </div>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-500 ease-out ${
                      openIndex === index ? "max-h-96 pb-6" : "max-h-0"
                    }`}
                  >
                    <p className="text-muted-foreground leading-relaxed pr-12">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
