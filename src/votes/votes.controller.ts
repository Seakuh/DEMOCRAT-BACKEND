import { Controller, Post, Body, Get, Param, UseGuards, Request } from '@nestjs/common';
import { VotesService } from './votes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVoteDto } from './dto/create-vote.dto';

@Controller('votes')
@UseGuards(JwtAuthGuard)
export class VotesController {
  constructor(private votesService: VotesService) {}

  @Post()
  async createVote(@Request() req: any, @Body() createVoteDto: CreateVoteDto) {
    const userId = req.user?._id?.toString();
    
    // Fallback für lokale Entwicklung ohne Auth oder wenn req.user fehlt
    const effectiveUserId = userId || 'anonymous_local_user';

    const vote = await this.votesService.createVote(
      effectiveUserId,
      createVoteDto.drucksacheId,
      createVoteDto.vote,
    );
    return {
      message: 'Abstimmung erfolgreich',
      vote: {
        id: vote._id,
        vote: vote.vote,
        drucksacheId: vote.drucksacheId,
      },
    };
  }

  @Get('my')
  async getMyVotes(@Request() req: any) {
    return this.votesService.getUserVotes(req.user._id.toString());
  }

  @Get('drucksache/:drucksacheId')
  async getMyVoteForDrucksache(@Request() req: any, @Param('drucksacheId') drucksacheId: string) {
    const vote = await this.votesService.getUserVote(req.user._id.toString(), drucksacheId);
    return { hasVoted: !!vote, vote: vote?.vote || null };
  }
}
