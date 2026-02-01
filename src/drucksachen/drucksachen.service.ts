import { Injectable } from '@nestjs/common';
import { XMLParser } from "fast-xml-parser";
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Drucksache, DrucksacheDocument } from '../schemas/drucksache.schema';
import { Vote, VoteDocument } from '../schemas/vote.schema';

const ENDPOINT =
"https://www.bundestag.de/static/appdata/plenum/v2/conferences.xml";

export type Diskussionspunkt = {
  startzeit: string;
  endzeit: string;
  status: string;
  titel: string;
  articleId: string | null;
  top: string | null;
};

export type Tagesordnung = {
  date: string; // "DD.MM.YYYY"
  active: 0 | 1;
  sitzungsnummer: number;
  name: string;
  diskussionspunkte: Diskussionspunkt[];
};

export type ConferencesJson = {
  tagesordnungen: Tagesordnung[];
};

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


  asArray<T>(v: T | T[] | undefined | null): T[] {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  }
  
  textOrNull(v: unknown): string | null {
    // fast-xml-parser kann leere Tags als "" oder undefined liefern (abhängig von config)
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }
  
  parseIntSafe(v: unknown, fallback = 0): number {
    const n = Number.parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : fallback;
  }
  
  parseActive(v: unknown): 0 | 1 {
    const n = this.parseIntSafe(v, 0);
    return n === 1 ? 1 : 0;
  }
  
  async getConferences(): Promise<ConferencesJson> {
    const res = await fetch(ENDPOINT, {
      headers: {
        // XML endpoint, aber Accept egal
        "accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
        "user-agent": "my-backend/1.0",
      },
    });
  
    if (!res.ok) {
      throw new Error(`Bundestag fetch failed: ${res.status} ${res.statusText}`);
    }
  
    const xml = await res.text();
  
    const parser = new XMLParser({
      ignoreAttributes: true,
      // wichtig für <articleId/> und <top/>:
      // - empty tags -> "" (statt undefined)
      // - trim Values
      trimValues: true,
      // Wenn du CDATA etc. erwartest, kannst du weitere Optionen setzen
    });
  
    const raw = parser.parse(xml) as any;
  
    // Root kann { tagesordnungen: {...} } sein
    const root = raw?.tagesordnungen ?? raw;
  
    const tagesordnungNodes = this.asArray<any>(root?.tagesordnung);
  
    const tagesordnungen: Tagesordnung[] = tagesordnungNodes.map((t) => {
      const diskussionspunkteNode = t?.diskussionspunkte;
      const dpNodes = this.asArray<any>(diskussionspunkteNode?.diskussionspunkt);
  
      const diskussionspunkte: Diskussionspunkt[] = dpNodes
        .map((dp: any) => ({
          startzeit: String(dp?.startzeit ?? "").trim(),
          endzeit: String(dp?.endzeit ?? "").trim(),
          status: String(dp?.status ?? "").trim(),
          titel: String(dp?.titel ?? "").trim(),
          articleId: this.textOrNull(dp?.articleId),
          top: this.textOrNull(dp?.top),
        }))
        .filter((dp) => dp.startzeit.length > 0 && dp.titel.length > 0)
        .sort((a, b) => a.startzeit.localeCompare(b.startzeit));
  
      return {
        date: String(t?.date ?? "").trim(),
        active: this.parseActive(t?.active),
        sitzungsnummer: this.parseIntSafe(t?.sitzungsnummer),
        name: String(t?.name ?? "").trim(),
        diskussionspunkte,
      };
    });
  
    // optional: nach Datum sortieren (DD.MM.YYYY -> YYYYMMDD)
    const toSortKey = (ddmmyyyy: string) => {
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(ddmmyyyy);
      if (!m) return ddmmyyyy;
      const [, dd, mm, yyyy] = m;
      return `${yyyy}${mm}${dd}`;
    };
  
    tagesordnungen.sort((a, b) => toSortKey(b.date).localeCompare(toSortKey(a.date)));
  
    return { tagesordnungen };
  }
  

}