import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface DocumentVector {
  dipId: string;
  vector: number[];
  payload: {
    dipId: string;
    titel: string;
    category: string;
    datum: string;
    ressort: string;
    summary: string;
  };
}

export interface SearchResult {
  dipId: string;
  titel: string;
  score: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private collectionName: string;
  private vectorSize = 1536; // text-embedding-3-small dimension

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('QDRANT_URL');
    const apiKey = this.configService.get<string>('QDRANT_API_KEY');
    this.collectionName =
      this.configService.get<string>('QDRANT_COLLECTION_NAME') || 'drucksachen';

    if (!url || !apiKey) {
      this.logger.warn('QDRANT_URL or QDRANT_API_KEY not configured');
      return;
    }

    this.client = new QdrantClient({
      url,
      apiKey,
    });

    await this.ensureCollection();
  }

  private async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });

        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'category',
          field_schema: 'keyword',
        });
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'ressort',
          field_schema: 'keyword',
        });

        this.logger.log(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        this.logger.log(
          `Qdrant collection ${this.collectionName} already exists`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant collection:', error);
      throw error;
    }
  }

  async upsertVector(doc: DocumentVector): Promise<string> {
    const pointId = this.generatePointId(doc.dipId);

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id: pointId,
          vector: doc.vector,
          payload: doc.payload,
        },
      ],
    });

    return pointId.toString();
  }

  async searchSimilar(
    queryVector: number[],
    limit = 10,
    filter?: {
      category?: string;
      ressort?: string;
    },
  ): Promise<SearchResult[]> {
    const qdrantFilter: { must: Array<Record<string, unknown>> } = { must: [] };

    if (filter?.category) {
      qdrantFilter.must.push({
        key: 'category',
        match: { value: filter.category },
      });
    }
    if (filter?.ressort) {
      qdrantFilter.must.push({
        key: 'ressort',
        match: { value: filter.ressort },
      });
    }

    const results = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit,
      filter: qdrantFilter.must.length > 0 ? qdrantFilter : undefined,
      with_payload: true,
    });

    return results.map((r) => ({
      dipId: r.payload?.dipId as string,
      titel: r.payload?.titel as string,
      score: r.score,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async deleteVector(dipId: string): Promise<void> {
    const pointId = this.generatePointId(dipId);
    await this.client.delete(this.collectionName, {
      points: [pointId],
    });
  }

  getPointIdForDipId(dipId: string): number {
    return this.generatePointId(dipId);
  }

  private generatePointId(dipId: string): number {
    // Create numeric hash from dipId for Qdrant point ID (unsigned int)
    let hash = 0;
    for (let i = 0; i < dipId.length; i++) {
      const char = dipId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
