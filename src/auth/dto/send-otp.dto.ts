import { IsEmail, IsOptional, IsString, Matches } from 'class-validator'

export class SendOtpDto {
  @IsOptional()
  @IsString()
  project?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s()-]{8,20}$/)
  phoneNumber?: string
}
