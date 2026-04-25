"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Quote } from "lucide-react"

const testimonials = [
  {
    id: 1,
    quote: "All In One handled our corporate relocation with the precision and professionalism we expect at the executive level. Every piece of furniture, every artifact was treated with museum-quality care. They transformed what could have been a stressful transition into a seamless experience.",
    author: "Jonathan Harrington",
    title: "CEO, Harrington Ventures",
    location: "Atherton, CA",
    image: "/images/testimonial-1.jpg",
  },
  {
    id: 2,
    quote: "When we needed our estate's grounds transformed for our daughter's wedding, All In One exceeded every expectation. The landscaping team created something truly magical. Six months later, our gardens are still the talk of the neighborhood.",
    author: "Dr. Catherine Chen",
    title: "Chief of Surgery, Stanford Medical",
    location: "Palo Alto, CA",
  },
  {
    id: 3,
    quote: "After trying several services, we finally found a team that understands what luxury service truly means. From the initial consultation to the final walkthrough, All In One operated with a level of care and attention I've rarely encountered in any industry.",
    author: "Michael & Sarah Thornton",
    title: "Private Equity Partners",
    location: "Los Altos Hills, CA",
  },
]

const clientLogos = [
  "Stanford University",
  "Google",
  "Meta",
  "Salesforce",
  "VMware",
  "Apple",
]

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <section className="py-24 lg:py-32 bg-foreground text-background relative overflow-hidden">
      {/* Decorative Pattern */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="container mx-auto px-6 relative">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-16 lg:mb-20">
          <div>
            <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">Testimonials</span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-background text-balance">
              Trusted by Industry Leaders
            </h2>
          </div>
          <div className="flex gap-3 mt-8 lg:mt-0">
            <button
              onClick={prevTestimonial}
              className="w-12 h-12 border border-background/30 flex items-center justify-center hover:bg-background hover:text-foreground transition-all duration-300"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextTestimonial}
              className="w-12 h-12 border border-background/30 flex items-center justify-center hover:bg-background hover:text-foreground transition-all duration-300"
              aria-label="Next testimonial"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Testimonial Card */}
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8">
            <div className="relative">
              <Quote className="absolute -top-4 -left-4 w-16 h-16 text-primary/20" />
              <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl leading-relaxed text-background/90 relative z-10 text-balance">
                "{testimonials[currentIndex].quote}"
              </blockquote>
            </div>
            <div className="mt-10 pt-10 border-t border-background/20">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="font-serif text-xl text-primary">
                    {testimonials[currentIndex].author.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-lg text-background">{testimonials[currentIndex].author}</p>
                  <p className="text-background/60">{testimonials[currentIndex].title}</p>
                  <p className="text-background/40 text-sm mt-1">{testimonials[currentIndex].location}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="lg:col-span-4 flex lg:flex-col items-center lg:items-end gap-4">
            <div className="flex lg:flex-col gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`transition-all duration-300 ${
                    index === currentIndex 
                      ? "w-8 h-2 lg:w-2 lg:h-8 bg-primary" 
                      : "w-2 h-2 bg-background/30 hover:bg-background/50"
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
            <span className="text-sm text-background/50 lg:mt-4">
              {String(currentIndex + 1).padStart(2, '0')} / {String(testimonials.length).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Client Logos */}
        <div className="mt-20 pt-16 border-t border-background/10">
          <p className="text-center text-sm text-background/40 tracking-widest uppercase mb-10">
            Serving executives and teams from
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
            {clientLogos.map((logo, index) => (
              <span 
                key={index} 
                className="text-background/30 text-sm lg:text-base tracking-widest font-medium hover:text-background/50 transition-colors duration-300"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
