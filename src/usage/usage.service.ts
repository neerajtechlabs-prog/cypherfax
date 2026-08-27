import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PLANS, type PlanId } from '../plans/plans.service'

type UserUsage = {
  userId: string
  planId: string
  pagesUsedThisMonth: number
  billingCycleStart: Date
  createdAt: Date
  updatedAt: Date
}

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000

type UsageLimitResult =
  | { allowed: true; remainingPages: number }
  | { allowed: false; remainingPages: number; reason: string }

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  private isPlanId(planId: string): planId is PlanId {
    return planId === 'basic' || planId === 'standard' || planId === 'pro'
  }

  async getOrCreateUser(userId: string, planId: PlanId): Promise<UserUsage> {
    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
    })

    return this.prisma.userUsage.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        pagesUsedThisMonth: 0,
        billingCycleStart: new Date(),
      },
      update: {},
    })
  }

  async resetIfNewBillingCycle(userId: string): Promise<UserUsage | null> {
    const usage = await this.prisma.userUsage.findUnique({
      where: { userId },
    })

    if (!usage) {
      return null
    }

    const now = new Date()
    if (now.getTime() - usage.billingCycleStart.getTime() >= BILLING_CYCLE_MS) {
      return this.prisma.userUsage.update({
        where: { userId },
        data: {
          pagesUsedThisMonth: 0,
          billingCycleStart: now,
        },
      })
    }

    return usage
  }

  async checkUsageLimit(userId: string, pagesNeeded: number): Promise<UsageLimitResult> {
    await this.resetIfNewBillingCycle(userId)

    const usage = await this.prisma.userUsage.findUnique({
      where: { userId },
    })

    if (!usage) {
      throw new Error(`No usage record found for user ${userId}`)
    }

    if (!this.isPlanId(usage.planId)) {
      throw new Error(`Unknown plan ${usage.planId} for user ${userId}`)
    }

    const includedPages = PLANS[usage.planId as PlanId].includedPages
    const remainingPages = Math.max(includedPages - usage.pagesUsedThisMonth, 0)

    if (pagesNeeded <= remainingPages) {
      return { allowed: true, remainingPages }
    }

    return {
      allowed: false,
      remainingPages,
      reason: `Monthly page limit reached for your plan (${usage.pagesUsedThisMonth}/${includedPages} pages used). Upgrade your plan or wait for next billing cycle.`,
    }
  }

  async recordUsage(userId: string, pagesUsed: number): Promise<UserUsage> {
    return this.prisma.userUsage.update({
      where: { userId },
      data: {
        pagesUsedThisMonth: {
          increment: pagesUsed,
        },
      },
    })
  }
}
