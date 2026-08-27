export class OtpRateLimitError extends Error {
  constructor(message = 'Too many OTP attempts. Please try again later.') {
    super(message)
    this.name = 'OtpRateLimitError'
  }
}

export class OtpExpiredError extends Error {
  constructor(message = 'OTP code has expired.') {
    super(message)
    this.name = 'OtpExpiredError'
  }
}

export class OtpMaxAttemptsError extends Error {
  constructor(message = 'Maximum OTP attempts reached.') {
    super(message)
    this.name = 'OtpMaxAttemptsError'
  }
}

export class OtpInvalidCodeError extends Error {
  constructor(message = 'Invalid OTP code.') {
    super(message)
    this.name = 'OtpInvalidCodeError'
  }
}

export class InvalidContactError extends Error {
  constructor(message = 'Invalid contact value.') {
    super(message)
    this.name = 'InvalidContactError'
  }
}

export class JwtTokenExpiredError extends Error {
  constructor(message = 'JWT token has expired.') {
    super(message)
    this.name = 'JwtTokenExpiredError'
  }
}

export class JwtTokenInvalidError extends Error {
  constructor(message = 'JWT token is invalid.') {
    super(message)
    this.name = 'JwtTokenInvalidError'
  }
}

export class JwtKeyReadError extends Error {
  constructor(message = 'Unable to read JWT signing key.') {
    super(message)
    this.name = 'JwtKeyReadError'
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}
