import { IsOptional, IsString, Length, Matches } from 'class-validator'

export class VerifyOtpDto {
  @IsString()
  contact!: string

  @IsString()
  @IsOptional()
  project?: string

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string
}
