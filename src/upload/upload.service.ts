import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

type UploadFileLike = Partial<Express.Multer.File> & {
  type?: string
  size: number
  name?: string
  buffer?: Buffer
  mimetype?: string
  originalname?: string
}

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_SIZE = 10 * 1024 * 1024

@Injectable()
export class UploadService {
  validateFile(file: UploadFileLike) {
    const type = file.mimetype ?? file.type ?? ''

    if (!ALLOWED_TYPES.includes(type)) {
      return { valid: false, error: `Invalid file type: ${type}` }
    }

    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'File too large. Max 10MB.' }
    }

    return { valid: true }
  }

  async saveUploadedFile(file: UploadFileLike) {
    const fileName = file.originalname ?? file.name ?? 'uploaded-file'
    const uniqueFilename = `${randomUUID()}${extname(fileName)}`
    const uploadsDirectory = join(process.cwd(), 'public', 'uploads')
    const filePath = join(uploadsDirectory, uniqueFilename)

    await mkdir(uploadsDirectory, { recursive: true })
    const buffer = file.buffer ?? Buffer.alloc(0)
    await writeFile(filePath, buffer)

    return {
      filename: uniqueFilename,
      fileUrl: `/uploads/${uniqueFilename}`,
      sizeBytes: buffer.length,
    }
  }
}
