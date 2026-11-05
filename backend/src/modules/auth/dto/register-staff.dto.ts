import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterStaffDto {
  @ApiProperty({ example: 'agent.kwame@realestatedev.gh' })
  @IsEmail({}, { message: 'Valid email address required.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+233244123456', description: 'Ghanaian telephone format +233XXXXXXXXX' })
  @IsString()
  @Matches(/^(\+233|0)[235][0-9]{8}$/, {
    message: 'Telephone must be a valid Ghanaian number (e.g. +233244123456 or 0244123456).',
  })
  telephone: string;

  @ApiProperty({ example: 'Kwame' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Mensah' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'SecureAgentPass2026!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.SALES_AGENT,
    description: 'Assigned role: SUPER_ADMINISTRATOR, MANAGING_DIRECTOR, ADMINISTRATOR, SALES_AGENT',
  })
  @IsEnum(UserRole, { message: 'Role must be one of the 4 defined corporate roles.' })
  role: UserRole;
}

