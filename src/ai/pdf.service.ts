import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker for Node.js environment
GlobalWorkerOptions.workerSrc = '';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async extractTextFromUrl(pdfUrl: string): Promise<string> {
    try {
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'DEMOCRAT-Backend/1.0',
        },
      });

      const buffer = Buffer.from(response.data);
      const uint8Array = new Uint8Array(buffer);

      const pdf = await getDocument({ data: uint8Array }).promise;
      const textParts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ');
        textParts.push(pageText);
      }

      return this.cleanText(textParts.join('\n'));
    } catch (error) {
      this.logger.error(`Failed to extract PDF from ${pdfUrl}:`, error);
      throw error;
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }
}
