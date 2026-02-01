import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VotesService } from './votes.service';
import { VotesController } from './votes.controller';
import { Vote, VoteSchema } from '../schemas/vote.schema';
import { Drucksache, DrucksacheSchema } from '../schemas/drucksache.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vote.name, schema: VoteSchema },
      { name: Drucksache.name, schema: DrucksacheSchema },
    ]),
  ],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
