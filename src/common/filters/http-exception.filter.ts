import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { error: 'Internal server error', details: (exception as Error)?.message ?? 'Unknown error' }

    response.status(status).json({
      ...(typeof errorResponse === 'object' && errorResponse !== null ? errorResponse : { error: String(errorResponse) }),
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
