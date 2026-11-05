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

  @ApiProperty({ example: 'Greater Accra Region' })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({ example: 'Ningo-Prampram District' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Near Central University, Dawhenya-Prampram Road' })
  @IsString()
  @IsNotEmpty()
  geographicalAddress: string;

  @ApiProperty({ example: 5.712345, description: 'GPS Latitude' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 0.123456, description: 'GPS Longitude' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 50.5, description: 'Total land area in acres' })
  @IsNumber()
  @IsPositive()
  totalLandSizeAcres: number;

  @ApiProperty({ example: 200, description: 'Total anticipated plots' })
  @IsNumber()
  @Min(1)
  totalPlotsCount: number;

  @ApiPropertyOptional({ example: '70 x 100 ft (Full Plot) / 50 x 70 ft (Half Plot)' })
  @IsOptional()
  @IsString()
  plotDimensionsDesc?: string;

  @ApiProperty({ example: 45000.0, description: 'Standard outright full-plot price in GHS' })
  @IsNumber()
  @IsPositive()
  standardFullPlotPrice: number;

  @ApiProperty({ example: 25000.0, description: 'Standard outright half-plot price in GHS' })
  @IsNumber()
  @IsPositive()
  standardHalfPlotPrice: number;
}

