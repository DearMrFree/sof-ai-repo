// Mock service request storage and management
export type RequestStatus = 'pending' | 'reviewed' | 'in-progress' | 'completed' | 'archived'

export interface ServiceRequest {
  id: string
  clientId: string
  clientEmail: string
  clientName: string
  clientType: 'individual' | 'corporation'
  company?: string
  serviceType: 'listed' | 'custom'
  service: string
  description: string
  propertyType?: string
  propertySize?: string
  timeline?: string
  phone: string
  address: string
  additionalInfo?: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
  notes?: string
  assignedTo?: string
}

// In-memory store for demo
let requestStore: ServiceRequest[] = [
  {
    id: 'req-001',
    clientId: 'client-001',
    clientEmail: 'john@example.com',
    clientName: 'John Harrington',
    clientType: 'individual',
    serviceType: 'listed',
    service: 'White-Glove Relocation',
    description: 'Moving my primary residence from San Francisco to Atherton',
    propertyType: 'Estate',
    propertySize: '10,000 sq ft',
    timeline: 'Within 30 days',
    phone: '650-555-0101',
    address: '123 Oak Street, San Francisco, CA 94102',
    status: 'reviewed',
    createdAt: '2025-04-10T10:30:00Z',
    updatedAt: '2025-04-11T14:22:00Z',
    assignedTo: 'admin-001',
  },
  {
    id: 'req-002',
    clientId: 'corp-001',
    clientEmail: 'contact@techventures.com',
    clientName: 'Alex Rodriguez',
    clientType: 'corporation',
    company: 'Tech Ventures Inc.',
    serviceType: 'listed',
    service: 'Corporate Relocation',
    description: 'Moving our headquarters to new campus in Mountain View',
    phone: '650-555-0201',
    address: '456 Enterprise Drive, Palo Alto, CA 94301',
    status: 'in-progress',
    createdAt: '2025-04-05T09:15:00Z',
    updatedAt: '2025-04-12T16:45:00Z',
    assignedTo: 'admin-001',
    notes: 'Coordinating with IT and HR. Moving 150+ employees.',
  },
  {
    id: 'req-003',
    clientId: 'client-002',
    clientEmail: 'sarah@example.com',
    clientName: 'Sarah Chen',
    clientType: 'individual',
    serviceType: 'custom',
    service: 'Antique Furniture Restoration & Transport',
    description: 'Need specialized handling for inherited antique collection. Includes appraisal, restoration, and careful transport.',
    phone: '650-555-0102',
    address: '789 Maple Avenue, Los Altos, CA 94022',
    status: 'pending',
    createdAt: '2025-04-13T11:20:00Z',
    updatedAt: '2025-04-13T11:20:00Z',
    additionalInfo: 'Collection includes 18th and 19th century pieces. Will need climate control during transport.',
  },
]

export function getRequestById(id: string): ServiceRequest | null {
  return requestStore.find(r => r.id === id) || null
}

export function getClientRequests(clientEmail: string): ServiceRequest[] {
  return requestStore.filter(r => r.clientEmail === clientEmail)
}

export function getAllRequests(): ServiceRequest[] {
  return requestStore
}

export function createRequest(
  clientId: string,
  clientEmail: string,
  clientName: string,
  clientType: 'individual' | 'corporation',
  data: Omit<ServiceRequest, 'id' | 'clientId' | 'clientEmail' | 'clientName' | 'clientType' | 'createdAt' | 'updatedAt'>
): ServiceRequest {
  const now = new Date().toISOString()
  const newRequest: ServiceRequest = {
    id: `req-${Date.now()}`,
    clientId,
    clientEmail,
    clientName,
    clientType,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    ...data,
  }
  requestStore.push(newRequest)
  return newRequest
}

export function updateRequest(id: string, updates: Partial<ServiceRequest>): ServiceRequest | null {
  const index = requestStore.findIndex(r => r.id === id)
  if (index === -1) return null
  
  const updated = {
    ...requestStore[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  requestStore[index] = updated
  return updated
}

export function getStatistics() {
  return {
    totalRequests: requestStore.length,
    pendingRequests: requestStore.filter(r => r.status === 'pending').length,
    inProgressRequests: requestStore.filter(r => r.status === 'in-progress').length,
    completedRequests: requestStore.filter(r => r.status === 'completed').length,
    individualClients: requestStore.filter(r => r.clientType === 'individual').length,
    corporateClients: requestStore.filter(r => r.clientType === 'corporation').length,
  }
}
