import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Golden Palm Properties Ltd.' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Premium Land & Commercial Developments in Ghana' })
  @IsOptional()
  @IsString()
  companyTagline?: string;

  @ApiPropertyOptional({ example: 'accounts@goldenpalm.gh' })
  @IsOptional()
  @IsString()
  companyEmail?: string;

  @ApiPropertyOptional({ example: '+233 30 212 3456' })
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional({ example: 'Suite 401, Ridge Towers, Accra, Ghana' })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  companyLogoUrl?: string;

  @ApiPropertyOptional({ example: 'C0012345678' })
  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'GH₵' })
  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @ApiPropertyOptional({ example: 'pk_live_xxxx' })
  @IsOptional()
  @IsString()
  paystackPublicKey?: string;

  @ApiPropertyOptional({ example: 'sk_live_xxxx' })
  @IsOptional()
  @IsString()
  paystackSecretKey?: string;

  @ApiPropertyOptional({ example: 'FLWPUBK-xxxx' })
  @IsOptional()
  @IsString()
  flutterwavePublicKey?: string;

  @ApiPropertyOptional({ example: 'FLWSECK-xxxx' })
  @IsOptional()
  @IsString()
  flutterwaveSecretKey?: string;

  @ApiPropertyOptional({ example: 'wamid.HBg...' })
  @IsOptional()
  @IsString()
  whatsappAccessToken?: string;

  @ApiPropertyOptional({ example: 're_xxxx' })
  @IsOptional()
  @IsString()
  resendApiKey?: string;

  @ApiPropertyOptional({ example: 'receipts@goldenpalm.gh' })
  @IsOptional()
  @IsString()
  emailFromAddress?: string;
}
