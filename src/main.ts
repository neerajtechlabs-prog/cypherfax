import { NestFactory } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.enableCors()

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalFilters(new ThrottlerExceptionFilter())

  const port = configService.get<number>('PORT', 3000)
  await app.listen(port)
  Logger.log(`CypherFax Nest API is running on: http://localhost:${port}`)
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap Nest application', error)
  process.exit(1)
})
