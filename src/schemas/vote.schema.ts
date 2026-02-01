import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VoteDocument = Vote & Document;

export enum VoteType {
  YES = 'YES',
  NO = 'NO',
  ABSTAIN = 'ABSTAIN',
}

@Schema({ timestamps: true })
export class Vote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Drucksache', required: true })
  drucksacheId: Types.ObjectId;

  @Prop({ required: true, enum: VoteType })
  vote: VoteType;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

VoteSchema.index({ userId: 1, drucksacheId: 1 }, { unique: true });
