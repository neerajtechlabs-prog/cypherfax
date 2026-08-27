import { Injectable } from '@nestjs/common'

export const PLANS = {
  basic: {
    name: 'Basic',
    priceUsd: 5.99,
    includedPages: 2,
    hasDedicatedNumber: false,
  },
  standard: {
    name: 'Standard',
    priceUsd: 9.99,
    includedPages: 4,
    hasDedicatedNumber: true,
  },
  pro: {
    name: 'Pro',
    priceUsd: 19.99,
    includedPages: 6,
    hasDedicatedNumber: true,
  },
} as const

export type PlanId = keyof typeof PLANS

@Injectable()
export class PlansService {
  getPlans() {
    return PLANS
  }

  getPlan(planId: string) {
    return PLANS[planId as PlanId]
  }

  isPlanId(planId: string): planId is PlanId {
    return planId === 'basic' || planId === 'standard' || planId === 'pro'
  }
}
