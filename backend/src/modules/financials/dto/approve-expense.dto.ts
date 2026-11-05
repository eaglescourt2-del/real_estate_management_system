import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveExpenseDto {
  @ApiProperty({ example: true, description: 'True to approve, false to reject' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ example: 'Verified contractor quotation against site development progress.' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

