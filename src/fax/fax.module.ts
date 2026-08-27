import { Module } from '@nestjs/common'
import { FaxController } from './fax.controller'
import { FaxService } from './fax.service'
import { FaxDispatchService } from './fax-dispatch/fax-dispatch.service'
import { UploadModule } from '../upload/upload.module'
import { UsageModule } from '../usage/usage.module'
import { PlansModule } from '../plans/plans.module'

@Module({
  imports: [UploadModule, UsageModule, PlansModule],
  controllers: [FaxController],
  providers: [FaxService, FaxDispatchService],
  exports: [FaxService],
})
export class FaxModule {}
