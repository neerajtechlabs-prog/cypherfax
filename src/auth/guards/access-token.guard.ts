import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Request } from 'express'
import { verifyAccessToken } from '../jwt'

@Injectable()
export class AccessTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { userId: string; project: string } }>()
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.')
    }

    try {
      const payload = verifyAccessToken(token)

      if (!payload.userId || !payload.project) {
        throw new UnauthorizedException('Access token payload is missing userId/project.')
      }

      req.user = {
        userId: payload.userId,
        project: payload.project,
      }
      return true
    } catch (error) {
      if (error instanceof Error && error.name === 'JwtTokenExpiredError') {
        throw new UnauthorizedException('Access token has expired.')
      }
      throw new UnauthorizedException('Invalid access token.')
    }
  }
}
