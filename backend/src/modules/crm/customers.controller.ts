import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AddCustomerDocumentDto } from './dto/add-customer-document.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, PhotoSource } from '@prisma/client';

@ApiTags('Customer Relationship Management (CRM)')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({
    summary: 'Register new customer with photograph (camera snapshot or file upload)',
  })
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.create(dto, staffUser);
  }

  @Get()
  @ApiOperation({
    summary: 'List customers with financial rollups (Agents automatically restricted to assigned customers)',
  })
  async findAll(
    @Query() query: CustomerQueryDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.findAll(query, staffUser);
  }

  @Get('trash')
  @ApiOperation({ summary: 'List deleted customers in the trash' })
  async getTrash(
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.getTrash(staffUser);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve comprehensive customer profile (biometrics, plots, payment history, documents)',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.findOne(id, staffUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer personal or contact information' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.update(id, dto, staffUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Move customer to trash (soft delete)' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.softDelete(id, staffUser);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore customer from trash' })
  async restoreFromTrash(
    @Param('id') id: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.restoreFromTrash(id, staffUser);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete customer and related records from database' })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.permanentDelete(id, staffUser);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Attach supporting KYC/identity document or agreement to customer' })
  async addDocument(
    @Param('id') id: string,
    @Body() dto: AddCustomerDocumentDto,
    @CurrentUser() staffUser: { id: string; role: UserRole },
  ) {
    return this.customersService.addDocument(id, dto, staffUser);
  }

  @Post(':id/photograph')
  @ApiOperation({ summary: 'Update customer biometric photograph via camera snapshot or upload' })
  async updatePhotograph(
    @Param('id') id: string,
    @Body('cameraPhotoBase64') cameraPhotoBase64?: string,
    @Body('photoBase64') photoBase64?: string,
    @Body('photoUrl') photoUrl?: string,
    @Body('photoSource') photoSource?: PhotoSource,
    @CurrentUser() staffUser?: { id: string; role: UserRole },
  ) {
    return this.customersService.updatePhotograph(
      id,
      {
        base64: photoBase64 || cameraPhotoBase64,
        fileUrl: photoUrl,
        source: photoSource || PhotoSource.CAMERA_CAPTURE,
      },
      staffUser!,
    );
  }
}

