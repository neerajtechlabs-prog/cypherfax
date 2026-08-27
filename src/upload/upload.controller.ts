import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { Request } from 'express'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { UploadService } from './upload.service'

@Controller()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('upload')
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
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
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided. Use key "file" in form-data.')
    }

    const validation = this.uploadService.validateFile(file)
    if (!validation.valid) {
      throw new BadRequestException(validation.error)
    }

    const savedFile = await this.uploadService.saveUploadedFile(file)

    return {
      success: true,
      filename: savedFile.filename,
      type: file.mimetype,
      sizeBytes: savedFile.sizeBytes,
      fileUrl: savedFile.fileUrl,
    }
  }
}
