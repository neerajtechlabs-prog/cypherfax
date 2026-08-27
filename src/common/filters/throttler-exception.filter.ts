import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'
import { ThrottlerException } from '@nestjs/throttler'

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      error: 'Too many requests. Please try again later.',
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
