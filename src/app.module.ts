import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { FaxModule } from './fax/fax.module'
import { UsageModule } from './usage/usage.module'
import { PlansModule } from './plans/plans.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60,
        limit: 10,
      },
    ]),
    PrismaModule,
    PlansModule,
    UsageModule,
    AuthModule,
    FaxModule,
    HealthModule,
  ],
})
export class AppModule {}
