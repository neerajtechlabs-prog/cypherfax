import { readFileSync } from 'node:fs'
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken'
import { JwtKeyReadError, JwtTokenExpiredError, JwtTokenInvalidError } from './errors'

const DEFAULT_PRIVATE_KEY_PATH = 'keys/private.key'
const DEFAULT_PUBLIC_KEY_PATH = 'keys/public.key'
const ISSUER = 'cypherfax-auth-service'

type AccessTokenPayload = {
  userId: string
  project: string
  email?: string
  phoneNumber?: string
}

type RefreshTokenPayload = {
  userId: string
  project: string
}

function resolveKeyPath(envKey: string | undefined, fallback: string): string {
  return envKey && envKey.trim() ? envKey : fallback
}

function getPrivateKey(): string {
  const keyPath = resolveKeyPath(process.env.RSA_PRIVATE_KEY_PATH, DEFAULT_PRIVATE_KEY_PATH)
  try {
    return readFileSync(keyPath, 'utf8')
  } catch {
    throw new JwtKeyReadError(`Unable to read RSA private key from ${keyPath}`)
  }
}

function getPublicKey(): string {
  const keyPath = resolveKeyPath(process.env.RSA_PUBLIC_KEY_PATH, DEFAULT_PUBLIC_KEY_PATH)
  try {
    return readFileSync(keyPath, 'utf8')
  } catch {
    throw new JwtKeyReadError(`Unable to read RSA public key from ${keyPath}`)
  }
}

function jwtErrorToDomainError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const errorName = String((error as { name?: string }).name)
    if (errorName === 'TokenExpiredError') {
      throw new JwtTokenExpiredError()
    }
  }

  throw new JwtTokenInvalidError()
}

function buildSignOptions(expiresIn: SignOptions['expiresIn']): SignOptions {
  return {
    algorithm: 'RS256',
    issuer: ISSUER,
    expiresIn,
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getPrivateKey() as Secret, buildSignOptions('1h'))
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getPrivateKey() as Secret, buildSignOptions('7d'))
}

export function verifyAccessToken(token: string): AccessTokenPayload & JwtPayload {
  try {
    const decoded = jwt.verify(token, getPublicKey() as Secret, {
      algorithms: ['RS256'],
      issuer: ISSUER,
    }) as AccessTokenPayload & JwtPayload

    if (!decoded || typeof decoded !== 'object') {
      throw new JwtTokenInvalidError()
    }

    return decoded
  } catch (error) {
    if (error instanceof JwtTokenExpiredError || error instanceof JwtTokenInvalidError) {
      throw error
    }

    jwtErrorToDomainError(error)
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload & JwtPayload {
  try {
    const decoded = jwt.verify(token, getPublicKey() as Secret, {
      algorithms: ['RS256'],
      issuer: ISSUER,
    }) as RefreshTokenPayload & JwtPayload

    if (!decoded || typeof decoded !== 'object') {
      throw new JwtTokenInvalidError()
    }

    return decoded
  } catch (error) {
    if (error instanceof JwtTokenExpiredError || error instanceof JwtTokenInvalidError) {
      throw error
    }

    jwtErrorToDomainError(error)
  }
}
