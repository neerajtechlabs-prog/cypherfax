export interface FaxSendResult {
  id: string
  status: 'queued' | 'sending' | 'delivered' | 'failed'
  to: string
  from: string
}

export interface FaxSendParams {
  fileUrl: string
  toNumber: string
}
