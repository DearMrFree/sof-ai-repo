"use client"

import { useState } from "react"
import Link from "next/link"
import { Send, Phone, Mail, MapPin, Clock, ArrowRight, Camera, FileText } from "lucide-react"

export function ContactSection() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    service: "",
    budget: "",
    timeline: "",
    message: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted:", formData)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <section id="contact" className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-secondary/30 -skew-x-12 origin-top-right" />
      
      <div className="container mx-auto px-6 relative">
        <div className="grid lg:grid-cols-5 gap-16 lg:gap-12">
          {/* Left - Contact Info */}
          <div className="lg:col-span-2 space-y-10">
            <div>
              <span className="text-xs tracking-[0.25em] text-primary uppercase font-medium">Contact</span>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-5xl mt-4 tracking-tight text-balance">
                Let's Discuss Your Project
              </h2>
              <p className="text-muted-foreground leading-relaxed mt-6 text-balance">
                Whether you're planning an executive relocation, estate transformation, 
                or require ongoing property care, our team is ready to craft a solution 
                tailored to your needs.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="text-primary" size={22} />
                </div>
                <div>
                  <span className="text-xs tracking-widest text-muted-foreground uppercase">Call Us</span>
                  <p className="text-foreground text-lg font-medium mt-1">(408) 872-8340</p>
                  <p className="text-sm text-muted-foreground">Mon-Sat, 7AM - 7PM PST</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="text-primary" size={22} />
                </div>
                <div>
                  <span className="text-xs tracking-widest text-muted-foreground uppercase">Email</span>
                  <p className="text-foreground text-lg font-medium mt-1">luxservicesbayarea@gmail.com</p>
                  <p className="text-sm text-muted-foreground">We respond within 2 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="text-primary" size={22} />
                </div>
                <div>
                  <span className="text-xs tracking-widest text-muted-foreground uppercase">Location</span>
                  <p className="text-foreground text-lg font-medium mt-1">531 Lasuen Mall #20051</p>
                  <p className="text-sm text-muted-foreground">Stanford, CA 94305</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="text-primary" size={22} />
                </div>
                <div>
                  <span className="text-xs tracking-widest text-muted-foreground uppercase">Response Time</span>
                  <p className="text-foreground text-lg font-medium mt-1">Same-Day Quotes</p>
                  <p className="text-sm text-muted-foreground">For most service requests</p>
                </div>
              </div>
            </div>

            {/* Full Proposal CTA */}
            <div className="pt-8 border-t border-border">
              <div className="bg-primary/5 border border-primary/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="text-primary" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground mb-1">Need a detailed proposal?</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use our interactive proposal builder to specify your exact needs and upload photos or videos of your property.
                    </p>
                    <Link
                      href="/quote"
                      className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline group"
                    >
                      Start Your Proposal
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="pt-8 border-t border-border">
              <p className="text-xs tracking-widest text-muted-foreground uppercase mb-4">Credentials</p>
              <div className="flex flex-wrap gap-4">
                <div className="px-4 py-2 bg-secondary text-sm text-foreground">BBB A+ Rated</div>
                <div className="px-4 py-2 bg-secondary text-sm text-foreground">Licensed & Insured</div>
                <div className="px-4 py-2 bg-secondary text-sm text-foreground">AMSA Certified</div>
              </div>
            </div>
          </div>

          {/* Right - Form */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border p-8 lg:p-12 shadow-lg">
              <div className="mb-8">
                <h3 className="font-serif text-2xl lg:text-3xl">Request a Consultation</h3>
                <p className="text-muted-foreground mt-2">Complete the form below and a member of our team will contact you within 2 hours.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm text-foreground font-medium">
                      First Name <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm text-foreground font-medium">
                      Last Name <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm text-foreground font-medium">
                      Email <span className="text-primary">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm text-foreground font-medium">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                      placeholder="(408) 555-0123"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="company" className="text-sm text-foreground font-medium">
                    Company (if applicable)
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                    placeholder="Company name"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="service" className="text-sm text-foreground font-medium">
                      Service Needed <span className="text-primary">*</span>
                    </label>
                    <select
                      id="service"
                      name="service"
                      required
                      value={formData.service}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                    >
                      <option value="">Select a service</option>
                      <option value="moving-residential">Residential Moving</option>
                      <option value="moving-corporate">Corporate Relocation</option>
                      <option value="landscaping">Landscaping Design</option>
                      <option value="landscaping-maintenance">Landscape Maintenance</option>
                      <option value="hauling">Hauling & Removal</option>
                      <option value="gutter">Gutter Maintenance</option>
                      <option value="multiple">Multiple Services</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="timeline" className="text-sm text-foreground font-medium">
                      Preferred Timeline
                    </label>
                    <select
                      id="timeline"
                      name="timeline"
                      value={formData.timeline}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                    >
                      <option value="">Select timeline</option>
                      <option value="urgent">Within 1 week</option>
                      <option value="soon">1-2 weeks</option>
                      <option value="month">Within a month</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm text-foreground font-medium">
                    Project Details
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-background border border-border focus:border-primary focus:outline-none transition-colors resize-none text-foreground"
                    placeholder="Tell us about your project, property, and any specific requirements..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground tracking-wide hover:bg-primary/90 transition-all duration-300 group"
                >
                  Submit Consultation Request
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </button>

                <p className="text-xs text-muted-foreground text-center">
                  By submitting, you agree to our privacy policy. We never share your information.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
