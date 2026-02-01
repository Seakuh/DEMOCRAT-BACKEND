import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface DocumentCategorization {
  category: string;
  confidence: number;
  reasoning: string;
}

export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  affectedAreas: string[];
}

@Injectable()
export class ChatGptService implements OnModuleInit {
  private readonly logger = new Logger(ChatGptService.name);
  private openai: OpenAI;
  private embeddingModel: string;
  private chatModel: string;

  private readonly CATEGORIES = [
    'Wirtschaft und Finanzen',
    'Umwelt und Klimaschutz',
    'Soziales und Arbeit',
    'Gesundheit',
    'Bildung und Forschung',
    'Verkehr und Infrastruktur',
    'Innere Sicherheit',
    'Außenpolitik und Verteidigung',
    'Justiz und Recht',
    'Digitalisierung und Technologie',
    'Familie und Jugend',
    'Kultur und Medien',
    'Landwirtschaft und Ernährung',
    'Wohnen und Bauen',
    'Sonstiges',
  ];

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured');
    }
    this.openai = new OpenAI({ apiKey });
    this.embeddingModel =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ||
      'text-embedding-3-small';
    this.chatModel =
      this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o-mini';
  }

  async createEmbedding(text: string): Promise<number[]> {
    const truncatedText = text.slice(0, 30000);

    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: truncatedText,
    });

    return response.data[0].embedding;
  }

  async categorizeDocument(
    title: string,
    abstract: string,
    pdfText: string,
  ): Promise<DocumentCategorization> {
    const prompt = `Du bist ein Experte für deutsche Gesetzgebung. Kategorisiere das folgende Gesetzesdokument.

Titel: ${title}

Abstract: ${abstract || 'Nicht verfügbar'}

Textauszug: ${pdfText.slice(0, 8000)}

Verfügbare Kategorien:
${this.CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Antworte im JSON-Format:
{
  "category": "Name der passendsten Kategorie",
  "confidence": 0.0-1.0,
  "reasoning": "Kurze Begründung"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  async summarizeDocument(
    title: string,
    pdfText: string,
  ): Promise<DocumentSummary> {
    const prompt = `Du bist ein Experte für deutsche Gesetzgebung. Erstelle eine Zusammenfassung des folgenden Gesetzentwurfs.

Titel: ${title}

Volltext (Auszug):
${pdfText.slice(0, 15000)}

Erstelle eine Zusammenfassung mit maximal 3 Sätzen, die wichtigsten Punkte und betroffene Bereiche.

Antworte im JSON-Format:
{
  "summary": "Prägnante Zusammenfassung in 2-3 Sätzen",
  "keyPoints": ["Punkt 1", "Punkt 2", ...],
  "affectedAreas": ["Bereich 1", "Bereich 2", ...]
}`;

    const response = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
}
