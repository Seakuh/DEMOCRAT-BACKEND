import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DrucksachenService } from '../drucksachen/drucksachen.service';
import { ChatGptService } from '../ai/chatgpt.service';
import { QdrantService } from '../ai/qdrant.service';
import { PdfService } from '../ai/pdf.service';
import { DrucksacheDocument } from '../schemas/drucksache.schema';

interface DIPDrucksache {
  id: string;
  titel: string;
  dokumentart: string;
  drucksachetyp: string;
  datum: string;
  fundstelle?: {
    pdf_url?: string;
    dokumentnummer?: string;
  };
  ressort?: Array<{ titel: string }>;
  urheber?: Array<{ titel: string }>;
  abstract?: string;
  wahlperiode?: number;
}

interface DIPResponse {
  documents: DIPDrucksache[];
  numFound: number;
  cursor?: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly baseUrl = 'https://search.dip.bundestag.de/api/v1';
  private isAiProcessing = false;

  constructor(
    private configService: ConfigService,
    private drucksachenService: DrucksachenService,
    private chatGptService: ChatGptService,
    private qdrantService: QdrantService,
    private pdfService: PdfService,
  ) {}

  @Cron(CronExpression.EVERY_10_HOURS)
  async handleCron() {
    this.logger.log('Starting sync of Drucksachen (every 5 minutes)...');
    await this.syncDrucksachen();
  }

  async syncDrucksachen(): Promise<{ synced: number; errors: number }> {
    const apiKey = this.configService.get<string>('DIP_API_KEY');
    if (!apiKey) {
      this.logger.error('DIP_API_KEY not configured');
      return { synced: 0, errors: 1 };
    }

    let synced = 0;
    let errors = 0;
    let cursor: string | undefined;

    try {
      do {
        const params: Record<string, string> = {
          'f.drucksachetyp': 'Gesetzentwurf',
          'f.zuordnung': 'BT',
          apikey: apiKey,
        };
        if (cursor) {
          params.cursor = cursor;
        }

        const response = await axios.get<DIPResponse>(`${this.baseUrl}/drucksache`, {
          params,
          headers: {
            Accept: 'application/json',
          },
        });

        const { documents, cursor: nextCursor } = response.data;
        cursor = nextCursor;

        for (const doc of documents) {
          try {
            await this.drucksachenService.upsertDrucksache({
              dipId: doc.id,
              titel: doc.titel,
              dokumentart: doc.dokumentart,
              drucksachetyp: doc.drucksachetyp,
              datum: new Date(doc.datum),
              pdfUrl: doc.fundstelle?.pdf_url,
              dokumentnummer: doc.fundstelle?.dokumentnummer,
              ressort: doc.ressort?.[0]?.titel,
              urheber: doc.urheber?.map((u) => u.titel) || [],
              abstract: doc.abstract,
              wahlperiode: doc.wahlperiode,
            });
            synced++;
          } catch (error) {
            this.logger.error(`Failed to sync document ${doc.id}:`, error);
            errors++;
          }
        }

        this.logger.log(`Synced batch: ${documents.length} documents`);
      } while (cursor);

      this.logger.log(`Sync completed: ${synced} synced, ${errors} errors`);
    } catch (error) {
      this.logger.error('Sync failed:', error);
      errors++;
    }

    return { synced, errors };
  }

  @Cron(CronExpression.EVERY_10_HOURS)
  async handleAiProcessingCron() {
    if (this.isAiProcessing) {
      this.logger.log('AI processing already in progress, skipping...');
      return;
    }

    this.isAiProcessing = true;
    try {
      this.logger.log('Starting AI processing of documents...');
      await this.processUnprocessedDocuments();
    } finally {
      this.isAiProcessing = false;
    }
  }

  async processUnprocessedDocuments(): Promise<{
    processed: number;
    errors: number;
  }> {
    let processed = 0;
    let errors = 0;

    const unprocessed = await this.drucksachenService.findUnprocessed(10);
    this.logger.log(`Found ${unprocessed.length} unprocessed documents`);

    for (const doc of unprocessed) {
      try {
        await this.processDocument(doc);
        processed++;
        await this.delay(2000);
      } catch (error) {
        this.logger.error(`Failed to process document ${doc.dipId}:`, error);
        errors++;
      }
    }

    this.logger.log(
      `AI Processing completed: ${processed} processed, ${errors} errors`,
    );
    return { processed, errors };
  }

  private async processDocument(doc: DrucksacheDocument): Promise<void> {
    this.logger.log(`Processing document: ${doc.dipId} - ${doc.titel}`);

    let pdfText = '';
    if (doc.pdfUrl) {
      try {
        pdfText = await this.pdfService.extractTextFromUrl(doc.pdfUrl);
        this.logger.log(
          `Extracted ${pdfText.length} characters from PDF for ${doc.dipId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Could not extract PDF for ${doc.dipId}, using abstract only`,
        );
        pdfText = doc.abstract || '';
      }
    }

    const textForAi = pdfText || doc.abstract || doc.titel;

    const summaryResult = await this.chatGptService.summarizeDocument(
      doc.titel,
      textForAi,
    );
    this.logger.log(`Generated summary for ${doc.dipId}`);

    const categorization = await this.chatGptService.categorizeDocument(
      doc.titel,
      doc.abstract || '',
      textForAi,
    );
    this.logger.log(
      `Categorized ${doc.dipId} as: ${categorization.category}`,
    );

    const textForEmbedding = `${doc.titel}\n\n${summaryResult.summary}\n\n${textForAi.slice(0, 10000)}`;
    const embedding = await this.chatGptService.createEmbedding(textForEmbedding);
    this.logger.log(`Created embedding for ${doc.dipId}`);

    const qdrantPointId = await this.qdrantService.upsertVector({
      dipId: doc.dipId,
      vector: embedding,
      payload: {
        dipId: doc.dipId,
        titel: doc.titel,
        category: categorization.category,
        datum: doc.datum?.toISOString() || '',
        ressort: doc.ressort || '',
        summary: summaryResult.summary,
      },
    });
    this.logger.log(`Stored vector in Qdrant for ${doc.dipId}`);

    await this.drucksachenService.updateAiFields(doc.dipId, {
      summary: summaryResult.summary,
      category: categorization.category,
      qdrantPointId,
      aiProcessed: true,
      aiProcessedAt: new Date(),
    });
    this.logger.log(`Updated MongoDB for ${doc.dipId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
