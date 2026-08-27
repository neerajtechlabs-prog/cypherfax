import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from './auth.service'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'
import { GoogleLoginDto } from './dto/google-login.dto'
import { RefreshDto } from './dto/refresh.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: SendOtpDto, @Headers() headers: Record<string, string>) {
    try {
      return await this.authService.sendOtp(
        {
          email: body.email,
          phoneNumber: body.phoneNumber,
          project: body.project,
        },
        headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? null,
        headers['user-agent'] ?? null,
      )
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const status = Number((error as any).status)
        if (status === 400) throw new BadRequestException((error as Error).message)
        if (status === 429) throw new HttpException((error as Error).message, HttpStatus.TOO_MANY_REQUESTS)
        if (status === 500) throw new InternalServerErrorException((error as Error).message)
      }
      throw new InternalServerErrorException((error as Error)?.message ?? 'Failed to process OTP request.')
    }
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto, @Headers() headers: Record<string, string>) {
    try {
      return await this.authService.verifyOtp(
        { contact: body.contact, otp: body.otp, project: body.project },
        headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? null,
        headers['user-agent'] ?? null,
      )
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const status = Number((error as any).status)
        if (status === 400) throw new BadRequestException((error as Error).message)
        if (status === 401) throw new UnauthorizedException((error as Error).message)
      }
      throw new InternalServerErrorException((error as Error)?.message ?? 'OTP verification failed.')
    }
  }

  @Post('google-login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() body: GoogleLoginDto, @Headers() headers: Record<string, string>) {
    try {
      return await this.authService.googleLogin(
        { idToken: body.idToken, project: body.project },
        headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? null,
        headers['user-agent'] ?? null,
      )
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const status = Number((error as any).status)
        if (status === 400) throw new BadRequestException((error as Error).message)
        if (status === 401) throw new UnauthorizedException((error as Error).message)
      }
      throw new InternalServerErrorException((error as Error)?.message ?? 'Google login failed.')
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto) {
    try {
      return await this.authService.refresh({ refreshToken: body.refreshToken })
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const status = Number((error as any).status)
        if (status === 400) throw new BadRequestException((error as Error).message)
        if (status === 401) throw new UnauthorizedException((error as Error).message)
      }
      throw new InternalServerErrorException((error as Error)?.message ?? 'Refresh failed.')
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: RefreshDto, @Headers() headers: Record<string, string>) {
    try {
      return await this.authService.logout(
        { refreshToken: body.refreshToken },
        headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? null,
        headers['user-agent'] ?? null,
      )
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        const status = Number((error as any).status)
        if (status === 400) throw new BadRequestException((error as Error).message)
        if (status === 401) throw new UnauthorizedException((error as Error).message)
      }
      throw new InternalServerErrorException((error as Error)?.message ?? 'Logout failed.')
    }
  }
}
