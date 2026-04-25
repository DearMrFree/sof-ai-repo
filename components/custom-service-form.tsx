'use client'

import { useState } from 'react'
import { ChevronRight, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { createRequest } from '@/lib/mock-requests'

interface CustomServiceFormProps {
  clientEmail?: string
  clientName?: string
  onClose?: () => void
}

export function CustomServiceForm({
  clientEmail = '',
  clientName = '',
  onClose,
}: CustomServiceFormProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    serviceName: '',
    description: '',
    yourName: clientName,
    email: clientEmail,
    phone: '',
    company: '',
    address: '',
    urgency: 'standard',
    additionalInfo: '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const validateStep = () => {
    if (step === 1) {
      if (!form.serviceName.trim()) {
        setError('Please describe the service you need')
        return false
      }
      if (!form.description.trim()) {
        setError('Please provide details about your request')
        return false
      }
    }
    if (step === 2) {
      if (!form.yourName.trim()) {
        setError('Please enter your name')
        return false
      }
      if (!form.email.trim() || !form.email.includes('@')) {
        setError('Please enter a valid email address')
        return false
      }
      if (!form.phone.trim()) {
        setError('Please enter your phone number')
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setLoading(true)
    setError('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Create the request in mock storage
      createRequest(
        'custom-client-' + Date.now(),
        form.email,
        form.yourName,
        form.company ? 'corporation' : 'individual',
        {
          serviceType: 'custom',
          service: form.serviceName,
          description: form.description,
          phone: form.phone,
          address: form.address,
          additionalInfo: form.additionalInfo,
          company: form.company,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      )

      // Log to console (in real app, would send email and log to admin portal)
      console.log('[v0] Custom Service Request Submitted:', {
        ...form,
        timestamp: new Date().toISOString(),
      })

      setSubmitted(true)
    } catch (err) {
      setError('Failed to submit request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-background max-w-md w-full p-8 md:p-12 border border-border">
          <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-6">
            <CheckCircle size={24} className="text-primary" />
          </div>
          <h2 className="font-serif text-2xl text-foreground mb-3">Request Submitted</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Thank you, <strong>{form.yourName}</strong>. Your custom service request has been received. A senior advisor will review your requirements and contact you within 24 hours.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Confirmation sent to <strong className="text-foreground">{form.email}</strong>
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setSubmitted(false)
                onClose?.()
              }}
              className="w-full py-3 bg-primary text-primary-foreground text-sm font-medium tracking-wide hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-6 md:p-8 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl text-foreground">Custom Service Request</h2>
            <p className="text-xs text-muted-foreground mt-1">Step {step} of 2</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Step 1 – Service Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  What service do you need?
                </label>
                <input
                  type="text"
                  name="serviceName"
                  value={form.serviceName}
                  onChange={handleChange}
                  placeholder="e.g., Fine Art Installation, Storage Solutions, etc."
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Tell us more about your request
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe your needs, timeline, and any specific requirements..."
                  rows={6}
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Property or Service Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Full address"
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Timeline & Urgency
                </label>
                <select
                  name="urgency"
                  value={form.urgency}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                >
                  <option value="flexible">Flexible (90+ days)</option>
                  <option value="standard">Standard (30-60 days)</option>
                  <option value="expedited">Expedited (7-30 days)</option>
                  <option value="urgent">Urgent (Within 7 days)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Additional Information (Optional)
                </label>
                <textarea
                  name="additionalInfo"
                  value={form.additionalInfo}
                  onChange={handleChange}
                  placeholder="Any other details we should know..."
                  rows={3}
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2 – Contact Information */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="yourName"
                  value={form.yourName}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(650) 555-0123"
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Company (if applicable)
                </label>
                <input
                  type="text"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="Your company name"
                  className="w-full px-4 py-3 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div className="bg-secondary border border-border p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A senior advisor will prepare a bespoke proposal tailored to your specific needs and contact you within 24 hours. Your information is confidential and will not be shared.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-8">
            {step === 2 && (
              <button
                onClick={() => {
                  setStep(1)
                  setError('')
                }}
                className="px-6 py-3 border border-border text-foreground text-sm font-medium hover:bg-secondary transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (validateStep()) {
                  if (step === 2) {
                    handleSubmit()
                  } else {
                    setStep(2)
                  }
                }
              }}
              disabled={loading}
              className="ml-auto px-6 py-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  {step === 2 ? 'Submit Request' : 'Continue'}
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
