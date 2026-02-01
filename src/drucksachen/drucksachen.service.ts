import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Drucksache, DrucksacheDocument } from '../schemas/drucksache.schema';
import { Vote, VoteDocument } from '../schemas/vote.schema';

export interface DrucksacheQuery {
  page?: number;
  limit?: number;
  ressort?: string;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class DrucksachenService {
  constructor(
    @InjectModel(Drucksache.name) private drucksacheModel: Model<DrucksacheDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
  ) {}

  async findAll(query: DrucksacheQuery) {
    const { page = 1, limit = 10, ressort, category, search, startDate, endDate, sortBy = 'datum', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (ressort) {
      filter.ressort = ressort;
    }
    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { titel: { $regex: search, $options: 'i' } },
        { abstract: { $regex: search, $options: 'i' } },
        { dokumentnummer: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.datum = {};
      if (startDate) filter.datum.$gte = new Date(startDate);
      if (endDate) filter.datum.$lte = new Date(endDate);
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [drucksachen, total] = await Promise.all([
      this.drucksacheModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.drucksacheModel.countDocuments(filter).exec(),
    ]);

    const drucksachenWithVotes = await Promise.all(
      drucksachen.map(async (d) => {
        const votes = await this.getVoteCounts(d._id);
        return {
          ...d.toObject(),
          votes,
        };
      }),
    );

    return {
      data: drucksachenWithVotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const drucksache = await this.drucksacheModel.findById(id).exec();
    if (!drucksache) {
      return null;
    }

    const votes = await this.getVoteCounts(drucksache._id);
    return {
      ...drucksache.toObject(),
      votes,
    };
  }

  async getVoteCounts(drucksacheId: Types.ObjectId) {
    const votes = await this.voteModel
      .aggregate([
        { $match: { drucksacheId } },
        { $group: { _id: '$vote', count: { $sum: 1 } } },
      ])
      .exec();

    const result = { YES: 0, NO: 0, ABSTAIN: 0, total: 0 };
    votes.forEach((v) => {
      result[v._id as keyof typeof result] = v.count;
      result.total += v.count;
    });

    return result;
  }

  async getRessorts(): Promise<string[]> {
    const ressorts = await this.drucksacheModel.distinct('ressort').exec();
    return ressorts.filter((r) => r != null);
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.drucksacheModel.distinct('category').exec();
    return categories.filter((c) => c != null);
  }

  async upsertDrucksache(data: Partial<Drucksache>): Promise<DrucksacheDocument> {
    return this.drucksacheModel.findOneAndUpdate(
      { dipId: data.dipId },
      { $set: data },
      { upsert: true, new: true },
    ).exec();
  }

  async findUnprocessed(limit = 10): Promise<DrucksacheDocument[]> {
    return this.drucksacheModel
      .find({
        aiProcessed: { $ne: true },
        pdfUrl: { $exists: true, $nin: [null, ''] },
      })
      .sort({ datum: -1 })
      .limit(limit)
      .exec();
  }

  async updateAiFields(
    dipId: string,
    updates: {
      summary?: string;
      category?: string;
      qdrantPointId?: string;
      aiProcessed?: boolean;
      aiProcessedAt?: Date;
    },
  ): Promise<DrucksacheDocument | null> {
    return this.drucksacheModel
      .findOneAndUpdate({ dipId }, { $set: updates }, { new: true })
      .exec();
  }
}
