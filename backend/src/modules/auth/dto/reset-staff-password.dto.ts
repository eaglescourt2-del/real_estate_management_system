import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetStaffPasswordDto {
  @ApiProperty({ description: 'New temporary password (min 8 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  newPassword: string;
}
