import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { VideoStudio } from "@/components/video-studio"

export const metadata = {
  title: 'AI Video Marketing Studio | All In One (AI1)',
  description: 'Generate professional marketing videos powered by AI. Create compelling promotional content for your home services in seconds.',
}

export default function VideoStudioPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <VideoStudio />
      <Footer />
    </main>
  )
}
