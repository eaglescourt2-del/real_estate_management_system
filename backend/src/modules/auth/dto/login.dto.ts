import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@realestatedev.gh', description: 'Staff email address' })
  @IsEmail({}, { message: 'Please provide a valid staff email address.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'AdminPassword123!', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;
}

