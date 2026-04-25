import type { Metadata } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AI1Chatbot } from '@/components/ai1-chatbot'
import { LoadingScreen } from '@/components/loading-screen'
import { AuthProvider } from '@/lib/auth-context'
import { LoginModal } from '@/components/login-modal'
import './globals.css'

const dmSans = DM_Sans({ 
  subsets: ["latin"],
  variable: '--font-dm-sans',
  display: 'swap',
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'All In One (AI1) Bay Area | Premium Home Services',
  description: 'Top-notch luxury moving, landscaping, hauling, and home services in Stanford and the Bay Area. White-glove service with a focus on quality and customer satisfaction.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${playfair.variable} font-sans antialiased`}>
        <AuthProvider>
          <LoadingScreen />
          <LoginModal />
          {children}
          <AI1Chatbot />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
