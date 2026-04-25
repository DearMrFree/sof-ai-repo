"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { TEST_USERS, type TestUser } from "@/lib/test-users"

interface AuthContextType {
  user: TestUser | null
  isLoginOpen: boolean
  openLogin: () => void
  openLoginModal: () => void
  closeLogin: () => void
  login: (email: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TestUser | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  const openLogin = useCallback(() => setIsLoginOpen(true), [])
  const closeLogin = useCallback(() => setIsLoginOpen(false), [])

  const login = useCallback((email: string): boolean => {
    const found = TEST_USERS[email.trim().toLowerCase()]
    if (found) {
      setUser(found)
      setIsLoginOpen(false)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoginOpen, openLogin, openLoginModal: openLogin, closeLogin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
