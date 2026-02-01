import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DrucksachenModule } from './drucksachen/drucksachen.module';
import { VotesModule } from './votes/votes.module';
import { SyncModule } from './sync/sync.module';
import { AiModule } from './ai/ai.module';
import { NewsModule } from './news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/democrat'),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    DrucksachenModule,
    VotesModule,
    SyncModule,
    AiModule,
    NewsModule,
  ],
})
export class AppModule {}
