import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveRefundRequestDto {
  @ApiProperty({ example: true, description: 'True to approve, false to reject' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ example: 'Approved for disbursement in two equal instalments.' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 'Customer claims cannot be substantiated against survey records.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
