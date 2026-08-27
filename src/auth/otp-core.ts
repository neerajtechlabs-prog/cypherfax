import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'

export function generateOtp(length = 6): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('OTP length must be a positive integer.')
  }

  const digits = Array.from({ length }, () => randomInt(0, 10).toString()).join('')
  return digits
}

export function hashOtp(code: string): string {
  return bcrypt.hashSync(code, 10)
}

export async function verifyOtpHash(input: string, hashedOtp: string): Promise<boolean> {
  return bcrypt.compare(input, hashedOtp)
}

export function detectContactType(contact: string): 'email' | 'phone' | 'invalid' {
  const trimmed = contact.trim()

  if (!trimmed) return 'invalid'

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
  if (emailRegex.test(trimmed)) return 'email'

  const normalizedPhone = trimmed.replace(/\s+/g, '')
  const phoneRegex = /^\+?\d{8,15}$/
  if (phoneRegex.test(normalizedPhone)) return 'phone'

  return 'invalid'
}

export function normalizeContact(contact: string, type: 'email' | 'phone'): string {
  const trimmed = contact.trim()
  if (type === 'email') return trimmed.toLowerCase()
  return trimmed.replace(/\s+/g, '')
}
