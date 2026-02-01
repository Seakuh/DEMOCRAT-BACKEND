import { Injectable, Logger } from '@nestjs/common';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async extractTextFromUrl(pdfUrl: string): Promise<string> {
    const tempFilePath = join(tmpdir(), `pdf-${randomUUID()}.pdf`);
    try {
      this.logger.debug(`Downloading PDF from ${pdfUrl} to ${tempFilePath}`);
      
      execFileSync('curl', [
        '-L',
        '--max-time', '60',
        '-A', 'DEMOCRAT-Backend/1.0',
        '-s',
        '-o', tempFilePath,
        pdfUrl,
      ]);

      const buffer = readFileSync(tempFilePath);
      const uint8Array = new Uint8Array(buffer);

      const pdf = await pdfjs.getDocument({
        data: uint8Array,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
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
    } finally {
      try {
        unlinkSync(tempFilePath);
      } catch (e) {
        // Ignore error if file doesn't exist
      }
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }
}
