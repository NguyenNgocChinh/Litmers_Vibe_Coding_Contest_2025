import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSubtaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}
