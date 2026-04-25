"use client"

import { useState } from "react"
import Image from "next/image"
import { 
  Play, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Film, 
  Wand2,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Video,
  ImageIcon,
  Zap,
  Target,
  TrendingUp,
  Users,
  Clock,
  Star
} from "lucide-react"
import { Button } from "@/components/ui/button"

const videoTemplates = [
  {
    id: "moving",
    name: "Premium Moving",
    description: "Showcase luxury moving services with white-glove care",
    prompt: "Cinematic shot of professional movers in crisp uniforms carefully handling antique furniture in a luxury home, golden hour lighting, premium service feel, slow motion fabric wrapping, 4K quality",
    thumbnail: "/images/moving-service.jpg",
    marketingHook: "Your Treasures, Our Priority",
    cta: "Book Your Move Today",
    targetAudience: "High-net-worth homeowners relocating",
  },
  {
    id: "landscaping",
    name: "Estate Landscaping",
    description: "Transform outdoor spaces into stunning retreats",
    prompt: "Aerial drone shot revealing a magnificent estate garden transformation, lush green lawns, sculpted hedges, blooming flowers, professional landscapers at work, sunrise lighting, cinematic reveal",
    thumbnail: "/images/landscaping-service.jpg",
    marketingHook: "Where Nature Meets Artistry",
    cta: "Design Your Dream Garden",
    targetAudience: "Property owners seeking premium landscaping",
  },
  {
    id: "hauling",
    name: "Executive Hauling",
    description: "Efficient and discreet removal services",
    prompt: "Professional hauling team efficiently loading items into a pristine white truck, organized operation, clean residential setting, time-lapse style efficiency, corporate feel",
    thumbnail: "/images/hauling-service.jpg",
    marketingHook: "Effortless Removal, Impeccable Service",
    cta: "Schedule Your Pickup",
    targetAudience: "Busy executives and property managers",
  },
  {
    id: "gutter",
    name: "Gutter Excellence",
    description: "Protect your investment with expert maintenance",
    prompt: "Professional worker on ladder performing meticulous gutter cleaning on luxury craftsman home, dramatic before and after reveal, water flowing freely, sunset lighting",
    thumbnail: "/images/gutter-cleaning.jpg",
    marketingHook: "Protect What Matters Most",
    cta: "Book Maintenance Now",
    targetAudience: "Homeowners valuing preventive care",
  },
  {
    id: "pressure",
    name: "Surface Revival",
    description: "Restore surfaces to pristine condition",
    prompt: "Satisfying pressure washing transformation, stone driveway being cleaned with high-pressure water, dramatic clean line reveal, sparkling results, professional equipment",
    thumbnail: "/images/pressure-washing.jpg",
    marketingHook: "Reveal Your Property's True Beauty",
    cta: "Transform Your Surfaces",
    targetAudience: "Property owners seeking curb appeal",
  },
  {
    id: "brand",
    name: "Brand Story",
    description: "Tell your company's premium service story",
    prompt: "Montage of All In One professional team members at work, diverse services, happy clients, luxury homes, premium quality showcase, corporate brand video feel, inspiring music visualization",
    thumbnail: "/images/hero-workers.jpg",
    marketingHook: "Excellence Since 1996",
    cta: "Experience The Difference",
    targetAudience: "New potential clients",
  },
]

const marketingTips = [
  {
    icon: Target,
    title: "Know Your Audience",
    tip: "High-net-worth clients value discretion, quality, and reliability over price.",
  },
  {
    icon: TrendingUp,
    title: "Show Transformation",
    tip: "Before/after reveals create emotional impact and demonstrate value.",
  },
  {
    icon: Users,
    title: "Build Trust",
    tip: "Feature your team and real projects to create authentic connections.",
  },
  {
    icon: Clock,
    title: "Respect Their Time",
    tip: "Keep videos under 30 seconds for social, 60 seconds for landing pages.",
  },
]

export function VideoStudio() {
  const [selectedTemplate, setSelectedTemplate] = useState(videoTemplates[0])
  const [customPrompt, setCustomPrompt] = useState("")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"templates" | "custom">("templates")

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true)
    setError(null)
    setGeneratedImage(null)
    setGeneratedVideo(null)

    try {
      const prompt = activeTab === "templates" ? selectedTemplate.prompt : customPrompt
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: '16:9' }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image')
      }

      setGeneratedImage(data.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!generatedImage) {
      setError('Please generate an image first')
      return
    }

    setIsGeneratingVideo(true)
    setError(null)

    try {
      const prompt = activeTab === "templates" ? selectedTemplate.prompt : customPrompt
      
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageUrl: generatedImage }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video')
      }

      setGeneratedVideo(data.videoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const resetStudio = () => {
    setGeneratedImage(null)
    setGeneratedVideo(null)
    setError(null)
  }

  return (
    <section className="pt-32 pb-24 bg-background">
      {/* Hero Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 mb-6">
            <Sparkles size={16} className="text-primary" />
            <span className="text-xs tracking-widest text-primary uppercase font-medium">AI-Powered Marketing</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground mb-6 text-balance">
            Video Marketing Studio
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Generate stunning promotional videos in seconds. Our AI understands luxury service marketing 
            and creates content that resonates with high-net-worth clients.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 max-w-4xl mx-auto">
          {[
            { value: "10x", label: "Faster than traditional" },
            { value: "73%", label: "Higher engagement" },
            { value: "2.5x", label: "More leads generated" },
            { value: "24/7", label: "Always available" },
          ].map((stat, idx) => (
            <div key={idx} className="text-center p-4 bg-card border border-border">
              <p className="font-serif text-2xl md:text-3xl text-primary">{stat.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Studio Interface */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Panel - Template Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab Switcher */}
            <div className="flex bg-secondary p-1">
              <button
                onClick={() => setActiveTab("templates")}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === "templates" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Film size={16} className="inline mr-2" />
                Templates
              </button>
              <button
                onClick={() => setActiveTab("custom")}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === "custom" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wand2 size={16} className="inline mr-2" />
                Custom
              </button>
            </div>

            {activeTab === "templates" ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {videoTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template)
                      resetStudio()
                    }}
                    className={`w-full text-left p-4 border transition-all ${
                      selectedTemplate.id === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="relative w-20 h-14 flex-shrink-0 overflow-hidden bg-muted">
                        <Image
                          src={template.thumbnail}
                          alt={template.name}
                          fill
                          className="object-cover"
                        />
                        {selectedTemplate.id === template.id && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <CheckCircle2 size={20} className="text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground text-sm">{template.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Custom Video Prompt
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe your ideal marketing video... e.g., 'Professional team carefully wrapping and loading luxury furniture into a premium moving truck, soft natural lighting, cinematic quality'"
                    className="w-full h-40 px-4 py-3 bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>
                <div className="p-4 bg-secondary/50 border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Zap size={14} className="text-primary" />
                    Pro Tips for Better Results
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Include lighting details (golden hour, soft natural light)</li>
                    <li>• Mention camera movement (slow pan, aerial drone shot)</li>
                    <li>• Describe the mood (professional, luxurious, warm)</li>
                    <li>• Add quality keywords (4K, cinematic, premium)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Selected Template Details */}
            {activeTab === "templates" && (
              <div className="p-5 bg-card border border-border space-y-4">
                <div>
                  <span className="text-xs tracking-widest text-muted-foreground uppercase">Marketing Hook</span>
                  <p className="font-serif text-xl text-foreground mt-1">{selectedTemplate.marketingHook}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <span className="text-xs tracking-widest text-muted-foreground uppercase">Target</span>
                    <p className="text-sm text-foreground mt-1">{selectedTemplate.targetAudience}</p>
                  </div>
                  <div>
                    <span className="text-xs tracking-widest text-muted-foreground uppercase">CTA</span>
                    <p className="text-sm text-primary font-medium mt-1">{selectedTemplate.cta}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Preview & Generation */}
          <div className="lg:col-span-3 space-y-6">
            {/* Preview Area */}
            <div className="aspect-video bg-foreground/5 border border-border relative overflow-hidden">
              {generatedVideo ? (
                <video
                  src={generatedVideo}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
              ) : generatedImage ? (
                <Image
                  src={generatedImage}
                  alt="Generated preview"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <Video size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">Your video preview will appear here</p>
                  <p className="text-xs mt-1 opacity-70">Select a template or write a custom prompt to begin</p>
                </div>
              )}
              
              {/* Loading Overlay */}
              {(isGeneratingImage || isGeneratingVideo) && (
                <div className="absolute inset-0 bg-foreground/80 flex flex-col items-center justify-center">
                  <Loader2 size={40} className="text-primary-foreground animate-spin mb-4" />
                  <p className="text-primary-foreground font-medium">
                    {isGeneratingImage ? "Creating your image..." : "Generating video magic..."}
                  </p>
                  <p className="text-primary-foreground/70 text-sm mt-1">
                    {isGeneratingImage ? "This takes about 10 seconds" : "This may take 1-2 minutes"}
                  </p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || isGeneratingVideo || (activeTab === "custom" && !customPrompt)}
                className="flex-1 min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90 h-12"
              >
                {isGeneratingImage ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : (
                  <ImageIcon size={18} className="mr-2" />
                )}
                {isGeneratingImage ? "Generating..." : "Generate Image"}
              </Button>
              
              <Button
                onClick={handleGenerateVideo}
                disabled={!generatedImage || isGeneratingImage || isGeneratingVideo}
                className="flex-1 min-w-[200px] bg-accent text-accent-foreground hover:bg-accent/90 h-12"
              >
                {isGeneratingVideo ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : (
                  <Play size={18} className="mr-2" />
                )}
                {isGeneratingVideo ? "Creating Video..." : "Generate Video"}
              </Button>

              {(generatedImage || generatedVideo) && (
                <Button
                  onClick={resetStudio}
                  variant="outline"
                  className="h-12"
                >
                  <RefreshCw size={18} className="mr-2" />
                  Reset
                </Button>
              )}
            </div>

            {/* Download Options */}
            {(generatedImage || generatedVideo) && (
              <div className="p-5 bg-card border border-border">
                <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
                  <Download size={16} />
                  Download Your Content
                </h3>
                <div className="flex flex-wrap gap-3">
                  {generatedImage && (
                    <Button
                      onClick={() => handleDownload(generatedImage, `ai1-marketing-image-${Date.now()}.png`)}
                      variant="outline"
                      className="flex-1"
                    >
                      <ImageIcon size={16} className="mr-2" />
                      Download Image
                    </Button>
                  )}
                  {generatedVideo && (
                    <Button
                      onClick={() => handleDownload(generatedVideo, `ai1-marketing-video-${Date.now()}.mp4`)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Video size={16} className="mr-2" />
                      Download Video
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Marketing Tips */}
            <div className="grid grid-cols-2 gap-4">
              {marketingTips.map((tip, idx) => (
                <div key={idx} className="p-4 bg-secondary/30 border border-border">
                  <tip.icon size={20} className="text-primary mb-2" />
                  <h4 className="text-sm font-medium text-foreground">{tip.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{tip.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-24">
        <div className="bg-foreground text-background p-12 lg:p-16 text-center">
          <div className="inline-flex items-center gap-2 bg-background/10 px-4 py-2 mb-6">
            <Star size={16} className="text-primary" />
            <span className="text-xs tracking-widest uppercase font-medium">Premium Feature</span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl mb-4 text-balance">
            Ready to Transform Your Marketing?
          </h2>
          <p className="text-background/70 max-w-2xl mx-auto mb-8">
            These AI-generated videos are designed specifically for luxury home services marketing. 
            Use them on social media, your website, or in targeted ad campaigns to attract 
            high-net-worth clients.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8"
            >
              <a href="/#contact">
                Get Started Today
                <ArrowRight size={16} className="ml-2" />
              </a>
            </Button>
            <Button 
              asChild
              variant="outline"
              className="border-background/30 text-background hover:bg-background/10 h-12 px-8"
            >
              <a href="tel:4088728340">
                Call (408) 872-8340
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
