import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { FaxSendParams, FaxSendResult } from './fax-types'

const TELNYX_API_URL = 'https://api.telnyx.com/v2/faxes'
const ALLOWED_STATUSES: FaxSendResult['status'][] = ['queued', 'sending', 'delivered', 'failed']

@Injectable()
export class FaxDispatchService {
  constructor() {}

  async sendFaxMock(params: FaxSendParams): Promise<FaxSendResult> {
    console.log(`[MOCK] Sending fax to ${params.toNumber} with file ${params.fileUrl}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const status = Math.random() < 0.1 ? 'failed' : 'queued'

    return {
      id: `mock-${randomUUID()}`,
      status,
      to: params.toNumber,
      from: '+10000000000',
    }
  }

  async sendFaxTelnyx(params: FaxSendParams): Promise<FaxSendResult> {
    const apiKey = process.env.TELNYX_API_KEY
    const connectionId = process.env.TELNYX_FAX_CONNECTION_ID
    const fromNumber = process.env.TELNYX_FROM_NUMBER

    if (!apiKey || !connectionId || !fromNumber) {
      throw new Error('Telnyx credentials not configured - set MOCK_TELNYX=true or add credentials to .env.local')
    }

    const response = await fetch(TELNYX_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: connectionId,
        media_url: params.fileUrl,
        to: params.toNumber,
        from: fromNumber,
      }),
    })

    const responseBody = (await response.json()) as { data?: { id?: string; status?: string; to?: string; from?: string } }

    if (!response.ok || !responseBody.data?.id) {
      throw new Error(`Telnyx fax request failed (${response.status}): ${JSON.stringify(responseBody)}`)
    }

    const fax = responseBody.data
    const status = ALLOWED_STATUSES.includes(fax.status as FaxSendResult['status'])
      ? (fax.status as FaxSendResult['status'])
      : 'failed'

    return {
      id: fax.id ?? 'unknown',
      status,
      to: fax.to ?? params.toNumber,
      from: fax.from ?? fromNumber,
    }
  }

  async sendFax(params: FaxSendParams): Promise<FaxSendResult> {
    if (process.env.MOCK_TELNYX === 'true') {
      console.log('[FAX SERVICE] Using MOCK mode')
      return this.sendFaxMock(params)
    }

    console.log('[FAX SERVICE] Using LIVE Telnyx')
    return this.sendFaxTelnyx(params)
  }
}

export type { FaxSendParams, FaxSendResult } from './fax-types'
