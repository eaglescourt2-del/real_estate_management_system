import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlotType, HalfPlotPosition, PlotStatus } from '@prisma/client';

export class CreatePlotDto {
  @ApiProperty({ example: 'Plot 55' })
  @IsString()
  @IsNotEmpty()
  plotNumber: string;

  @ApiProperty({ example: 55 })
  @IsNumber()
  @Min(1)
  basePlotNumber: number;

  @ApiProperty({ enum: PlotType, example: PlotType.FULL_PLOT })
  @IsEnum(PlotType)
  plotType: PlotType;

  @ApiPropertyOptional({ enum: HalfPlotPosition, example: HalfPlotPosition.NONE })
  @IsOptional()
  @IsEnum(HalfPlotPosition)
  halfPosition?: HalfPlotPosition = HalfPlotPosition.NONE;

  @ApiPropertyOptional({ description: 'Parent plot UUID if this is Plot 55A or 55B' })
  @IsOptional()
  @IsString()
  parentPlotId?: string;

  @ApiProperty({ example: '70ft x 100ft' })
  @IsString()
  @IsNotEmpty()
  dimensions: string;

  @ApiPropertyOptional({ enum: PlotStatus, example: PlotStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(PlotStatus)
  status?: PlotStatus = PlotStatus.AVAILABLE;
}
