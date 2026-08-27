import { Injectable } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { PrismaService } from '../prisma/prisma.service'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt'
import { detectContactType, normalizeContact, verifyOtpHash, hashOtp } from './otp-core'
import { sendOtpEmail } from './email'
import { sendOtpSms } from './sms'
// Prisma JSON typing is kept intentionally loose here to match the current runtime behavior.

const OTP_TTL_MINUTES = 10
const OTP_ATTEMPT_LIMIT = 3
const OTP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_PROJECT = 'default'

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@')
    if (!domain) return email
    const visibleStart = localPart.slice(0, 1)
    const visibleEnd = localPart.slice(-1)
    const maskedMiddle = '*'.repeat(Math.max(2, localPart.length - 2))
    return `${visibleStart}${maskedMiddle}${visibleEnd}@${domain}`
  }

  private maskPhone(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '')
    if (!digits) return phoneNumber
    const prefix = phoneNumber.startsWith('+') ? '+' : ''
    const visiblePrefix = digits.slice(0, 1)
    const visibleSuffix = digits.slice(-3)
    const maskedMiddle = '*'.repeat(Math.max(3, digits.length - 4))
    return `${prefix}${visiblePrefix}${maskedMiddle}${visibleSuffix}`
  }

  private maskDestination(contact: string, type: 'email' | 'phone') {
    return type === 'email' ? this.maskEmail(contact) : this.maskPhone(contact)
  }

  private async writeAuditLog(args: {
    action: string
    contact: string | null
    project: string
    success: boolean
    reason?: string
    details?: Record<string, unknown>
    ipAddress?: string | null
    userAgent?: string | null
  }) {
    await this.prisma.auditLog.create({
      data: {
        action: args.action,
        contact: args.contact ?? null,
        project: args.project,
        success: args.success,
        reason: args.reason ?? null,
        details: (args.details ?? null) as any,
        ipAddress: args.ipAddress ?? null,
        userAgent: args.userAgent ?? null,
      },
    })
  }

  async sendOtp(payload: { email?: string; phoneNumber?: string; project?: string }, ipAddress?: string | null, userAgent?: string | null) {
    const project = payload.project?.trim() || DEFAULT_PROJECT
    const rawEmail = payload.email?.trim() || ''
    const rawPhoneNumber = payload.phoneNumber?.trim() || ''
    const email = rawEmail || undefined
    const phoneNumber = rawPhoneNumber || undefined

    if ((!email && !phoneNumber) || (email && detectContactType(email) !== 'email') || (phoneNumber && detectContactType(phoneNumber) !== 'phone')) {
      throw Object.assign(new Error('A valid email or phoneNumber is required.'), { status: 400 })
    }

    const contact = email ? normalizeContact(email, 'email') : normalizeContact(phoneNumber!, 'phone')
    const contactType = email ? 'email' : 'phone'

    const recentCount = await this.prisma.otpCode.count({
      where: {
        contact,
        project,
        createdAt: { gte: new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS) },
      },
    })

    if (recentCount >= 3) {
      throw Object.assign(new Error('Too many OTP requests for this contact/project. Please try again later.'), { status: 429 })
    }

    const otp = String(randomInt(100000, 999999))
    const hashedOtp = hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

    const otpRecord = await this.prisma.otpCode.create({
      data: {
        contact,
        project,
        purpose: 'login',
        hashedOtp,
        attemptCount: 0,
        maxAttempts: OTP_ATTEMPT_LIMIT,
        expiresAt,
      },
    })

    try {
      if (contactType === 'email') {
        await sendOtpEmail(contact, otp, OTP_TTL_MINUTES)
      } else {
        const smsResult = await sendOtpSms(contact, otp, OTP_TTL_MINUTES)
        if (!smsResult.success) {
          throw new Error(smsResult.error ?? 'OTP SMS delivery failed.')
        }
      }

      await this.writeAuditLog({
        action: 'OTP_SENT',
        contact,
        project,
        success: true,
        details: {
          channel: contactType,
          expiresInMinutes: OTP_TTL_MINUTES,
          otpId: otpRecord.id,
        },
        ipAddress,
        userAgent,
      })

      return {
        otpId: otpRecord.id,
        destination: this.maskDestination(contact, contactType),
        expiresIn: '10m',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown delivery error.'

      await this.prisma.otpCode.delete({ where: { id: otpRecord.id } }).catch(() => undefined)

      await this.writeAuditLog({
        action: 'OTP_SEND_FAILED',
        contact,
        project,
        success: false,
        reason: errorMessage,
        details: {
          channel: contactType,
          expiresInMinutes: OTP_TTL_MINUTES,
          otpId: otpRecord.id,
        },
        ipAddress,
        userAgent,
      }).catch(() => undefined)

      throw Object.assign(new Error('Unable to send OTP. Please try again.'), { status: 500 })
    }
  }

  async verifyOtp(payload: { contact: string; otp: string; project?: string }, ipAddress?: string | null, userAgent?: string | null) {
    const project = payload.project?.trim() || DEFAULT_PROJECT
    const rawContact = payload.contact?.trim() || ''
    const otp = payload.otp?.trim() || ''

    if (!rawContact || !otp) {
      throw Object.assign(new Error('Contact and OTP are required.'), { status: 400 })
    }

    const contactType = detectContactType(rawContact)
    if (contactType === 'invalid') {
      throw Object.assign(new Error('A valid email or phone number is required.'), { status: 400 })
    }

    if (!/^\d{6}$/.test(otp)) {
      throw Object.assign(new Error('OTP must be a 6-digit numeric code.'), { status: 400 })
    }

    const contact = normalizeContact(rawContact, contactType)
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { contact, project },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      throw Object.assign(new Error('Invalid OTP.'), { status: 401 })
    }

    if (otpRecord.expiresAt <= new Date()) {
      await this.prisma.otpCode.delete({ where: { id: otpRecord.id } }).catch(() => undefined)
      throw Object.assign(new Error('OTP has expired.'), { status: 401 })
    }

    if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
      await this.prisma.otpCode.delete({ where: { id: otpRecord.id } }).catch(() => undefined)
      throw Object.assign(new Error('Maximum OTP attempts reached.'), { status: 401 })
    }

    const valid = await verifyOtpHash(otp, otpRecord.hashedOtp)
    const nextAttemptCount = otpRecord.attemptCount + 1

    if (!valid) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attemptCount: nextAttemptCount },
      })

      await this.writeAuditLog({
        action: 'OTP_VERIFICATION_FAILED',
        contact,
        project,
        success: false,
        reason: 'Invalid OTP.',
        details: {
          attemptCount: nextAttemptCount,
          maxAttempts: otpRecord.maxAttempts,
        },
        ipAddress,
        userAgent,
      })

      throw Object.assign(new Error('Invalid OTP.'), { status: 401 })
    }

    await this.prisma.otpCode.delete({ where: { id: otpRecord.id } }).catch(() => undefined)

    await this.writeAuditLog({
      action: 'OTP_VERIFIED',
      contact,
      project,
      success: true,
      details: { otpId: otpRecord.id },
      ipAddress,
      userAgent,
    })

    let user = contactType === 'email'
      ? await this.prisma.user.findUnique({ where: { email: contact } })
      : await this.prisma.user.findUnique({ where: { phone: contact } })

    if (!user) {
      user = await this.prisma.user.create({
        data: contactType === 'email' ? { email: contact } : { phone: contact },
      })
    }

    const accessToken = signAccessToken({
      userId: user.id,
      project,
      email: user.email ?? undefined,
      phoneNumber: user.phone ?? undefined,
    })
    const refreshToken = signRefreshToken({ userId: user.id, project })

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        hashedToken: await bcrypt.hash(refreshToken, 10),
        project,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: ipAddress ?? null,
        deviceInfo: userAgent ?? null,
      },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        project,
      },
    }
  }

  async googleLogin(payload: { idToken: string; project?: string }, ipAddress?: string | null, userAgent?: string | null) {
    const project = payload.project?.trim() || DEFAULT_PROJECT
    const idToken = payload.idToken?.trim() || ''

    if (!idToken) {
      throw Object.assign(new Error('idToken is required.'), { status: 400 })
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID
    if (!googleClientId) {
      throw Object.assign(new Error('Google login is not configured.'), { status: 401 })
    }

    let verifiedPayload: { email?: string; name?: string; sub?: string } | undefined
    try {
      const client = new OAuth2Client(googleClientId)
      const ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId,
      })
      verifiedPayload = ticket.getPayload() ?? undefined
    } catch {
      throw Object.assign(new Error('Google token verification failed.'), { status: 401 })
    }

    if (!verifiedPayload || !verifiedPayload.email || !verifiedPayload.sub) {
      throw Object.assign(new Error('Google token payload is invalid.'), { status: 401 })
    }

    const email = verifiedPayload.email.trim().toLowerCase()
    const googleId = verifiedPayload.sub
    const name = verifiedPayload.name?.trim() || null

    let user = await this.prisma.user.findUnique({ where: { googleId } })
    if (!user) user = await this.prisma.user.findUnique({ where: { email } })

    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name, googleId },
      })
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: name ?? user.name, googleId },
      })
    }

    const accessToken = signAccessToken({
      userId: user.id,
      project,
      email: user.email ?? undefined,
    })

    await this.writeAuditLog({
      action: 'GOOGLE_LOGIN',
      contact: email,
      project,
      success: true,
      details: {
        googleId,
        userId: user.id,
      },
      ipAddress,
      userAgent,
    })

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        googleId: user.googleId,
      },
    }
  }

  async refresh(payload: { refreshToken: string }) {
    const refreshToken = payload.refreshToken?.trim() || ''
    if (!refreshToken) {
      throw Object.assign(new Error('Refresh token is required.'), { status: 400 })
    }

    let verified: { userId: string; project: string }
    try {
      verified = verifyRefreshToken(refreshToken)
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token.'), { status: 401 })
    }

    const refreshRecords = await this.prisma.refreshToken.findMany({
      where: { userId: verified.userId, status: 'active' },
    })

    const validRecord = await Promise.all(
      refreshRecords.map(async (record: any) => ({
        record,
        matches: await bcrypt.compare(refreshToken, record.hashedToken),
      })),
    ).then((rows) => rows.find((row) => row.matches)?.record)

    if (!validRecord || validRecord.expiresAt <= new Date()) {
      throw Object.assign(new Error('Invalid or expired refresh token.'), { status: 401 })
    }

    const accessToken = signAccessToken({
      userId: validRecord.userId,
      project: validRecord.project,
    })

    return {
      accessToken,
      userId: validRecord.userId,
      project: validRecord.project,
    }
  }

  async logout(payload: { refreshToken: string }, ipAddress?: string | null, userAgent?: string | null) {
    const refreshToken = payload.refreshToken?.trim() || ''
    if (!refreshToken) {
      throw Object.assign(new Error('Refresh token is required.'), { status: 400 })
    }

    let verified: { userId: string; project: string }
    try {
      verified = verifyRefreshToken(refreshToken)
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token.'), { status: 401 })
    }

    const refreshRecords = await this.prisma.refreshToken.findMany({
      where: { userId: verified.userId, status: 'active' },
    })

    const validRecord = await Promise.all(
      refreshRecords.map(async (record: any) => ({
        record,
        matches: await bcrypt.compare(refreshToken, record.hashedToken),
      })),
    ).then((rows) => rows.find((row) => row.matches)?.record)

    if (!validRecord || validRecord.expiresAt <= new Date()) {
      throw Object.assign(new Error('Invalid or expired refresh token.'), { status: 401 })
    }

    await this.prisma.refreshToken.update({
      where: { id: validRecord.id },
      data: { status: 'revoked' },
    })

    await this.writeAuditLog({
      action: 'LOGOUT',
      contact: null,
      project: validRecord.project,
      success: true,
      details: { userId: validRecord.userId },
      ipAddress,
      userAgent,
    })

    return { success: true }
  }
}
