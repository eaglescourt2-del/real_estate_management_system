import { IsNotEmpty, IsNumber, IsPositive, Min, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchGeneratePlotsDto {
  @ApiProperty({ example: 1, description: 'Starting base plot number (e.g. 1)' })
  @IsNumber()
  @Min(1)
  startPlotNumber: number;

  @ApiProperty({ example: 50, description: 'Ending base plot number (e.g. 50)' })
  @IsNumber()
  @IsPositive()
  endPlotNumber: number;

  @ApiPropertyOptional({ example: true, description: 'Automatically generate child half-plot options (e.g. Plot 1A, Plot 1B)' })
  @IsOptional()
  @IsBoolean()
  includeHalfPlots?: boolean = true;

  @ApiPropertyOptional({ example: '70ft x 100ft' })
  @IsOptional()
  @IsString()
  fullPlotDimensions?: string = '70ft x 100ft';

  @ApiPropertyOptional({ example: '50ft x 70ft' })
  @IsOptional()
  @IsString()
  halfPlotDimensions?: string = '50ft x 70ft';
}
