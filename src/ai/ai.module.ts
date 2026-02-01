import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatGptService } from './chatgpt.service';
import { QdrantService } from './qdrant.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [ConfigModule],
  providers: [ChatGptService, QdrantService, PdfService],
  exports: [ChatGptService, QdrantService, PdfService],
})
export class AiModule {}
