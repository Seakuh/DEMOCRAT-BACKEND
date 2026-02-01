import { IsEnum, IsMongoId } from 'class-validator';
import { VoteType } from '../../schemas/vote.schema';

export class CreateVoteDto {
  @IsMongoId({ message: 'Ungültige Drucksache ID' })
  drucksacheId: string;

  @IsEnum(VoteType, { message: 'Ungültige Abstimmung. Erlaubt: YES, NO, ABSTAIN' })
  vote: VoteType;
}
