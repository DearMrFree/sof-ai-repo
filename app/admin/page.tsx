"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  LogOut, Search, ChevronRight, X, Clock, CheckCircle2, AlertCircle,
  Loader2, TrendingUp, Users, Building2, ArrowLeft, Shield, Save,
  Coins, Gift, Crown, Send, BarChart3, FileText, Settings, Bell
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getAllRequests, updateRequest, getStatistics, type ServiceRequest } from "@/lib/mock-requests"
import { getWallet, addTransaction, getLeaderboard, formatLux, getLevelTitle, type LuxWallet } from "@/lib/lux-coins"
import { getAllClients, type TestUser } from "@/lib/test-users"

const STATUS_CONFIG = {
  pending:       { label: "Pending Review", color: "text-amber-700 bg-amber-50 border-amber-200",   icon: Clock },
  reviewed:      { label: "Under Review",   color: "text-blue-700 bg-blue-50 border-blue-200",      icon: AlertCircle },
  "in-progress": { label: "In Progress",    color: "text-violet-700 bg-violet-50 border-violet-200", icon: Loader2 },
  completed:     { label: "Completed",      color: "text-green-700 bg-green-50 border-green-200",   icon: CheckCircle2 },
} as const

type Tab = 'requests' | 'clients' | 'analytics'

export default function AdminPage() {
  const { user, openLogin, logout } = useAuth()
  const router = useRouter()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [selected, setSelected] = useState<ServiceRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [savedNote, setSavedNote] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('requests')
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<TestUser | null>(null)
  const [bonusAmount, setBonusAmount] = useState("")
  const [bonusReason, setBonusReason] = useState("")

  const clients = getAllClients()

  useEffect(() => {
    if (!user) { openLogin(); return }
    if (user.type !== "admin") { router.replace("/client-portal"); return }
    setRequests(getAllRequests())
  }, [user, router, openLogin])

  useEffect(() => {
    if (selected) setNotes(selected.notes ?? "")
  }, [selected])

  const refresh = () => {
    const all = getAllRequests()
    setRequests(all)
    if (selected) setSelected(all.find(r => r.id === selected.id) ?? null)
  }

  const handleStatusChange = (id: string, status: string) => {
    updateRequest(id, { status: status as ServiceRequest["status"] })
    refresh()
  }

  const handleSaveNotes = () => {
    if (!selected) return
    updateRequest(selected.id, { notes })
    refresh()
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 2000)
  }

  const handleSendBonus = () => {
    if (!selectedClient || !bonusAmount || isNaN(Number(bonusAmount))) return
    addTransaction(
      selectedClient.id,
      'admin_bonus',
      Number(bonusAmount),
      bonusReason || 'Bonus from AI1 team'
    )
    setBonusAmount("")
    setBonusReason("")
    setSelectedClient(null)
  }

  const filtered = requests.filter(r => {
    const matchSearch =
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.service.toLowerCase().includes(search.toLowerCase()) ||
      r.clientEmail.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || r.status === statusFilter
    const matchType   = typeFilter === "all"   || r.serviceType === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company?.toLowerCase().includes(clientSearch.toLowerCase()) ?? false)
  )

  const stats = getStatistics()
  const leaderboard = getLeaderboard()

  // Calculate total Lux in circulation
  const totalLuxCirculation = clients.reduce((sum, c) => {
    const wallet = getWallet(c.id)
    return sum + wallet.balance
  }, 0)

  if (!user || user.type !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/20 flex flex-col">

      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors touch-target">
            <ArrowLeft size={16} />
            <span className="text-sm hidden sm:inline">Back</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary flex items-center justify-center">
              <div className="w-3.5 h-3.5 border border-primary" />
            </div>
            <span className="font-serif text-base tracking-wide hidden sm:block">AI1 Admin</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-target relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20">
              <Shield size={14} className="text-primary" />
              <span className="text-sm text-foreground font-medium">{user.name}</span>
            </div>
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

      {/* Page heading + Stats */}
      <div className="bg-background border-b border-border">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <span className="text-xs tracking-widest uppercase text-primary">Administrator</span>
              <h1 className="font-serif text-2xl sm:text-3xl text-foreground mt-1">Dashboard</h1>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { label: "Total Requests",   value: stats.totalRequests,      icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
              { label: "Pending Review",   value: stats.pendingRequests,    icon: Clock,      color: "text-amber-600 bg-amber-50" },
              { label: "In Progress",      value: stats.inProgressRequests, icon: Loader2,    color: "text-violet-600 bg-violet-50" },
              { label: "Total Clients",    value: clients.length,           icon: Users,      color: "text-green-600 bg-green-50" },
              { label: "Lux in Circulation", value: formatLux(totalLuxCirculation), icon: Coins, color: "text-yellow-600 bg-yellow-50" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-secondary/50 border border-border p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <p className="text-[10px] sm:text-xs text-muted-foreground tracking-wide uppercase">{label}</p>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center ${color}`}>
                    <Icon size={14} />
                  </div>
                </div>
                <p className="font-serif text-2xl sm:text-3xl text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-background border-b border-border sticky top-16 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'requests' as Tab, label: 'Requests', icon: FileText },
              { id: 'clients' as Tab, label: 'Clients', icon: Users },
              { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
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

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full flex-1">

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="bg-background border border-border">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 border-b border-border">
              <h2 className="font-serif text-xl text-foreground">All Requests</h2>
              <div className="flex flex-wrap gap-2 sm:gap-3">
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
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-secondary border-b border-border">
                    {["Client", "Service", "Status", "Date", ""].map(h => (
                      <th key={h} className="px-5 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground text-sm">
                        No requests match your filters.
                      </td>
                    </tr>
                  ) : filtered.map(req => {
                    const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                    const StatusIcon = cfg.icon
                    return (
                      <tr
                        key={req.id}
                        onClick={() => setSelected(req)}
                        className="border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 sm:px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                              {req.company ? <Building2 size={12} className="text-primary" /> : <Users size={12} className="text-primary" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{req.clientName}</p>
                              <p className="text-xs text-muted-foreground truncate">{req.clientEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 sm:px-6 py-4">
                          <p className="text-foreground truncate max-w-[160px]">{req.service}</p>
                          {req.company && <p className="text-xs text-muted-foreground">{req.company}</p>}
                        </td>
                        <td className="px-5 sm:px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border ${cfg.color}`}>
                            <StatusIcon size={10} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 sm:px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-5 sm:px-6 py-4">
                          <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Client List */}
            <div className="lg:col-span-2 bg-background border border-border">
              <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-serif text-xl text-foreground">Client Directory</h2>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Search clients..."
                    className="pl-9 pr-4 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors w-full sm:w-56 touch-target"
                  />
                </div>
              </div>
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filteredClients.map(client => {
                  const wallet = getWallet(client.id)
                  return (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`w-full flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-secondary/50 transition-colors text-left ${
                        selectedClient?.id === client.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                        <span className="font-serif text-base text-primary-foreground">{client.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{client.name}</p>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px]">
                            <Crown size={10} />
                            <span>Lv.{wallet.level}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                        {client.company && <p className="text-xs text-primary">{client.company}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-amber-600">
                          <Coins size={12} />
                          <span className="font-medium text-sm">{formatLux(wallet.balance)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{client.type}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Client Detail / Bonus Panel */}
            <div className="space-y-6">
              {selectedClient ? (
                <>
                  {/* Selected Client Card */}
                  {(() => {
                    const wallet = getWallet(selectedClient.id)
                    return (
                      <div className="bg-background border border-border">
                        <div className="p-5 border-b border-border">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                              <span className="font-serif text-2xl text-primary-foreground">{selectedClient.name.charAt(0)}</span>
                            </div>
                            <div>
                              <h3 className="font-serif text-lg text-foreground">{selectedClient.name}</h3>
                              <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-secondary p-3">
                              <p className="font-serif text-xl text-foreground">{wallet.level}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">Level</p>
                            </div>
                            <div className="bg-secondary p-3">
                              <p className="font-serif text-xl text-amber-600">{formatLux(wallet.balance)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">Balance</p>
                            </div>
                            <div className="bg-secondary p-3">
                              <p className="font-serif text-xl text-foreground">{wallet.currentStreak}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">Streak</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-5">
                          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Send Bonus</p>
                          <div className="space-y-3">
                            <input
                              type="number"
                              value={bonusAmount}
                              onChange={e => setBonusAmount(e.target.value)}
                              placeholder="Amount (Lux Coins)"
                              className="w-full px-4 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                            />
                            <input
                              type="text"
                              value={bonusReason}
                              onChange={e => setBonusReason(e.target.value)}
                              placeholder="Reason (optional)"
                              className="w-full px-4 py-2.5 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                            />
                            <button
                              onClick={handleSendBonus}
                              disabled={!bonusAmount || isNaN(Number(bonusAmount))}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium hover:from-amber-600 hover:to-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send size={14} />
                              Send Bonus
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div className="bg-background border border-border p-8 text-center">
                  <Users size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Select a client to view details and send bonuses</p>
                </div>
              )}

              {/* Leaderboard */}
              <div className="bg-background border border-border">
                <div className="p-5 border-b border-border flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  <h3 className="font-serif text-lg text-foreground">Top Earners</h3>
                </div>
                <div className="divide-y divide-border">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={entry.userId} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-6 h-6 flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                      </div>
                      <p className="text-sm font-medium text-amber-600">{formatLux(entry.lifetimeEarned)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-background border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Coins size={18} className="text-amber-500" />
                <h3 className="font-medium text-foreground">Lux Economy</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total in Circulation</p>
                  <p className="font-serif text-3xl text-amber-600">{formatLux(totalLuxCirculation)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Average per Client</p>
                  <p className="font-serif text-2xl text-foreground">
                    {formatLux(Math.round(totalLuxCirculation / clients.length))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-background border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-primary" />
                <h3 className="font-medium text-foreground">Client Breakdown</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Individual</span>
                  <span className="font-medium text-foreground">
                    {clients.filter(c => c.type === 'individual').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Corporate</span>
                  <span className="font-medium text-foreground">
                    {clients.filter(c => c.type === 'corporation').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-background border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-green-500" />
                <h3 className="font-medium text-foreground">Request Status</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = requests.filter(r => r.status === key).length
                  const Icon = cfg.icon
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Detail slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-xl bg-background h-full overflow-y-auto shadow-2xl flex flex-col">

            <div className="sticky top-0 bg-background border-b border-border px-5 sm:px-6 py-5 flex items-center justify-between z-10">
              <div>
                <p className="text-xs tracking-widest uppercase text-primary mb-0.5">Request Detail</p>
                <h3 className="font-serif text-xl text-foreground">{selected.service}</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-target"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-6 flex-1">

              {/* Client */}
              <div className="bg-secondary/50 border border-border p-5">
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Client</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary flex items-center justify-center">
                    <span className="font-serif text-base text-primary-foreground">{selected.clientName.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{selected.clientName}</p>
                    <p className="text-sm text-muted-foreground">{selected.clientEmail}</p>
                    {selected.company && <p className="text-sm text-primary">{selected.company}</p>}
                  </div>
                </div>
              </div>

              {/* Service details */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Description</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
                </div>
                {selected.address && (
                  <div>
                    <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">Address</p>
                    <p className="text-sm text-foreground leading-relaxed">{selected.address}</p>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="border-t border-border pt-5">
                <label className="text-xs tracking-widest uppercase text-muted-foreground mb-2 block">
                  Update Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <button
                        key={key}
                        onClick={() => handleStatusChange(selected.id, key)}
                        className={`flex items-center gap-2 px-3 py-3 text-sm border transition-all touch-target ${
                          selected.status === key
                            ? `${cfg.color} font-medium`
                            : "border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <Icon size={13} />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-border pt-5 flex flex-col gap-3">
                <label htmlFor="admin-notes" className="text-xs tracking-widest uppercase text-muted-foreground block">
                  Advisor Notes
                </label>
                <textarea
                  id="admin-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add internal notes visible to the client..."
                  rows={4}
                  className="w-full px-4 py-3 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors resize-none"
                />
                <button
                  onClick={handleSaveNotes}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors w-fit touch-target"
                >
                  <Save size={14} />
                  {savedNote ? "Saved!" : "Save Notes"}
                </button>
              </div>

              <div className="mt-auto border-t border-border pt-5 space-y-1">
                <p className="text-xs text-muted-foreground">Request ID: <span className="font-mono">{selected.id}</span></p>
                <p className="text-xs text-muted-foreground">Submitted: {new Date(selected.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
