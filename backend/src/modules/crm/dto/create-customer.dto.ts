import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  Matches,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdType, PhotoSource } from '@prisma/client';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Kwame' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Mensah' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ example: 'Kofi' })
  @IsOptional()
  @IsString()
  otherNames?: string;

  @ApiProperty({ example: '+233244123456', description: 'Ghanaian phone format (+233XXXXXXXXX or 02XXXXXXXX)' })
  @IsString()
  @Matches(/^(\+233|0)[235][0-9]{8}$/, {
    message: 'Telephone must be a valid Ghanaian number (e.g. +233244123456 or 0244123456).',
  })
  telephone: string;

  @ApiPropertyOptional({ example: '+233208901234' })
  @IsOptional()
  @IsString()
  altTelephone?: string;

  @ApiPropertyOptional({ example: 'kwame.mensah@example.gh' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email?: string;

  @ApiProperty({ example: 'House 14, Kofi Annan Street, East Legon, Accra' })
  @IsString()
  @IsNotEmpty()
  residentialAddress: string;

  @ApiPropertyOptional({ example: 'GA-492-1092', description: 'Ghana Digital Post GPS Address' })
  @IsOptional()
  @IsString()
  gpsAddress?: string;

  @ApiPropertyOptional({ example: 'Civil Engineer / Contractor' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: '1988-05-24', description: 'Date of Birth (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: IdType, example: IdType.GHANA_CARD })
  @IsOptional()
  @IsEnum(IdType)
  idType?: IdType = IdType.GHANA_CARD;

  @ApiPropertyOptional({ example: 'GHA-719284019-2', description: 'Ghana Card PIN (NIA)' })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional({ description: 'Assigned Sales Agent User ID (defaults to current staff member if agent)' })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  // Photograph Capture Options
  @ApiPropertyOptional({ description: 'Base64 image data URL from live device webcam capture' })
  @IsOptional()
  @IsString()
  cameraPhotoBase64?: string;

  @ApiPropertyOptional({ description: 'Base64 image data URL from live device webcam capture or file upload' })
  @IsOptional()
  @IsString()
  photoBase64?: string;

  @ApiPropertyOptional({ description: 'Uploaded photograph file URL (e.g. /uploads/photos/xyz.jpg)' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ enum: PhotoSource, example: PhotoSource.CAMERA_CAPTURE })
  @IsOptional()
  @IsEnum(PhotoSource)
  photoSource?: PhotoSource;

  // Land Location & Plot Acquisition Fields
  @ApiPropertyOptional({ description: 'Land Location ID if selecting plots during registration' })
  @IsOptional()
  @IsString()
  landLocationId?: string;

  @ApiPropertyOptional({ description: 'Array of Plot UUIDs selected for purchase', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plotIds?: string[];

  @ApiPropertyOptional({ example: 'OUTRIGHT', enum: ['OUTRIGHT', 'INSTALMENT'] })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ example: 6, description: 'Instalment period in months: 3, 6, 9, or 12' })
  @IsOptional()
  @IsNumber()
  instalmentMonths?: number;

  @ApiPropertyOptional({ example: 45000.0, description: 'Standard unit price per plot in GH₵' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 1000.0, description: 'Calculated instalment interest surcharge in GH₵' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestAmount?: number;

  @ApiPropertyOptional({ example: 46000.0, description: 'Total agreed purchase amount including interest in GH₵' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 15000.0, description: 'Initial deposit paid at registration in GH₵' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialDeposit?: number;
}

