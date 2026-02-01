import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrucksachenService } from './drucksachen.service';
import { DrucksachenController } from './drucksachen.controller';
import { Drucksache, DrucksacheSchema } from '../schemas/drucksache.schema';
import { Vote, VoteSchema } from '../schemas/vote.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Drucksache.name, schema: DrucksacheSchema },
      { name: Vote.name, schema: VoteSchema },
    ]),
  ],
  controllers: [DrucksachenController],
  providers: [DrucksachenService],
  exports: [DrucksachenService],
})
export class DrucksachenModule {}
