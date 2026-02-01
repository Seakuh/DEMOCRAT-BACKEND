import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Passwort muss mindestens 6 Zeichen lang sein' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Name muss mindestens 2 Zeichen lang sein' })
  name: string;
}
