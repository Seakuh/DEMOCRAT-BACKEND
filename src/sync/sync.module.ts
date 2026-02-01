import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { DrucksachenModule } from '../drucksachen/drucksachen.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DrucksachenModule, AiModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
