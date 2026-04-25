// Test users for client and admin portals
export type UserType = 'individual' | 'corporation' | 'admin'

export interface TestUser {
  id: string
  email: string
  name: string
  type: UserType
  company?: string
  phone?: string
}

export const TEST_USERS: Record<string, TestUser> = {
  // Individual Clients
  'john@example.com': {
    id: 'client-001',
    email: 'john@example.com',
    name: 'John Harrington',
    type: 'individual',
    phone: '650-555-0101',
  },
  'sarah@example.com': {
    id: 'client-002',
    email: 'sarah@example.com',
    name: 'Sarah Chen',
    type: 'individual',
    phone: '650-555-0102',
  },
  'michael@example.com': {
    id: 'client-003',
    email: 'michael@example.com',
    name: 'Michael Thompson',
    type: 'individual',
    phone: '650-555-0103',
  },

  // Corporate Clients
  'contact@techventures.com': {
    id: 'corp-001',
    email: 'contact@techventures.com',
    name: 'Alex Rodriguez',
    type: 'corporation',
    company: 'Tech Ventures Inc.',
    phone: '650-555-0201',
  },
  'facilities@globalbiz.com': {
    id: 'corp-002',
    email: 'facilities@globalbiz.com',
    name: 'Jennifer Williams',
    type: 'corporation',
    company: 'Global Business Solutions',
    phone: '650-555-0202',
  },
  'admin@innovation.com': {
    id: 'corp-003',
    email: 'admin@innovation.com',
    name: 'David Park',
    type: 'corporation',
    company: 'Innovation Labs',
    phone: '650-555-0203',
  },

  // Admin Users
  'admin@ai1.com': {
    id: 'admin-001',
    email: 'admin@ai1.com',
    name: 'Admin User',
    type: 'admin',
  },
  'support@ai1.com': {
    id: 'admin-002',
    email: 'support@ai1.com',
    name: 'Support Manager',
    type: 'admin',
  },
}

export function validateTestUser(email: string): TestUser | null {
  return TEST_USERS[email] || null
}

export function getAllAdmins(): TestUser[] {
  return Object.values(TEST_USERS).filter(u => u.type === 'admin')
}

export function getAllClients(): TestUser[] {
  return Object.values(TEST_USERS).filter(u => u.type !== 'admin')
}
