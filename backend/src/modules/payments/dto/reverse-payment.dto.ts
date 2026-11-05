import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReversePaymentDto {
  @ApiProperty({
    example: 'Bank bounced cheque due to signature mismatch. Reversal authorized by MD.',
    description: 'Mandatory detailed audit reason for financial reversal',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Reversal reason must be detailed (at least 10 characters).' })
  reversalReason: string;
}
