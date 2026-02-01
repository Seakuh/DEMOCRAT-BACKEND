import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DrucksacheDocument = Drucksache & Document;

@Schema({ timestamps: true })
export class Drucksache {
  @Prop({ required: true, unique: true })
  dipId: string;

  @Prop({ required: true })
  titel: string;

  @Prop()
  dokumentart: string;

  @Prop()
  drucksachetyp: string;

  @Prop()
  datum: Date;

  @Prop()
  ressort: string;

  @Prop([String])
  urheber: string[];

  @Prop()
  pdfUrl: string;

  @Prop()
  abstract: string;

  @Prop()
  wahlperiode: number;

  @Prop()
  dokumentnummer: string;

  // AI-generierte Felder
  @Prop()
  summary: string;

  @Prop()
  category: string;

  @Prop()
  qdrantPointId: string;

  @Prop({ default: false })
  aiProcessed: boolean;

  @Prop()
  aiProcessedAt: Date;
}

export const DrucksacheSchema = SchemaFactory.createForClass(Drucksache);

DrucksacheSchema.index({ ressort: 1 });
DrucksacheSchema.index({ datum: -1 });
DrucksacheSchema.index({ titel: 'text', abstract: 'text' });
DrucksacheSchema.index({ aiProcessed: 1 });
DrucksacheSchema.index({ category: 1 });
