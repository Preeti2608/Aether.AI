import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string from the backend.
 * Backend stores naive UTC timestamps (no 'Z' suffix). We append 'Z' so
 * the browser interprets them as UTC instead of local time, which would
 * cause relative-time display to be wrong by the local UTC offset.
 */
function parseUTC(date: string | Date): Date {
  if (date instanceof Date) return date
  // If the string already has timezone info leave it alone; otherwise add Z
  if (/[Z+\-]\d*$/.test(date) || date.includes('+')) return new Date(date)
  return new Date(date + 'Z')
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(parseUTC(date), { addSuffix: true })
}

export function formatDate(date: string | Date): string {
  return format(parseUTC(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(parseUTC(date), 'MMM d, yyyy · h:mm a')
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const CATEGORY_COLORS: Record<string, string> = {
  fact: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  preference: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  project: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  learning: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  personal: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  general: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400',
}

export const COLLECTION_COLORS: Record<string, string> = {
  blue: '#6366f1',
  purple: '#a855f7',
  rose: '#f43f5e',
  amber: '#f59e0b',
  green: '#10b981',
  gray: '#6b7280',
}
