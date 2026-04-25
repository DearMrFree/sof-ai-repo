"use client"

// ══════════════════════════════════════════════════════════════════════════════
// LUX COINS - AI1 Loyalty Cryptocurrency Blockchain Ledger
// ══════════════════════════════════════════════════════════════════════════════

export type TransactionType =
  | 'signup_bonus'
  | 'quote_request'
  | 'media_upload'
  | 'service_completed'
  | 'referral_sent'
  | 'referral_converted'
  | 'review_submitted'
  | 'daily_login'
  | 'streak_bonus'
  | 'milestone_reached'
  | 'redemption'
  | 'admin_bonus'
  | 'profile_complete'
  | 'first_service'

export interface Transaction {
  id: string
  timestamp: string
  type: TransactionType
  amount: number
  balance: number
  description: string
  hash: string // Previous transaction hash for chain integrity
  metadata?: Record<string, unknown>
}

export interface LuxWallet {
  userId: string
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  currentStreak: number
  longestStreak: number
  lastLoginDate: string | null
  level: number
  xp: number
  xpToNextLevel: number
  achievements: Achievement[]
  transactions: Transaction[]
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt: string | null
  progress: number
  target: number
  luxReward: number
}

// Reward amounts for different actions
export const REWARDS: Record<TransactionType, number> = {
  signup_bonus: 500,
  quote_request: 100,
  media_upload: 50,
  service_completed: 1000,
  referral_sent: 25,
  referral_converted: 500,
  review_submitted: 200,
  daily_login: 10,
  streak_bonus: 50,       // Per day of streak
  milestone_reached: 250,
  redemption: 0,          // Variable (negative)
  admin_bonus: 0,         // Variable
  profile_complete: 150,
  first_service: 300,
}

// Level thresholds
const LEVEL_XP = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000]

// Achievement definitions
const ACHIEVEMENTS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  { id: 'first_quote', name: 'First Steps', description: 'Request your first quote', icon: '🎯', target: 1, luxReward: 50 },
  { id: 'five_quotes', name: 'Frequent Flyer', description: 'Submit 5 service requests', icon: '✈️', target: 5, luxReward: 200 },
  { id: 'media_master', name: 'Media Master', description: 'Upload 10 photos or videos', icon: '📸', target: 10, luxReward: 150 },
  { id: 'week_streak', name: 'Dedicated', description: 'Login 7 days in a row', icon: '🔥', target: 7, luxReward: 100 },
  { id: 'month_streak', name: 'Loyal Customer', description: 'Login 30 days in a row', icon: '👑', target: 30, luxReward: 500 },
  { id: 'first_referral', name: 'Ambassador', description: 'Refer your first friend', icon: '🤝', target: 1, luxReward: 100 },
  { id: 'five_referrals', name: 'Influencer', description: 'Successfully refer 5 clients', icon: '⭐', target: 5, luxReward: 750 },
  { id: 'first_review', name: 'Voice Heard', description: 'Submit your first review', icon: '💬', target: 1, luxReward: 75 },
  { id: 'lux_1000', name: 'Rising Star', description: 'Earn 1,000 Lux Coins', icon: '🌟', target: 1000, luxReward: 100 },
  { id: 'lux_5000', name: 'Elite Member', description: 'Earn 5,000 Lux Coins', icon: '💎', target: 5000, luxReward: 500 },
  { id: 'lux_10000', name: 'Platinum Status', description: 'Earn 10,000 Lux Coins', icon: '🏆', target: 10000, luxReward: 1000 },
  { id: 'service_complete', name: 'Satisfied', description: 'Complete your first service', icon: '✅', target: 1, luxReward: 200 },
]

// Generate a simple hash for blockchain simulation
function generateHash(prevHash: string, data: string): string {
  let hash = 0
  const str = prevHash + data + Date.now().toString()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}

// In-memory storage (simulates blockchain)
const WALLETS: Map<string, LuxWallet> = new Map()

// Initialize default wallets for test users
function initializeWallet(userId: string): LuxWallet {
  const achievements: Achievement[] = ACHIEVEMENTS.map(a => ({
    ...a,
    unlockedAt: null,
    progress: 0,
  }))
  
  const genesisTransaction: Transaction = {
    id: `tx-${userId}-genesis`,
    timestamp: new Date().toISOString(),
    type: 'signup_bonus',
    amount: REWARDS.signup_bonus,
    balance: REWARDS.signup_bonus,
    description: 'Welcome bonus for joining AI1',
    hash: generateHash('0000000000000000', userId),
  }

  return {
    userId,
    balance: REWARDS.signup_bonus,
    lifetimeEarned: REWARDS.signup_bonus,
    lifetimeRedeemed: 0,
    currentStreak: 1,
    longestStreak: 1,
    lastLoginDate: new Date().toISOString().split('T')[0],
    level: 1,
    xp: 50,
    xpToNextLevel: 100,
    achievements,
    transactions: [genesisTransaction],
  }
}

// Get or create wallet
export function getWallet(userId: string): LuxWallet {
  if (!WALLETS.has(userId)) {
    WALLETS.set(userId, initializeWallet(userId))
  }
  return WALLETS.get(userId)!
}

// Add transaction to wallet
export function addTransaction(
  userId: string,
  type: TransactionType,
  customAmount?: number,
  description?: string,
  metadata?: Record<string, unknown>
): Transaction {
  const wallet = getWallet(userId)
  const amount = customAmount ?? REWARDS[type]
  const lastTx = wallet.transactions[wallet.transactions.length - 1]
  const newBalance = wallet.balance + amount

  const transaction: Transaction = {
    id: `tx-${userId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type,
    amount,
    balance: newBalance,
    description: description ?? getDefaultDescription(type),
    hash: generateHash(lastTx.hash, `${type}-${amount}`),
    metadata,
  }

  wallet.transactions.push(transaction)
  wallet.balance = newBalance
  
  if (amount > 0) {
    wallet.lifetimeEarned += amount
    wallet.xp += Math.floor(amount / 10)
    checkLevelUp(wallet)
  } else {
    wallet.lifetimeRedeemed += Math.abs(amount)
  }

  // Check achievements
  checkAchievements(wallet, type)

  WALLETS.set(userId, wallet)
  return transaction
}

// Process daily login
export function processLogin(userId: string): { streakBonus: number; dailyBonus: number } {
  const wallet = getWallet(userId)
  const today = new Date().toISOString().split('T')[0]
  
  if (wallet.lastLoginDate === today) {
    return { streakBonus: 0, dailyBonus: 0 }
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  
  let streakBonus = 0
  const dailyBonus = REWARDS.daily_login

  if (wallet.lastLoginDate === yesterday) {
    // Continue streak
    wallet.currentStreak++
    if (wallet.currentStreak > wallet.longestStreak) {
      wallet.longestStreak = wallet.currentStreak
    }
    // Bonus based on streak length
    if (wallet.currentStreak % 7 === 0) {
      streakBonus = REWARDS.streak_bonus * 7
    } else if (wallet.currentStreak % 30 === 0) {
      streakBonus = REWARDS.streak_bonus * 30
    }
  } else {
    // Reset streak
    wallet.currentStreak = 1
  }

  wallet.lastLoginDate = today
  addTransaction(userId, 'daily_login', dailyBonus, `Day ${wallet.currentStreak} login bonus`)
  
  if (streakBonus > 0) {
    addTransaction(userId, 'streak_bonus', streakBonus, `${wallet.currentStreak}-day streak bonus!`)
  }

  WALLETS.set(userId, wallet)
  return { streakBonus, dailyBonus }
}

function getDefaultDescription(type: TransactionType): string {
  const descriptions: Record<TransactionType, string> = {
    signup_bonus: 'Welcome bonus for joining AI1',
    quote_request: 'Submitted a service request',
    media_upload: 'Uploaded media to request',
    service_completed: 'Service successfully completed',
    referral_sent: 'Sent a referral invitation',
    referral_converted: 'Referral signed up!',
    review_submitted: 'Submitted a service review',
    daily_login: 'Daily login bonus',
    streak_bonus: 'Login streak bonus',
    milestone_reached: 'Reached a milestone',
    redemption: 'Redeemed Lux Coins',
    admin_bonus: 'Bonus from AI1 team',
    profile_complete: 'Completed profile',
    first_service: 'First service bonus',
  }
  return descriptions[type]
}

function checkLevelUp(wallet: LuxWallet): void {
  while (wallet.xp >= wallet.xpToNextLevel && wallet.level < LEVEL_XP.length) {
    wallet.xp -= wallet.xpToNextLevel
    wallet.level++
    wallet.xpToNextLevel = LEVEL_XP[wallet.level] ?? wallet.xpToNextLevel * 1.5
  }
}

function checkAchievements(wallet: LuxWallet, type: TransactionType): void {
  // Update progress based on transaction type
  wallet.achievements.forEach(achievement => {
    if (achievement.unlockedAt) return // Already unlocked
    
    let newProgress = achievement.progress
    
    switch (achievement.id) {
      case 'first_quote':
      case 'five_quotes':
        if (type === 'quote_request') newProgress++
        break
      case 'media_master':
        if (type === 'media_upload') newProgress++
        break
      case 'week_streak':
      case 'month_streak':
        newProgress = wallet.currentStreak
        break
      case 'first_referral':
      case 'five_referrals':
        if (type === 'referral_converted') newProgress++
        break
      case 'first_review':
        if (type === 'review_submitted') newProgress++
        break
      case 'lux_1000':
      case 'lux_5000':
      case 'lux_10000':
        newProgress = wallet.lifetimeEarned
        break
      case 'service_complete':
        if (type === 'service_completed') newProgress++
        break
    }
    
    achievement.progress = newProgress
    
    if (achievement.progress >= achievement.target && !achievement.unlockedAt) {
      achievement.unlockedAt = new Date().toISOString()
      // Award achievement bonus (add directly to avoid recursion)
      const lastTx = wallet.transactions[wallet.transactions.length - 1]
      wallet.transactions.push({
        id: `tx-${wallet.userId}-achievement-${achievement.id}`,
        timestamp: new Date().toISOString(),
        type: 'milestone_reached',
        amount: achievement.luxReward,
        balance: wallet.balance + achievement.luxReward,
        description: `Achievement unlocked: ${achievement.name}`,
        hash: generateHash(lastTx.hash, `achievement-${achievement.id}`),
      })
      wallet.balance += achievement.luxReward
      wallet.lifetimeEarned += achievement.luxReward
    }
  })
}

// Redeem coins for discount
export function redeemCoins(userId: string, amount: number, description: string): boolean {
  const wallet = getWallet(userId)
  if (wallet.balance < amount) return false
  
  addTransaction(userId, 'redemption', -amount, description)
  return true
}

// Get leaderboard (top users by lifetime earned)
export function getLeaderboard(): { userId: string; name: string; lifetimeEarned: number; level: number }[] {
  const allWallets = Array.from(WALLETS.entries())
  return allWallets
    .map(([userId, wallet]) => ({
      userId,
      name: userId.split('@')[0],
      lifetimeEarned: wallet.lifetimeEarned,
      level: wallet.level,
    }))
    .sort((a, b) => b.lifetimeEarned - a.lifetimeEarned)
    .slice(0, 10)
}

// Format coin display
export function formatLux(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
  return amount.toLocaleString()
}

// Get level title
export function getLevelTitle(level: number): string {
  const titles = [
    'New Member',      // 1
    'Bronze',          // 2
    'Silver',          // 3
    'Gold',            // 4
    'Platinum',        // 5
    'Diamond',         // 6
    'Elite',           // 7
    'Master',          // 8
    'Grand Master',    // 9
    'Legend',          // 10
    'Mythic',          // 11
    'Transcendent',    // 12
  ]
  return titles[Math.min(level - 1, titles.length - 1)]
}
