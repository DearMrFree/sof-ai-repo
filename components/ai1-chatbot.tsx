"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage } from "ai"
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, User, ChevronDown, Phone, ExternalLink, LogIn, ArrowRight, Maximize2, Minimize2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"

function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function getToolResults(message: UIMessage): Array<{ action?: string; path?: string; phone?: string; phoneRaw?: string; message?: string }> {
  if (!message.parts || !Array.isArray(message.parts)) return []
  return message.parts
    .filter((p): p is { type: "tool-invocation"; toolInvocation: { state: string; result?: unknown } } => 
      p.type === "tool-invocation" && p.toolInvocation?.state === "output-available"
    )
    .map((p) => p.toolInvocation.result as { action?: string; path?: string; phone?: string; phoneRaw?: string; message?: string })
    .filter(Boolean)
}

const SUGGESTED_QUESTIONS = [
  "What services do you offer?",
  "Take me to get a quote",
  "How do I create an account?",
  "I want to speak with someone",
]

export function AI1Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [hasInteracted, setHasInteracted] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ action: string; path?: string; phone?: string; phoneRaw?: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { openLoginModal } = useAuth()

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Lock body scroll when chat is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen, isMobile])

  // Check for actions in messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "assistant") {
        const toolResults = getToolResults(lastMessage)
        for (const result of toolResults) {
          if (result?.action) {
            setPendingAction(result as { action: string; path?: string; phone?: string; phoneRaw?: string })
          }
        }
      }
    }
  }, [messages])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current && !isMobile) {
      inputRef.current.focus()
    }
  }, [isOpen, isMobile])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    setHasInteracted(true)
    setPendingAction(null)
    sendMessage({ text: input })
    setInput("")
  }

  const handleSuggestionClick = (question: string) => {
    setHasInteracted(true)
    setPendingAction(null)
    sendMessage({ text: question })
  }

  const executeAction = () => {
    if (!pendingAction) return

    if (pendingAction.action === 'navigate' && pendingAction.path) {
      router.push(pendingAction.path)
      setIsOpen(false)
    } else if (pendingAction.action === 'openLogin') {
      openLoginModal()
      setIsOpen(false)
    } else if (pendingAction.action === 'call' && pendingAction.phoneRaw) {
      window.location.href = `tel:${pendingAction.phoneRaw}`
    }

    setPendingAction(null)
  }

  return (
    <>
      {/* Chat Toggle Button - Larger touch target on mobile */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center group safe-bottom"
            aria-label="Open chat with AI1 Assistant"
          >
            <div className="relative">
              <MessageSquare size={isMobile ? 22 : 26} className="group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window - Full screen on mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            transition={{ type: isMobile ? "tween" : "spring", damping: 25, stiffness: 300, duration: isMobile ? 0.3 : undefined }}
            className={`fixed z-50 bg-background flex flex-col overflow-hidden ${
              isMobile 
                ? "inset-0 mobile-full-height" 
                : "bottom-6 right-6 w-[420px] h-[650px] max-w-[calc(100vw-3rem)] max-h-[85vh] border border-border shadow-2xl"
            }`}
          >
            {/* Header */}
            <div className="bg-foreground text-background px-4 sm:px-5 py-4 flex items-center justify-between flex-shrink-0 safe-top">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary/20 rounded-full flex items-center justify-center">
                  <Sparkles size={isMobile ? 20 : 22} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-medium">AI1 Assistant</h3>
                  <p className="text-[11px] sm:text-xs text-background/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
                    Online — Here to help
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 sm:w-9 sm:h-9 hover:bg-background/10 flex items-center justify-center transition-colors rounded-full touch-target active-scale"
                aria-label="Close chat"
              >
                <X size={isMobile ? 22 : 20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-muted/20 scroll-touch no-overscroll">
              {/* Welcome Message */}
              {messages.length === 0 && (
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-primary/10 flex items-center justify-center flex-shrink-0 rounded-full">
                      <Bot size={isMobile ? 16 : 18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-background border border-border p-4 sm:p-5 shadow-sm">
                        <p className="text-sm leading-relaxed font-medium text-foreground">
                          Welcome to All In One!
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground mt-2">
                          I can help you navigate, answer questions, or connect you with our team.
                        </p>
                        <ul className="mt-3 space-y-2 text-sm">
                          {[
                            "Navigate to any page",
                            "Answer service questions",
                            "Help you get a quote",
                            "Connect with our team",
                          ].map((item, i) => (
                            <li key={i} className="flex items-center gap-2.5 text-muted-foreground">
                              <ArrowRight size={12} className="text-primary flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Questions - Larger touch targets on mobile */}
                  {!hasInteracted && (
                    <div className="space-y-3 pl-11 sm:pl-12">
                      <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Try asking:</p>
                      <div className="flex flex-col sm:flex-wrap sm:flex-row gap-2">
                        {SUGGESTED_QUESTIONS.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(question)}
                            className="text-sm sm:text-xs px-4 py-3 sm:py-2 bg-background border border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left touch-target active-scale"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((message) => {
                const text = getMessageText(message)
                const isUser = message.role === "user"

                if (!text) return null

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0 rounded-full ${
                        isUser ? "bg-primary" : "bg-primary/10"
                      }`}
                    >
                      {isUser ? (
                        <User size={14} className="text-primary-foreground" />
                      ) : (
                        <Bot size={14} className="text-primary" />
                      )}
                    </div>
                    <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
                      <div
                        className={`inline-block p-3 sm:p-4 text-sm leading-relaxed ${
                          isUser
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                            : "bg-background border border-border shadow-sm"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{text}</div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {/* Action Buttons - Larger on mobile */}
              {pendingAction && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 pl-11 sm:pl-12"
                >
                  <button
                    onClick={executeAction}
                    className="flex items-center gap-2 px-5 py-3 sm:px-4 sm:py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors touch-target active-scale"
                  >
                    {pendingAction.action === 'navigate' && <ExternalLink size={16} />}
                    {pendingAction.action === 'openLogin' && <LogIn size={16} />}
                    {pendingAction.action === 'call' && <Phone size={16} />}
                    {pendingAction.action === 'navigate' && 'Go there now'}
                    {pendingAction.action === 'openLogin' && 'Open Sign In'}
                    {pendingAction.action === 'call' && `Call ${pendingAction.phone}`}
                  </button>
                </motion.div>
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-primary/10 flex items-center justify-center flex-shrink-0 rounded-full">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <div className="bg-background border border-border p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Optimized for mobile */}
            <form
              onSubmit={handleSubmit}
              className="p-3 sm:p-4 border-t border-border bg-background flex-shrink-0 safe-bottom"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3.5 sm:py-3 bg-muted/50 border border-border text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 sm:w-11 sm:h-11 bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-target active-scale"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              
              {/* Quick Actions on Mobile */}
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { router.push('/quote'); setIsOpen(false) }}
                  className="text-xs text-primary font-medium flex items-center gap-1.5 py-2 px-1 touch-target active-scale"
                >
                  <ArrowRight size={12} />
                  Get a Quote
                </button>
                <button
                  type="button"
                  onClick={() => window.location.href = 'tel:4088728340'}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 px-1 touch-target"
                >
                  <Phone size={12} />
                  <span>(408) 872-8340</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
