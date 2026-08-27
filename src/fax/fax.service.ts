import { Injectable, BadRequestException, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { UploadService } from '../upload/upload.service'
import { UsageService } from '../usage/usage.service'
import { PlansService } from '../plans/plans.service'
import { FaxDispatchService } from './fax-dispatch/fax-dispatch.service'
import { PDFDocument } from 'pdf-lib'
import 'multer'

@Injectable()
export class FaxService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly usageService: UsageService,
    private readonly plansService: PlansService,
    private readonly faxDispatchService: FaxDispatchService,
  ) {}

  async getPageCount(fileBuffer: Buffer, mimeType: string): Promise<number> {
    if (mimeType === 'application/pdf') {
      const pdfDocument = await PDFDocument.load(fileBuffer)
      return pdfDocument.getPageCount()
    }

    if (mimeType.startsWith('image/')) {
      return 1
    }

    throw new Error('Unsupported file type for page counting')
  }

  async uploadAndSend(file: Express.Multer.File, toNumber: string, planId: string, userId: string, origin: string) {
    if (!file) {
      throw new BadRequestException('No file provided. Use key "file" in form-data.')
    }

    if (!toNumber?.trim()) {
      throw new BadRequestException('No destination number provided. Use key "toNumber" in form-data.')
    }

    if (!this.plansService.isPlanId(planId)) {
      throw new BadRequestException('Invalid plan ID. Use "basic", "standard", or "pro".')
    }

    const validation = this.uploadService.validateFile(file)
    if (!validation.valid) {
      throw new BadRequestException(validation.error)
    }

    const fileBuffer = Buffer.from(file.buffer)
    const pagesNeeded = await this.getPageCount(fileBuffer, file.mimetype)
    const usage = await this.usageService.getOrCreateUser(userId, planId)
    const usageLimit = await this.usageService.checkUsageLimit(userId, pagesNeeded)

    if (!usageLimit.allowed) {
      throw new HttpException(usageLimit.reason, HttpStatus.PAYMENT_REQUIRED)
    }

    const savedFile = await this.uploadService.saveUploadedFile(file)
    const fullFileUrl = new URL(savedFile.fileUrl, origin).toString()

    let fax
    try {
      fax = await this.faxDispatchService.sendFax({ fileUrl: fullFileUrl, toNumber })
    } catch (error) {
      throw new InternalServerErrorException((error as Error)?.message ?? 'Fax sending failed')
    }

    let pagesUsed = usage.pagesUsedThisMonth
    let remainingPages = usageLimit.remainingPages
    if (fax.status !== 'failed') {
      const updatedUsage = await this.usageService.recordUsage(userId, pagesNeeded)
      pagesUsed = updatedUsage.pagesUsedThisMonth
      remainingPages = Math.max(usageLimit.remainingPages - pagesNeeded, 0)

      try {
        await unlink(join(process.cwd(), 'public', 'uploads', savedFile.filename))
      } catch (error) {
        console.warn(`[FAX CLEANUP] Could not delete ${savedFile.filename}`, error)
      }
    }

    return {
      upload: {
        filename: savedFile.filename,
        type: file.mimetype,
        sizeBytes: savedFile.sizeBytes,
        fileUrl: fullFileUrl,
      },
      fax,
      pagesUsed,
      remainingPages,
    }
  }

}
