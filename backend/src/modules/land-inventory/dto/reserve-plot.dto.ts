import { IsNotEmpty, IsString, IsNumber, IsPositive, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReservePlotDto {
  @ApiProperty({ example: 'Kofi Mensah' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: '+233244123456' })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiProperty({ example: 2000.0, description: 'Reservation commitment fee in GHS' })
  @IsNumber()
  @IsPositive()
  reservationFee: number;

  @ApiProperty({ example: '2026-11-20T23:59:59Z', description: 'ISO string for reservation expiry' })
  @IsDateString()
  expiresAt: string;
}

