import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCustomerDocumentDto {
  @ApiProperty({ example: 'Ghana Card Scanned Copy' })
  @IsString()
  @IsNotEmpty()
  documentTitle: string;

  @ApiProperty({ example: 'National Identification / KYC' })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiProperty({ example: '/uploads/documents/abc-123.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: 'documents/abc-123.pdf' })
  @IsString()
  @IsNotEmpty()
  storageKey: string;
}

