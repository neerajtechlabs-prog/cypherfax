export type OtpSmsDeliveryResult = {
  success: boolean
  channel: 'flow' | 'direct' | 'none'
  error?: string
}

function getMsg91Headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function tryFlowSend(
  phoneNumber: string,
  otp: string,
  expiryMinutes: number,
): Promise<{ ok: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY
  const flowId = process.env.MSG91_FLOW_ID

  if (!authKey || !flowId) {
    return {
      ok: false,
      error: 'MSG91_AUTH_KEY and MSG91_FLOW_ID must be configured.',
    }
  }

  try {
    const response = await fetch('https://api.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        ...getMsg91Headers(),
        authkey: authKey,
      },
      body: JSON.stringify({
        flow_id: flowId,
        sender: 'CYPHERFAX',
        mobiles: phoneNumber,
        message: `Your CypherFax OTP is ${otp}. It expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}.`,
      }),
    })

    const responseText = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        error: `MSG91 flow failed with ${response.status}: ${responseText}`,
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown MSG91 flow error',
    }
  }
}

async function tryDirectSend(
  phoneNumber: string,
  otp: string,
  expiryMinutes: number,
): Promise<{ ok: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY
  const route = process.env.MSG91_ROUTE
  const routeId = process.env.MSG91_ROUTE_ID

  if (!authKey || !route || !routeId) {
    return {
      ok: false,
      error: 'MSG91_AUTH_KEY, MSG91_ROUTE, and MSG91_ROUTE_ID must be configured.',
    }
  }

  const params = new URLSearchParams({
    authkey: authKey,
    mobiles: phoneNumber,
    message: `Your CypherFax OTP is ${otp}. It expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}.`,
    route,
    route_id: routeId,
    sender: 'CYPHERFAX',
  })

  try {
    const response = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    const responseText = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        error: `MSG91 direct send failed with ${response.status}: ${responseText}`,
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown MSG91 direct send error',
    }
  }
}

export async function sendOtpSms(
  phoneNumber: string,
  otp: string,
  expiryMinutes: number,
): Promise<OtpSmsDeliveryResult> {
  const flowResult = await tryFlowSend(phoneNumber, otp, expiryMinutes)
  if (flowResult.ok) {
    return { success: true, channel: 'flow' }
  }

  const directResult = await tryDirectSend(phoneNumber, otp, expiryMinutes)
  if (directResult.ok) {
    return { success: true, channel: 'direct' }
  }

  const combinedError = [flowResult.error, directResult.error].filter(Boolean).join(' | ')

  console.warn('[MSG91 OTP DELIVERY FAILED]', combinedError)

  return {
    success: false,
    channel: 'none',
    error: combinedError || 'OTP SMS delivery failed.',
  }
}
