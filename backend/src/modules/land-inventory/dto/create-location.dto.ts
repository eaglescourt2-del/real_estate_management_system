import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLandLocationDto {
  @ApiProperty({ example: 'Prampram Palms Phase 2' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Greater Accra' })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({ example: 'Ningo-Prampram' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Near Central University, Dawhenya-Prampram Road' })
  @IsString()
  @IsNotEmpty()
  geographicalAddress: string;

  @ApiProperty({ example: 50.0, description: 'Total land area in acres' })
  @IsNumber()
  @IsPositive()
  totalLandSizeAcres: number;

  @ApiProperty({ example: 200, description: 'Total number of plots' })
  @IsNumber()
  @Min(1)
  totalPlotsCount: number;

  @ApiPropertyOptional({ example: 'Nii Ayiku Mensah Family Stool', description: "Landowner's name" })
  @IsOptional()
  @IsString()
  landownerName?: string;

  @ApiPropertyOptional({ example: 600000.0, description: 'Total land acquisition / purchase price in GH₵' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({ example: 45000.0, description: 'Standard outright full-plot selling price in GH₵' })
  @IsNumber()
  @IsPositive()
  standardFullPlotPrice: number;

  @ApiProperty({ example: 25000.0, description: 'Standard outright half-plot selling price in GH₵' })
  @IsNumber()
  @IsPositive()
  standardHalfPlotPrice: number;

  @ApiPropertyOptional({ example: '70 x 100 ft (Full Plot) / 50 x 70 ft (Half Plot)' })
  @IsOptional()
  @IsString()
  plotDimensionsDesc?: string;

  @ApiPropertyOptional({ example: 5.712345, description: 'Optional GPS Latitude' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 0.123456, description: 'Optional GPS Longitude' })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
