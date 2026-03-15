import type { LucideIcon } from 'lucide-react'

export type SalesLead = {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  status: LeadStatus
  source: LeadSource
  assignedTo?: User
  value: number
  priority: LeadPriority
  lastContactDate?: Date
  nextFollowUpDate?: Date
  notes?: string
  industry: string
  location: string
  createdAt: Date
  updatedAt: Date
}

export type User = {
  id: string
  name: string
  picture: string
}

export type LeadStatus = {
  id: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  name: string
  order: number
  icon: LucideIcon
  color: string
}

export type LeadSource = {
  id: string
  name: string
  color: string
}

export type LeadPriority = {
  id: 'low' | 'medium' | 'high' | 'urgent'
  name: string
  color: string
}

// Keep the old types for backward compatibility
export type Issue = SalesLead
export type IssueStatus = LeadStatus
export type IssueLabel = LeadSource
