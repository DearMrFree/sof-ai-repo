"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  LogOut, Search, ChevronRight, X, Clock, CheckCircle2,
  AlertCircle, Loader2, Plus, Building2, User, ArrowLeft,
  Settings, Bell, Coins, Gift, Camera, Share2, MessageSquare,
  Calendar, MapPin, FileText, Sparkles, Crown, TrendingUp
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getClientRequests, type ServiceRequest } from "@/lib/mock-requests"
import { getWallet, processLogin, addTransaction, getLeaderboard, formatLux, getLevelTitle } from "@/lib/lux-coins"
import {
  LuxBalanceCard,
  LevelProgressCard,
  StreakBadge,
  AchievementsGrid,
  TransactionHistory,
  RewardsPanel,
  Leaderboard,
  QuickEarnActions,
} from "@/components/lux-coin-components"

const STATUS_CONFIG = {
  pending:     { label: "Pending Review", color: "text-amber-700 bg-amber-50 border-amber-200",   icon: Clock },
  reviewed:    { label: "Under Review",   color: "text-blue-700 bg-blue-50 border-blue-200",      icon: AlertCircle },
  "in-progress": { label: "In Progress", color: "text-violet-700 bg-violet-50 border-violet-200", icon: Loader2 },
  completed:   { label: "Completed",      color: "text-green-700 bg-green-50 border-green-200",   icon: CheckCircle2 },
} as const

type Tab = 'overview' | 'requests' | 'rewards' | 'achievements'

export default function ClientPortalPage() {
  const { user, openLogin, logout } = useAuth()
  const router = useRouter()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [selected, setSelected] = useState<ServiceRequest | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [wallet, setWallet] = useState<ReturnType<typeof getWallet> | null>(null)
  const [loginBonus, setLoginBonus] = useState<{ daily: number; streak: number } | null>(null)
  const [showBonusModal, setShowBonusModal] = useState(false)

  // Redirect non-client users and process login
  useEffect(() => {
    if (!user) {
      openLogin()
      return
    }
    if (user.type === "admin") {
      router.replace("/admin")
      return
    }
    
    // Get wallet and process daily login
    const userWallet = getWallet(user.id)
    const bonus = processLogin(user.id)
    setWallet(getWallet(user.id)) // Refresh after login processing
    setRequests(getClientRequests(user.email))
    
    if (bonus.dailyBonus > 0) {
      setLoginBonus({ daily: bonus.dailyBonus, streak: bonus.streakBonus })
      setShowBonusModal(true)
    }
  }, [user, router, openLogin])

  const filtered = requests.filter(r => {
    const matchSearch = r.service.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleQuickAction = (action: string) => {
    if (action === 'quote') {
      router.push('/quote')
    }
  }

  if (!user || user.type === "admin" || !wallet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your portal...</p>
        </div>
      </div>
    )
  }

  const TypeIcon = user.type === "corporation" ? Building2 : User

  return (
    <div className="min-h-screen bg-secondary/30">

      {/* Login Bonus Modal */}
      {showBonusModal && loginBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={() => setShowBonusModal(false)} />
          <div className="relative bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 text-white p-8 max-w-sm w-full text-center animate-scale-up">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-20 h-20 border-2 border-white rounded-full" />
              <div className="absolute bottom-4 left-4 w-16 h-16 border border-white rounded-full" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins size={32} className="text-yellow-300" />
              </div>
              <h2 className="font-serif text-2xl mb-2">Welcome Back!</h2>
              <p className="text-yellow-200/80 text-sm mb-6">
                Day {wallet.currentStreak} of your streak
              </p>
              <div className="bg-black/20 p-4 mb-6">
                <p className="text-yellow-200/60 text-xs uppercase tracking-wider mb-1">You earned</p>
                <p className="font-serif text-4xl text-yellow-300">
                  +{loginBonus.daily + loginBonus.streak}
                </p>
                <p className="text-yellow-200/60 text-sm">Lux Coins</p>
              </div>
              {loginBonus.streak > 0 && (
                <p className="text-yellow-200 text-sm mb-4">
                  Including {loginBonus.streak} streak bonus!
                </p>
              )}
              <button
                onClick={() => setShowBonusModal(false)}
                className="w-full py-3 bg-yellow-400 text-amber-900 font-medium hover:bg-yellow-300 transition-colors"
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="bg-background border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors touch-target">
            <ArrowLeft size={16} />
            <span className="text-sm hidden sm:inline">Back</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary flex items-center justify-center">
              <div className="w-3.5 h-3.5 border border-primary" />
            </div>
            <span className="font-serif text-base tracking-wide hidden sm:block">My Portal</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Lux Balance Quick View */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-200">
              <Coins size={14} className="text-amber-600" />
              <span className="font-medium text-amber-900 text-sm">{formatLux(wallet.balance)}</span>
            </div>
            
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-target relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>
            
            <button
              onClick={() => { logout(); router.push("/") }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 border border-border hover:border-primary/50 touch-target"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Profile Header */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="font-serif text-3xl sm:text-4xl text-primary-foreground">
                  {user.name.charAt(0)}
                </span>
              </div>
              {/* Level badge */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center border-2 border-background">
                <span className="font-bold text-xs text-amber-900">{wallet.level}</span>
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TypeIcon size={14} className="text-primary" />
                <span className="text-xs tracking-widest uppercase text-primary">
                  {user.type === "corporation" ? "Corporate" : "Private"} Client
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">
                {user.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {user.company && <span>{user.company}</span>}
                <span className="flex items-center gap-1">
                  <Crown size={12} className="text-amber-500" />
                  {getLevelTitle(wallet.level)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp size={12} />
                  {formatLux(wallet.lifetimeEarned)} LUX earned
                </span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Link
                href="/quote"
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors touch-target"
              >
                <Plus size={14} />
                <span>New Request</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-background border-b border-border sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'overview' as Tab, label: 'Overview', icon: User },
              { id: 'requests' as Tab, label: 'Requests', icon: FileText },
              { id: 'rewards' as Tab, label: 'Rewards', icon: Gift },
              { id: 'achievements' as Tab, label: 'Achievements', icon: Sparkles },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors touch-target ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lux Balance Card */}
              <LuxBalanceCard wallet={wallet} />
              
              {/* Quick Earn */}
              <QuickEarnActions onAction={handleQuickAction} />
              
              {/* Level Progress */}
              <LevelProgressCard wallet={wallet} />
              
              {/* Recent Requests */}
              <div className="bg-background border border-border">
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <h3 className="font-serif text-lg text-foreground">Recent Requests</h3>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight size={14} />
                  </button>
                </div>
                {requests.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm mb-4">No requests yet</p>
                    <Link
                      href="/quote"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
                    >
                      <Plus size={14} />
                      Submit Your First Request
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {requests.slice(0, 3).map(req => {
                      const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                      const StatusIcon = cfg.icon
                      return (
                        <button
                          key={req.id}
                          onClick={() => { setSelected(req); setActiveTab('requests') }}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{req.service}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border ${cfg.color}`}>
                            <StatusIcon size={10} />
                            {cfg.label}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Streak */}
              <StreakBadge streak={wallet.currentStreak} longestStreak={wallet.longestStreak} />
              
              {/* Recent Transactions */}
              <TransactionHistory transactions={wallet.transactions} />
              
              {/* Leaderboard */}
              <Leaderboard entries={getLeaderboard()} currentUserId={user.id} />
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="bg-background border border-border">
            {/* Table header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 border-b border-border">
              <h2 className="font-serif text-xl text-foreground">Service Requests</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-9 pr-4 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors w-full sm:w-48 touch-target"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors touch-target"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Under Review</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <Link
                  href="/quote"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors whitespace-nowrap touch-target"
                >
                  <Plus size={14} />
                  New Request
                </Link>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 sm:py-20 text-center">
                <FileText size={40} className="text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-serif text-xl text-muted-foreground mb-2">No requests found</p>
                <p className="text-sm text-muted-foreground mb-6">
                  {requests.length === 0
                    ? "Submit your first service request to get started."
                    : "Try adjusting your search or filter."}
                </p>
                <Link
                  href="/quote"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus size={14} />
                  Request a Service
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(req => {
                  const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                  const StatusIcon = cfg.icon
                  return (
                    <button
                      key={req.id}
                      onClick={() => setSelected(req)}
                      className="w-full flex items-center gap-4 sm:gap-5 px-5 sm:px-6 py-4 sm:py-5 hover:bg-secondary/50 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                          <p className="text-sm font-medium text-foreground">{req.service}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border ${cfg.color}`}>
                            <StatusIcon size={10} />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{req.description}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {new Date(req.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <LuxBalanceCard wallet={wallet} />
              <RewardsPanel />
            </div>
            <div className="space-y-6">
              <TransactionHistory transactions={wallet.transactions} />
              <QuickEarnActions onAction={handleQuickAction} />
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-background border border-border p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Unlocked</p>
                <p className="font-serif text-3xl text-foreground">
                  {wallet.achievements.filter(a => a.unlockedAt).length}
                </p>
              </div>
              <div className="bg-background border border-border p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">In Progress</p>
                <p className="font-serif text-3xl text-foreground">
                  {wallet.achievements.filter(a => !a.unlockedAt && a.progress > 0).length}
                </p>
              </div>
              <div className="bg-background border border-border p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Reward</p>
                <p className="font-serif text-3xl text-primary">
                  +{formatLux(wallet.achievements.reduce((sum, a) => sum + (a.unlockedAt ? a.luxReward : 0), 0))}
                </p>
              </div>
            </div>
            <AchievementsGrid achievements={wallet.achievements} />
          </div>
        )}
      </main>

      {/* Request detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-xl bg-background h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-background border-b border-border px-5 sm:px-6 py-5 flex items-center justify-between z-10">
              <h3 className="font-serif text-xl text-foreground">{selected.service}</h3>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close detail"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-target"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-6 flex-1">
              {/* Status */}
              {(() => {
                const cfg = STATUS_CONFIG[selected.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                const StatusIcon = cfg.icon
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border w-fit ${cfg.color}`}>
                    <StatusIcon size={13} />
                    {cfg.label}
                  </span>
                )
              })()}

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Description</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
                </div>
                {selected.address && (
                  <div>
                    <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Property Address</p>
                    <p className="text-sm text-foreground leading-relaxed">{selected.address}</p>
                  </div>
                )}
              </div>

              {selected.additionalInfo && (
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Additional Information</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.additionalInfo}</p>
                </div>
              )}

              {selected.notes && (
                <div className="bg-primary/5 border border-primary/20 p-5">
                  <p className="text-xs tracking-widest uppercase text-primary mb-2">Advisor Notes</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.notes}</p>
                </div>
              )}

              {/* Lux earned for this request */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center">
                    <Coins size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">+100 Lux Coins</p>
                    <p className="text-xs text-amber-700">Earned for this request</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto border-t border-border pt-5 space-y-1">
                <p className="text-xs text-muted-foreground">Request ID: <span className="font-mono">{selected.id}</span></p>
                <p className="text-xs text-muted-foreground">Submitted: {new Date(selected.createdAt).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Last updated: {new Date(selected.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scale-up {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-up {
          animation: scale-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
