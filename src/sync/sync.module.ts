import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { DrucksachenModule } from '../drucksachen/drucksachen.module';

@Module({
  imports: [DrucksachenModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
