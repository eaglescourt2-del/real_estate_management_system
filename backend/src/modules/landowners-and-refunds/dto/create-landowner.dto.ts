import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLandownerDto {
  @ApiProperty({ example: 'Nii Kpobi Tettey Tsuru III (Family Head)' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+233244987654' })
  @IsString()
  @IsNotEmpty()
  telephone: string;

  @ApiPropertyOptional({ example: '+233201122334' })
  @IsOptional()
  @IsString()
  altTelephone?: string;

  @ApiPropertyOptional({ example: 'landowner.family@example.gh' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Palace of the Stool, Prampram Traditional Council' })
  @IsString()
  @IsNotEmpty()
  residentialAddress: string;

  @ApiPropertyOptional({ example: 'GCB Bank PLC' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '1021098230192' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'Tema Main Branch' })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({ example: '+233244987654', description: 'Registered Mobile Money wallet number for payouts' })
  @IsOptional()
  @IsString()
  momoNumber?: string;
}
