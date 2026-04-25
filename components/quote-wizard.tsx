"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { addTransaction, formatLux } from "@/lib/lux-coins"
import { Coins } from "lucide-react"
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Truck,
  Gem,
  Trees,
  KeyRound,
  Sparkles,
  Home as HomeIcon,
  Building2,
  Landmark,
  Castle,
  Briefcase,
  Wrench,
  Container,
  MapPin,
  User,
  Phone,
  Mail,
  Building,
  ChevronRight,
  Shield,
  Star,
  Award,
  Check,
  Upload,
  ImageIcon,
  Video,
  Mic,
  X,
  FileText,
  Loader2,
  Camera,
  Play,
  UserPlus,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════
// SERVICES — Aligned with Services Section
// ═══════════════════════════════════════════════════════════════

const PRIVATE_SERVICES = [
  { id: "relocation", label: "White-Glove Relocation", description: "Full-service residential moving with museum-grade care", icon: Truck },
  { id: "fine-art", label: "Fine Art & Valuables", description: "Specialty transport for art, antiques, and collectibles", icon: Gem },
  { id: "landscaping", label: "Estate Landscaping", description: "Master-designed grounds and year-round maintenance", icon: Trees },
  { id: "concierge", label: "Property Concierge", description: "Complete home management and vendor coordination", icon: KeyRound },
  { id: "pressure-washing", label: "Surface Restoration", description: "Driveways, facades, and exterior deep cleaning", icon: Sparkles },
  { id: "gutter", label: "Gutter & Roof Care", description: "Preventive maintenance and seasonal protection", icon: HomeIcon },
]

const CORPORATE_SERVICES = [
  { id: "corporate-relocation", label: "Corporate Relocation", description: "Enterprise-scale office and commercial moving", icon: Building2 },
  { id: "executive-relocation", label: "Executive Programme", description: "C-Suite and senior leadership relocation", icon: Briefcase },
  { id: "facility-management", label: "Facility Management", description: "Commercial grounds and property maintenance", icon: Wrench },
  { id: "debris-clearance", label: "Site Clearance", description: "Construction debris and commercial hauling", icon: Container },
]

const PROPERTY_TYPES = [
  { id: "residential", label: "Private Residence", sublabel: "Single-family home", icon: HomeIcon },
  { id: "condo", label: "Condominium", sublabel: "Apartment or condo unit", icon: Building2 },
  { id: "estate", label: "Estate Property", sublabel: "Luxury estate or compound", icon: Castle },
  { id: "commercial", label: "Commercial Property", sublabel: "Office, retail, or industrial", icon: Landmark },
]

const PROPERTY_SIZES = [
  { id: "small", label: "Under 2,000 sq ft", sublabel: "Compact spaces" },
  { id: "medium", label: "2,000 – 4,000 sq ft", sublabel: "Standard homes & offices" },
  { id: "large", label: "4,000 – 8,000 sq ft", sublabel: "Larger properties" },
  { id: "estate", label: "8,000+ sq ft", sublabel: "Estates & campuses" },
]

const TIMELINES = [
  { id: "urgent", label: "Within 48 Hours", sublabel: "Emergency service", tag: "Priority" },
  { id: "week", label: "Within 1 Week", sublabel: "Expedited scheduling", tag: null },
  { id: "twoweeks", label: "Within 2 Weeks", sublabel: "Standard scheduling", tag: "Recommended" },
  { id: "month", label: "Within 1 Month", sublabel: "Flexible timing", tag: null },
  { id: "planning", label: "Planning Ahead", sublabel: "More than a month out", tag: null },
]

const ENHANCEMENTS = [
  { id: "weekend", label: "Weekend Service", description: "Saturday or Sunday scheduling" },
  { id: "after-hours", label: "After-Hours Service", description: "Evening appointments available" },
  { id: "white-glove", label: "Enhanced White-Glove", description: "Personal coordinator assigned" },
  { id: "insurance", label: "Premium Coverage", description: "Extended protection up to $5M" },
  { id: "settling", label: "Settling Service", description: "Unpacking and home organisation" },
  { id: "storage", label: "Temporary Storage", description: "Secure climate-controlled facility" },
]

type MediaFile = {
  pathname: string
  filename: string
  size: number
  type: string
  preview?: string
}

type FormData = {
  clientType: "private" | "corporate" | ""
  services: string[]
  propertyType: string
  propertySize: string
  timeline: string
  enhancements: string[]
  address: string
  name: string
  email: string
  phone: string
  company: string
  notes: string
  media: MediaFile[]
}

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Services" },
  { id: 3, label: "Property" },
  { id: 4, label: "Schedule" },
  { id: 5, label: "Media" },
  { id: 6, label: "Contact" },
  { id: 7, label: "Review" },
]

export function QuoteWizard() {
  const router = useRouter()
  const { user, openLoginModal } = useAuth()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [form, setForm] = useState<FormData>({
    clientType: "",
    services: [],
    propertyType: "",
    propertySize: "",
    timeline: "",
    enhancements: [],
    address: "",
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    company: user?.company || "",
    notes: "",
    media: [],
  })

  function toggleService(id: string) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(id)
        ? prev.services.filter((v) => v !== id)
        : [...prev.services, id],
    }))
  }

  function toggleEnhancement(id: string) {
    setForm((prev) => ({
      ...prev,
      enhancements: prev.enhancements.includes(id)
        ? prev.enhancements.filter((v) => v !== id)
        : [...prev.enhancements, id],
    }))
  }

  function setField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)

    for (const file of Array.from(files)) {
      try {
        // Create preview for images
        let preview: string | undefined
        if (file.type.startsWith("image/")) {
          preview = URL.createObjectURL(file)
        }

        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          console.error("Upload failed:", error)
          continue
        }

        const result = await response.json()

        setForm((prev) => ({
          ...prev,
          media: [
            ...prev.media,
            {
              pathname: result.pathname,
              filename: result.filename,
              size: result.size,
              type: result.type,
              preview,
            },
          ],
        }))
      } catch (error) {
        console.error("Upload error:", error)
      }
    }

    setUploading(false)
  }, [])

  const removeMedia = (index: number) => {
    setForm((prev) => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileUpload(e.dataTransfer.files)
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const canAdvance =
    (step === 1 && form.clientType !== "") ||
    (step === 2 && form.services.length > 0) ||
    (step === 3 && form.propertyType && form.propertySize) ||
    (step === 4 && form.timeline) ||
    (step === 5) || // Media is optional
    (step === 6 && form.name && form.email && form.phone && form.address) ||
    step === 7

  const availableServices = form.clientType === "corporate" ? CORPORATE_SERVICES : PRIVATE_SERVICES
  const selectedServices = [...PRIVATE_SERVICES, ...CORPORATE_SERVICES].filter(s => form.services.includes(s.id))

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const getMediaIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon
    if (type.startsWith("video/")) return Video
    if (type.startsWith("audio/")) return Mic
    return FileText
  }

  return (
    <section className="min-h-screen bg-secondary/30">
      {/* Hero Header */}
      <div className="bg-foreground text-background pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
        
        <div className="container mx-auto px-6 max-w-4xl relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-px bg-primary" />
            <span className="text-xs tracking-[0.3em] text-primary uppercase font-medium">
              All In One
            </span>
          </div>
          
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-background leading-[1.1] mb-6 text-balance">
            Request Your<br />Bespoke Proposal
          </h1>
          
          <p className="text-background/70 text-lg leading-relaxed max-w-xl mb-10">
            Tell us about your property and requirements. A senior advisor will prepare a tailored proposal within 24 hours.
          </p>

          {/* Trust Indicators */}
          <div className="flex flex-wrap gap-8">
            {[
              { icon: Shield, text: "$2M Liability Coverage" },
              { icon: Award, text: "Serving Clients Since 1996" },
              { icon: Star, text: "4.9/5 Client Satisfaction" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-10 h-10 border border-background/20 flex items-center justify-center">
                  <Icon size={16} className="text-primary" />
                </div>
                <span className="text-sm text-background/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-background border-b border-border sticky top-20 z-30">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="flex items-center py-4 overflow-x-auto">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none min-w-0">
                <button
                  onClick={() => step > s.id && setStep(s.id)}
                  disabled={step < s.id}
                  className={`flex items-center gap-2 transition-all duration-300 flex-shrink-0 ${
                    step > s.id ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div
                    className={`w-8 h-8 flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      step === s.id
                        ? "bg-primary text-primary-foreground"
                        : step > s.id
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s.id ? <Check size={14} /> : s.id}
                  </div>
                  <span
                    className={`hidden lg:block text-sm transition-colors duration-300 whitespace-nowrap ${
                      step === s.id
                        ? "text-foreground font-medium"
                        : step > s.id
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 transition-all duration-500 min-w-4 ${
                      step > s.id ? "bg-primary/40" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="container mx-auto px-6 max-w-4xl py-12 md:py-16">
        <div className="bg-background border border-border shadow-sm">

          {/* ════════════════════════════════════════════════════════════
              STEP 1: Client Type (Welcome)
          ════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="p-8 md:p-14">
              <div className="text-center mb-12">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  Welcome. How may we serve you?
                </h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Select the option that best describes your needs.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                {[
                  { id: "private", icon: HomeIcon, title: "Private Client", description: "Personal residence, estate, or family property services" },
                  { id: "corporate", icon: Building2, title: "Corporate Client", description: "Commercial, institutional, or enterprise services" },
                ].map((option) => {
                  const Icon = option.icon
                  const active = form.clientType === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => setField("clientType", option.id)}
                      className={`flex flex-col items-center text-center p-10 border-2 transition-all duration-300 group ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-secondary/50"
                      }`}
                    >
                      <div
                        className={`w-16 h-16 flex items-center justify-center mb-6 transition-all duration-300 ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        }`}
                      >
                        <Icon size={28} />
                      </div>
                      <h3 className="font-serif text-xl text-foreground mb-2">{option.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{option.description}</p>
                      {active && (
                        <div className="mt-6">
                          <CheckCircle size={20} className="text-primary" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Sign Up Prompt */}
              {!user && (
                <div className="mt-12 p-6 bg-secondary/50 border border-border text-center">
                  <p className="text-muted-foreground mb-4">
                    Already have an account? Sign in to auto-fill your details.
                  </p>
                  <button
                    onClick={openLoginModal}
                    className="inline-flex items-center gap-2 px-6 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                  >
                    <UserPlus size={18} />
                    Sign In or Create Account
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 2: Services Selection
          ════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  Which services do you require?
                </h2>
                <p className="text-muted-foreground text-lg">
                  Select all services that apply to your project.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {availableServices.map((service) => {
                  const Icon = service.icon
                  const active = form.services.includes(service.id)
                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`flex items-start gap-5 p-6 border text-left transition-all duration-300 group ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-secondary/30"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-primary"
                        }`}
                      >
                        <Icon size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-base mb-1">{service.label}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {active ? (
                          <CheckCircle size={20} className="text-primary" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-muted-foreground/30 rounded-full" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {form.services.length > 0 && (
                <div className="mt-8 p-5 bg-secondary/50 border border-border">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{form.services.length}</span> service{form.services.length > 1 ? "s" : ""} selected
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 3: Property Details
          ════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  Tell us about your property
                </h2>
                <p className="text-muted-foreground text-lg">
                  This helps us assign the right team and equipment.
                </p>
              </div>

              {/* Property Type */}
              <div className="mb-10">
                <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5 font-medium">
                  Property Type
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {PROPERTY_TYPES.map((pt) => {
                    const Icon = pt.icon
                    const active = form.propertyType === pt.id
                    return (
                      <button
                        key={pt.id}
                        onClick={() => setField("propertyType", pt.id)}
                        className={`flex items-center gap-4 p-5 border text-left transition-all duration-300 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-secondary/30"
                        }`}
                      >
                        <Icon size={22} className={active ? "text-primary" : "text-muted-foreground"} />
                        <div className="flex-1">
                          <p className={`font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                            {pt.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{pt.sublabel}</p>
                        </div>
                        {active && <CheckCircle size={18} className="text-primary flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Property Size */}
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5 font-medium">
                  Approximate Size
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {PROPERTY_SIZES.map((ps) => {
                    const active = form.propertySize === ps.id
                    return (
                      <button
                        key={ps.id}
                        onClick={() => setField("propertySize", ps.id)}
                        className={`flex items-center justify-between p-5 border text-left transition-all duration-300 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-secondary/30"
                        }`}
                      >
                        <div>
                          <p className={`font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                            {ps.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ps.sublabel}</p>
                        </div>
                        {active && <CheckCircle size={18} className="text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 4: Schedule & Enhancements
          ════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  When do you need us?
                </h2>
                <p className="text-muted-foreground text-lg">
                  Select your preferred timeline and any enhancements.
                </p>
              </div>

              {/* Timeline */}
              <div className="mb-10">
                <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5 font-medium">
                  Timeline
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TIMELINES.map((tl) => {
                    const active = form.timeline === tl.id
                    return (
                      <button
                        key={tl.id}
                        onClick={() => setField("timeline", tl.id)}
                        className={`relative flex items-center justify-between p-5 border text-left transition-all duration-300 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-secondary/30"
                        }`}
                      >
                        {tl.tag && (
                          <span className={`absolute -top-2 left-4 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${
                            tl.tag === "Priority" ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"
                          }`}>
                            {tl.tag}
                          </span>
                        )}
                        <div>
                          <p className={`font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                            {tl.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{tl.sublabel}</p>
                        </div>
                        {active && <CheckCircle size={18} className="text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Enhancements */}
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5 font-medium">
                  Optional Enhancements
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {ENHANCEMENTS.map((en) => {
                    const active = form.enhancements.includes(en.id)
                    return (
                      <button
                        key={en.id}
                        onClick={() => toggleEnhancement(en.id)}
                        className={`flex items-center gap-4 p-4 border text-left transition-all duration-300 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                          active ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {active && <Check size={12} className="text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{en.label}</p>
                          <p className="text-xs text-muted-foreground">{en.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 5: Media Upload
          ════════════════════════════════════════════════════════════ */}
          {step === 5 && (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  Share photos or videos
                </h2>
                <p className="text-muted-foreground text-lg">
                  Help us understand your space better. This step is optional but helps us provide a more accurate proposal.
                </p>
              </div>

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-border hover:border-primary/50 transition-colors p-10 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                
                {uploading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="text-primary animate-spin" />
                    <p className="text-muted-foreground">Uploading your files...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 flex items-center justify-center">
                      <Upload size={28} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium mb-1">
                        Drag and drop files here, or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Photos, videos, or voice memos up to 50MB each
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-muted-foreground text-sm mt-2">
                      <span className="flex items-center gap-2">
                        <Camera size={16} />
                        Photos
                      </span>
                      <span className="flex items-center gap-2">
                        <Play size={16} />
                        Videos
                      </span>
                      <span className="flex items-center gap-2">
                        <Mic size={16} />
                        Audio
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded Files */}
              {form.media.length > 0 && (
                <div className="mt-8">
                  <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4 font-medium">
                    Uploaded Files ({form.media.length})
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {form.media.map((file, index) => {
                      const MediaIcon = getMediaIcon(file.type)
                      return (
                        <div
                          key={index}
                          className="border border-border p-4 flex items-start gap-4 bg-secondary/30"
                        >
                          {file.preview ? (
                            <div className="w-16 h-16 flex-shrink-0 relative overflow-hidden bg-muted">
                              <Image
                                src={file.preview}
                                alt={file.filename}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 flex-shrink-0 bg-muted flex items-center justify-center">
                              <MediaIcon size={24} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {file.filename}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeMedia(index)}
                            className="p-1 hover:bg-muted transition-colors flex-shrink-0"
                          >
                            <X size={16} className="text-muted-foreground" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Skip Option */}
              <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No media to share?{" "}
                  <button
                    onClick={() => setStep(6)}
                    className="text-primary hover:underline font-medium"
                  >
                    Skip this step
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 6: Contact Information
          ════════════════════════════════════════════════════════════ */}
          {step === 6 && (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  Your contact details
                </h2>
                <p className="text-muted-foreground text-lg">
                  How should our advisor reach you?
                </p>
              </div>

              {/* Auto-fill prompt for non-logged in users */}
              {!user && (
                <div className="mb-8 p-5 bg-primary/5 border border-primary/20 flex items-start gap-4">
                  <UserPlus size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium mb-1">
                      Save time on future requests
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Create an account to auto-fill your details and track your proposals.
                    </p>
                    <button
                      onClick={openLoginModal}
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      Sign in or create account
                    </button>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2 font-medium">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="Your name"
                      className="w-full pl-12 pr-4 py-4 border border-border bg-background text-foreground focus:border-primary focus:ring-0 focus:outline-none transition-colors text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2 font-medium">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-12 pr-4 py-4 border border-border bg-background text-foreground focus:border-primary focus:ring-0 focus:outline-none transition-colors text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2 font-medium">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      placeholder="(408) 872-8340"
                      className="w-full pl-12 pr-4 py-4 border border-border bg-background text-foreground focus:border-primary focus:ring-0 focus:outline-none transition-colors text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2 font-medium">
                    Company {form.clientType === "corporate" && "*"}
                  </label>
                  <div className="relative">
                    <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setField("company", e.target.value)}
                      placeholder="Your company"
                      className="w-full pl-12 pr-4 py-4 border border-border bg-background text-foreground focus:border-primary focus:ring-0 focus:outline-none transition-colors text-base"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2 font-medium">
                    Property Address *
                  </label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      placeholder="123 Main Street, City, State ZIP"
                      className="w-full pl-12 pr-4 py-4 border border-border bg-background text-foreground focus:border-primary focus:ring-0 focus:outline-none transition-colors text-base"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2 font-medium">
                    Additional Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder="Any specific requirements, access instructions, or details we should know..."
                    rows={4}
                    className="w-full px-4 py-4 border border-border bg-background text-foreground focus:border-primary focus:ring-0 focus:outline-none transition-colors resize-none text-base"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 7: Review & Submit
          ════════════════════════════════════════════════════════════ */}
          {step === 7 && !submitted && (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                  Review Your Proposal
                </h2>
                <p className="text-muted-foreground text-lg">
                  Please confirm your details before submitting.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column - Summary */}
                <div className="space-y-6">
                  <div className="border border-border p-6">
                    <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4 font-medium">
                      Services Requested
                    </p>
                    {selectedServices.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
                        <CheckCircle size={14} className="text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border border-border p-6">
                    <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4 font-medium">
                      Property Details
                    </p>
                    {[
                      { label: "Type", value: PROPERTY_TYPES.find(p => p.id === form.propertyType)?.label },
                      { label: "Size", value: PROPERTY_SIZES.find(p => p.id === form.propertySize)?.label },
                      { label: "Timeline", value: TIMELINES.find(t => t.id === form.timeline)?.label },
                      { label: "Address", value: form.address },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-xs text-foreground font-medium text-right max-w-[60%]">{value}</span>
                      </div>
                    ))}
                  </div>

                  {form.media.length > 0 && (
                    <div className="border border-border p-6">
                      <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4 font-medium">
                        Media Attached ({form.media.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {form.media.map((file, index) => {
                          const MediaIcon = getMediaIcon(file.type)
                          return (
                            <div key={index} className="flex items-center gap-2 bg-secondary/50 px-3 py-2 text-xs">
                              <MediaIcon size={12} className="text-muted-foreground" />
                              <span className="text-foreground truncate max-w-[120px]">{file.filename}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Contact Card */}
                <div className="space-y-6">
                  <div className="bg-foreground text-background p-8">
                    <p className="text-xs tracking-[0.2em] uppercase text-background/50 mb-6 font-medium">
                      Contact Information
                    </p>
                    <p className="font-serif text-2xl text-background mb-1">{form.name}</p>
                    {form.company && <p className="text-background/60 mb-4">{form.company}</p>}
                    <div className="space-y-2 text-sm text-background/80">
                      <p>{form.email}</p>
                      <p>{form.phone}</p>
                    </div>
                    <div className="border-t border-background/20 mt-6 pt-6 flex items-start gap-2 text-background/50 text-xs">
                      <Shield size={12} className="mt-0.5 flex-shrink-0" />
                      <span>Your information is secure and will only be used to prepare your proposal.</span>
                    </div>
                  </div>

                  <div className="border border-border p-6 bg-primary/5">
                    <div className="flex items-start gap-4">
                      <Star size={20} className="text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">What happens next?</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          A senior advisor will review your request and prepare a bespoke proposal within 24 hours. No payment required.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      // Award Lux Coins for submitting a quote
                      if (user) {
                        addTransaction(user.id, 'quote_request', undefined, `Submitted proposal request: ${form.services.length} service(s)`)
                        // Award bonus for media uploads
                        if (form.media.length > 0) {
                          addTransaction(user.id, 'media_upload', form.media.length * 50, `Uploaded ${form.media.length} media file(s)`)
                        }
                      }
                      setSubmitted(true)
                    }}
                    className="w-full py-5 bg-primary text-primary-foreground font-medium tracking-widest uppercase hover:bg-primary/90 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                  >
                    Submit Proposal Request
                    <ChevronRight size={16} />
                  </button>
                  
                  {/* Lux Coins Preview */}
                  <div className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                    <Coins size={14} className="text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Earn <strong>+{100 + (form.media.length * 50)} Lux Coins</strong> for this submission
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    By submitting, you agree to our{" "}
                    <Link href="#" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              SUCCESS STATE
          ════════════════════════════════════════════════════════════ */}
          {step === 7 && submitted && (
            <div className="p-8 sm:p-12 md:p-20 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-primary/10 flex items-center justify-center mb-6">
                <CheckCircle size={40} className="text-primary" />
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-foreground mb-4">Proposal Received</h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md mb-6 leading-relaxed">
                Thank you, <strong className="text-foreground">{form.name}</strong>. A senior advisor will prepare your bespoke proposal and reach out within 24 hours.
              </p>
              
              {/* Lux Coins Earned Banner */}
              {user && (
                <div className="bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border border-amber-300 p-5 w-full max-w-md mb-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center">
                      <Coins size={20} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-amber-700 uppercase tracking-wider">You earned</p>
                      <p className="font-serif text-2xl text-amber-900">+{100 + (form.media.length * 50)} Lux Coins</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-secondary border border-border p-8 w-full max-w-md mb-10">
                <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5 font-medium">What Happens Next</p>
                {[
                  "Senior advisor reviews your requirements",
                  "Bespoke proposal prepared within 24 hours",
                  "On-site consultation scheduled at your convenience",
                  "Service begins on your timeline",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 py-3 border-b border-border last:border-0">
                    <span className="font-serif text-primary text-lg flex-shrink-0 w-6">{i + 1}.</span>
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>

              {!user && (
                <div className="bg-primary/5 border border-primary/20 p-6 w-full max-w-md mb-10">
                  <UserPlus size={24} className="text-primary mx-auto mb-4" />
                  <p className="font-medium text-foreground mb-2">Create your account</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track your proposals, manage appointments, and access exclusive benefits.
                  </p>
                  <button
                    onClick={openLoginModal}
                    className="w-full py-3 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <a
                  href="tel:4088728340"
                  className="flex-1 py-4 border border-primary text-primary font-medium hover:bg-primary/5 transition-colors text-center"
                >
                  Call (408) 872-8340
                </a>
                <button
                  onClick={() => router.push("/")}
                  className="flex-1 py-4 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-center"
                >
                  Return Home
                </button>
              </div>
            </div>
          )}

          {/* Navigation Footer */}
          {!submitted && (
            <div className="border-t border-border p-6 flex items-center justify-between">
              <button
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                className={`flex items-center gap-2 px-6 py-3 transition-all duration-300 ${
                  step === 1
                    ? "text-muted-foreground cursor-not-allowed"
                    : "text-foreground hover:text-primary"
                }`}
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="text-sm text-muted-foreground">
                Step {step} of {STEPS.length}
              </div>

              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance || step === STEPS.length}
                className={`flex items-center gap-2 px-8 py-3 transition-all duration-300 ${
                  canAdvance && step < STEPS.length
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {step === STEPS.length - 1 ? "Review" : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
