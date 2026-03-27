import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, locale = 'es-ES'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(time: string): string {
  return time.substring(0, 5)
}

export function generateTimeSlots(start = '09:00', end = '22:00', intervalMinutes = 60): string[] {
  const slots: string[] = []
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  let currentMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60)
    const m = currentMinutes % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    currentMinutes += intervalMinutes
  }
  return slots
}
