import {
  BadRequestException,
  InternalServerErrorException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Request } from 'express'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { FaxService } from './fax.service'
import { FaxDispatchService } from './fax-dispatch/fax-dispatch.service'

@Controller('fax')
export class FaxController {
  constructor(private readonly faxService: FaxService) {}

  @Post('upload-and-send')
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException(`Invalid file type: ${file.mimetype}`), false)
        }
        cb(null, true)
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async uploadAndSend(
    @Req() req: Request & { user?: { userId: string; project: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string>,
  ) {
    if (!req.user) {
      throw new BadRequestException('Unauthorized.')
    }

    const toNumber = body.toNumber
    const planId = body.planId ?? 'basic'
    const origin = req.protocol + '://' + req.get('host')

    return this.faxService.uploadAndSend(file, toNumber, planId, req.user.userId, origin)
  }

  @Post('send')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async send(
    @Req() req: Request & { user?: { userId: string; project: string } },
    @Body() body: { fileUrl?: string; toNumber?: string },
  ) {
    if (!req.user) {
      throw new BadRequestException('Unauthorized.')
    }

    try {
      return await this.faxService.sendFaxFromUrl(body.fileUrl ?? '', body.toNumber ?? '')
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new InternalServerErrorException({
        error: 'Fax send failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
