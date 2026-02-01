import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vote, VoteDocument, VoteType } from '../schemas/vote.schema';
import { Drucksache, DrucksacheDocument } from '../schemas/drucksache.schema';

@Injectable()
export class VotesService {
  constructor(
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(Drucksache.name) private drucksacheModel: Model<DrucksacheDocument>,
  ) {}

  async createVote(userId: string, drucksacheId: string, voteType: VoteType): Promise<VoteDocument> {
    const drucksache = await this.drucksacheModel.findById(drucksacheId).exec();
    if (!drucksache) {
      throw new NotFoundException('Drucksache nicht gefunden');
    }

    const existingVote = await this.voteModel.findOne({
      userId: new Types.ObjectId(userId),
      drucksacheId: new Types.ObjectId(drucksacheId),
    }).exec();

    if (existingVote) {
      throw new ConflictException('Sie haben bereits abgestimmt. Abstimmungen können nicht geändert werden.');
    }

    const vote = new this.voteModel({
      userId: new Types.ObjectId(userId),
      drucksacheId: new Types.ObjectId(drucksacheId),
      vote: voteType,
    });

    return vote.save();
  }

  async getUserVote(userId: string, drucksacheId: string): Promise<VoteDocument | null> {
    return this.voteModel.findOne({
      userId: new Types.ObjectId(userId),
      drucksacheId: new Types.ObjectId(drucksacheId),
    }).exec();
  }

  async getUserVotes(userId: string): Promise<VoteDocument[]> {
    return this.voteModel.find({
      userId: new Types.ObjectId(userId),
    }).exec();
  }
}
