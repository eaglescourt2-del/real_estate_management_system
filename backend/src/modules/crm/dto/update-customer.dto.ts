import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, IdType } from '@prisma/client';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'Kwame' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Mensah' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Kofi' })
  @IsOptional()
  @IsString()
  otherNames?: string;

  @ApiPropertyOptional({ example: '+233208901234' })
  @IsOptional()
  @IsString()
  altTelephone?: string;

  @ApiPropertyOptional({ example: 'kwame.mensah@example.gh' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'House 14, East Legon, Accra' })
  @IsOptional()
  @IsString()
  residentialAddress?: string;

  @ApiPropertyOptional({ example: 'GA-492-1092' })
  @IsOptional()
  @IsString()
  gpsAddress?: string;

  @ApiPropertyOptional({ example: 'Managing Director' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ enum: IdType })
  @IsOptional()
  @IsEnum(IdType)
  idType?: IdType;

  @ApiPropertyOptional({ example: 'GHA-719284019-2' })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ description: 'Reassign to a different Sales Agent UUID' })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;
}
