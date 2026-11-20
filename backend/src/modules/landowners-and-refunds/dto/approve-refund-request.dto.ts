import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ApproveRefundRequestDto {
  @ApiPropertyOptional({ example: true, description: 'True to approve, false to reject' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value, obj }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    if (obj?.status === 'APPROVED' || obj?.decision === 'APPROVED') return true;
    if (obj?.status === 'REJECTED' || obj?.decision === 'REJECTED') return false;
    return true;
  })
  approved?: boolean;

  @ApiPropertyOptional({ example: 'APPROVED', description: 'Status string: APPROVED or REJECTED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Approved for disbursement in two equal instalments.' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 'Customer claims cannot be substantiated against survey records.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

