import { IsEmail, IsString, Length } from 'class-validator';

export class CreateTicketDto {
  @IsEmail()
  customer_email: string;

  @IsString()
  @Length(1, 255)
  subject: string;

  @IsString()
  @Length(1, 5_000)
  message: string;
}
