import * as nodemailer from 'nodemailer'

export async function sendOtpEmail(
  to: string,
  otp: string,
  expiryMinutes: number,
): Promise<void> {
  const emailUser = process.env.EMAIL_USER
  const emailAppPassword = process.env.EMAIL_APP_PASSWORD

  if (!emailUser || !emailAppPassword) {
    throw new Error('EMAIL_USER and EMAIL_APP_PASSWORD must be configured.')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailAppPassword,
    },
  })

  await transporter.sendMail({
    from: emailUser,
    to,
    subject: 'Your CypherFax OTP code',
    text: `Your CypherFax OTP is ${otp}. It expires in ${expiryMinutes} minutes.`,
    html: `
      <div style="font-family: sans-serif;">
        <h2>Your CypherFax OTP</h2>
        <p>Your one-time code is:</p>
        <p><strong style="font-size: 24px; letter-spacing: 0.2em;">${otp}</strong></p>
        <p>This code expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}.</p>
      </div>
    `,
  })
}
