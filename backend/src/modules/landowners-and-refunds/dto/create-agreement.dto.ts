import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgreementDto {
  @ApiProperty({ description: 'Landowner UUID' })
  @IsString()
  @IsNotEmpty()
  landownerId: string;

  @ApiProperty({ description: 'Land Location UUID' })
  @IsString()
  @IsNotEmpty()
  landLocationId: string;

  @ApiProperty({ example: 1200000.0, description: 'Agreed total land acquisition amount in GHS' })
  @IsNumber()
  @IsPositive()
  agreedTotalAmount: number;

  @ApiProperty({ example: '2026-05-15T00:00:00Z', description: 'Deed of acquisition / agreement signed date' })
  @IsDateString()
  signedDate: string;

  @ApiPropertyOptional({ example: '/uploads/documents/land-acquisition-deed-phase2.pdf' })
  @IsOptional()
  @IsString()
  contractDocumentUrl?: string;

  @ApiPropertyOptional({ example: 'Payment scheduled in 4 tranches of GH₵ 300,000 every quarter upon beaconing.' })
  @IsOptional()
  @IsString()
  termsNotes?: string;
}

