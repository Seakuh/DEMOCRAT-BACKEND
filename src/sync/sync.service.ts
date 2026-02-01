import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DrucksachenService } from '../drucksachen/drucksachen.service';

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

  constructor(
    private configService: ConfigService,
    private drucksachenService: DrucksachenService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
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
}
