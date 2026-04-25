"use client"

import { useState } from "react"
import {
  Coins, TrendingUp, Flame, Gift, Trophy, Star, ChevronRight,
  ArrowUpRight, ArrowDownRight, Clock, Sparkles, Medal, Crown
} from "lucide-react"
import { 
  formatLux, getLevelTitle, 
  type LuxWallet, type Transaction, type Achievement 
} from "@/lib/lux-coins"

// ══════════════════════════════════════════════════════════════════════════════
// LUX COIN BALANCE CARD
// ══════════════════════════════════════════════════════════════════════════════

export function LuxBalanceCard({ wallet }: { wallet: LuxWallet }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 text-white p-6 sm:p-8">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-300/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      {/* Coin pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 right-4 w-16 h-16 border-2 border-white rounded-full" />
        <div className="absolute top-8 right-8 w-12 h-12 border border-white rounded-full" />
        <div className="absolute bottom-4 left-4 w-20 h-20 border-2 border-white rounded-full" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-yellow-400/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Coins className="text-yellow-300" size={20} />
          </div>
          <div>
            <p className="text-yellow-200/80 text-xs tracking-widest uppercase">Lux Coins Balance</p>
            <p className="text-yellow-100/60 text-[10px]">AI1 Loyalty Currency</p>
          </div>
        </div>

        <div className="flex items-end gap-3 mb-6">
          <span className="font-serif text-5xl sm:text-6xl leading-none tracking-tight">
            {formatLux(wallet.balance)}
          </span>
          <span className="text-yellow-200/60 text-sm mb-1">LUX</span>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
          <div>
            <p className="text-yellow-200/60 text-[10px] uppercase tracking-wider mb-1">Lifetime</p>
            <p className="text-yellow-100 font-medium">{formatLux(wallet.lifetimeEarned)}</p>
          </div>
          <div>
            <p className="text-yellow-200/60 text-[10px] uppercase tracking-wider mb-1">Redeemed</p>
            <p className="text-yellow-100 font-medium">{formatLux(wallet.lifetimeRedeemed)}</p>
          </div>
          <div>
            <p className="text-yellow-200/60 text-[10px] uppercase tracking-wider mb-1">Streak</p>
            <div className="flex items-center gap-1">
              <Flame size={12} className="text-orange-400" />
              <p className="text-yellow-100 font-medium">{wallet.currentStreak} days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LEVEL PROGRESS CARD
// ══════════════════════════════════════════════════════════════════════════════

export function LevelProgressCard({ wallet }: { wallet: LuxWallet }) {
  const progress = (wallet.xp / wallet.xpToNextLevel) * 100

  return (
    <div className="bg-background border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
            <span className="font-serif text-xl text-primary">{wallet.level}</span>
          </div>
          <div>
            <p className="font-medium text-foreground">{getLevelTitle(wallet.level)}</p>
            <p className="text-xs text-muted-foreground">Level {wallet.level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Next Level</p>
          <p className="text-sm font-medium text-foreground">{wallet.xp}/{wallet.xpToNextLevel} XP</p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-xs text-muted-foreground mt-2 text-center">
        {wallet.xpToNextLevel - wallet.xp} XP until {getLevelTitle(wallet.level + 1)}
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STREAK BADGE
// ══════════════════════════════════════════════════════════════════════════════

export function StreakBadge({ streak, longestStreak }: { streak: number; longestStreak: number }) {
  const isHot = streak >= 7
  const isOnFire = streak >= 30

  return (
    <div className={`p-4 border ${isOnFire ? 'bg-orange-50 border-orange-200' : isHot ? 'bg-amber-50 border-amber-200' : 'bg-secondary border-border'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isOnFire ? 'bg-gradient-to-br from-orange-500 to-red-500' : 
          isHot ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 
          'bg-muted'
        }`}>
          <Flame size={18} className={isHot ? 'text-white' : 'text-muted-foreground'} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl text-foreground">{streak}</span>
            <span className="text-sm text-muted-foreground">day streak</span>
          </div>
          <p className="text-xs text-muted-foreground">Best: {longestStreak} days</p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ACHIEVEMENTS GRID
// ══════════════════════════════════════════════════════════════════════════════

export function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter(a => a.unlockedAt)
  const locked = achievements.filter(a => !a.unlockedAt)

  return (
    <div className="bg-background border border-border">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-primary" />
          <h3 className="font-serif text-lg text-foreground">Achievements</h3>
        </div>
        <span className="text-xs text-muted-foreground">{unlocked.length}/{achievements.length} unlocked</span>
      </div>
      
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {achievements.map(achievement => {
          const isUnlocked = !!achievement.unlockedAt
          const progress = Math.min((achievement.progress / achievement.target) * 100, 100)
          
          return (
            <div 
              key={achievement.id}
              className={`relative p-4 border text-center transition-all ${
                isUnlocked 
                  ? 'bg-primary/5 border-primary/30' 
                  : 'bg-secondary/50 border-border opacity-60 grayscale'
              }`}
            >
              <span className="text-2xl mb-2 block">{achievement.icon}</span>
              <p className="font-medium text-sm text-foreground mb-1">{achievement.name}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mb-2">{achievement.description}</p>
              
              {!isUnlocked && (
                <div className="mt-2">
                  <div className="h-1 bg-muted rounded-full overflow-hidden mb-1">
                    <div 
                      className="h-full bg-primary/50"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{achievement.progress}/{achievement.target}</p>
                </div>
              )}
              
              {isUnlocked && (
                <div className="absolute top-2 right-2">
                  <Star size={12} className="text-primary fill-primary" />
                </div>
              )}
              
              <p className="text-[10px] text-primary font-medium mt-2">+{achievement.luxReward} LUX</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION HISTORY
// ══════════════════════════════════════════════════════════════════════════════

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayedTxs = showAll ? transactions : transactions.slice(-10).reverse()

  return (
    <div className="bg-background border border-border">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <h3 className="font-serif text-lg text-foreground">Transaction History</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">Blockchain Ledger</span>
      </div>
      
      <div className="divide-y divide-border max-h-96 overflow-y-auto scrollbar-hide">
        {displayedTxs.map(tx => (
          <div key={tx.id} className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {tx.amount > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(tx.timestamp).toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                })}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tx.amount > 0 ? '+' : ''}{formatLux(tx.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]" title={tx.hash}>
                #{tx.hash.slice(0, 8)}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {transactions.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 text-sm text-primary hover:bg-secondary/50 transition-colors border-t border-border flex items-center justify-center gap-1"
        >
          {showAll ? 'Show Less' : `View All ${transactions.length} Transactions`}
          <ChevronRight size={14} className={showAll ? 'rotate-90' : ''} />
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// REWARDS PANEL
// ══════════════════════════════════════════════════════════════════════════════

export function RewardsPanel() {
  const rewards = [
    { coins: 500, value: '$25 off', description: 'Any service' },
    { coins: 1000, value: '$50 off', description: 'Any service' },
    { coins: 2500, value: '$150 off', description: 'Premium service' },
    { coins: 5000, value: '$350 off', description: 'Any service' },
    { coins: 10000, value: 'Free Service', description: 'Up to $500 value' },
  ]

  return (
    <div className="bg-background border border-border">
      <div className="p-5 border-b border-border flex items-center gap-2">
        <Gift size={16} className="text-primary" />
        <h3 className="font-serif text-lg text-foreground">Redeem Rewards</h3>
      </div>
      
      <div className="p-5 grid gap-3">
        {rewards.map(reward => (
          <div key={reward.coins} className="flex items-center justify-between p-4 border border-border hover:border-primary/50 transition-colors group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-yellow-100 border border-amber-200 flex items-center justify-center">
                <Coins size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">{reward.value}</p>
                <p className="text-xs text-muted-foreground">{reward.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-serif text-lg text-primary">{formatLux(reward.coins)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">LUX</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════════

export function Leaderboard({ 
  entries, 
  currentUserId 
}: { 
  entries: { userId: string; name: string; lifetimeEarned: number; level: number }[]
  currentUserId: string 
}) {
  const medals = [
    { icon: Crown, color: 'text-yellow-500 bg-yellow-50' },
    { icon: Medal, color: 'text-gray-400 bg-gray-50' },
    { icon: Medal, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="bg-background border border-border">
      <div className="p-5 border-b border-border flex items-center gap-2">
        <TrendingUp size={16} className="text-primary" />
        <h3 className="font-serif text-lg text-foreground">Leaderboard</h3>
      </div>
      
      <div className="divide-y divide-border">
        {entries.map((entry, i) => {
          const isMe = entry.userId === currentUserId
          const medal = medals[i]
          const MedalIcon = medal?.icon
          
          return (
            <div 
              key={entry.userId}
              className={`px-5 py-4 flex items-center gap-4 ${isMe ? 'bg-primary/5' : ''}`}
            >
              <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${
                medal ? medal.color : 'bg-secondary text-muted-foreground'
              }`}>
                {MedalIcon ? <MedalIcon size={14} /> : <span className="text-sm font-medium">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.name} {isMe && <span className="text-primary">(You)</span>}
                </p>
                <p className="text-xs text-muted-foreground">Level {entry.level}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-serif text-lg text-foreground">{formatLux(entry.lifetimeEarned)}</p>
                <p className="text-[10px] text-muted-foreground">LUX earned</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// QUICK EARN ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

export function QuickEarnActions({ onAction }: { onAction?: (action: string) => void }) {
  const actions = [
    { id: 'quote', label: 'Request Quote', reward: 100, icon: Sparkles },
    { id: 'referral', label: 'Refer a Friend', reward: 500, icon: Gift },
    { id: 'review', label: 'Leave Review', reward: 200, icon: Star },
  ]

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-primary" />
        <h3 className="font-medium text-foreground">Quick Ways to Earn</h3>
      </div>
      
      <div className="grid sm:grid-cols-3 gap-3">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => onAction?.(action.id)}
            className="flex items-center gap-3 p-3 bg-background border border-border hover:border-primary/50 transition-all group text-left"
          >
            <div className="w-8 h-8 bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <action.icon size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-primary">+{action.reward} LUX</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
