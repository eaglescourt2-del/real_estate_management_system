import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly SETTING_ID = 'SYSTEM_CONFIG';

  constructor(private prisma: PrismaService) {}

  async getSettings(maskSecrets = true) {
    let settings = await this.prisma.systemSetting.findUnique({
      where: { id: this.SETTING_ID },
    });

    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          id: this.SETTING_ID,
          companyName: 'Potential Investment Real Estate Ltd.',
          companyTagline: 'Your Trusted Partner in Land Sales',
          companyEmail: 'potentialrealestate04@gmail.com',
          companyPhone: '0541196364',
          companyAddress: 'Ashaiman New Tulaku, Adjacent to New Tulaku Police Station.',
          companyLogoUrl: '/uploads/logo.png',
          defaultCurrency: 'GHS',
          currencySymbol: 'GH₵',
          emailFromAddress: 'potentialrealestate04@gmail.com',
          whatsappPhoneNumberId: '0541196364',
        },
      });
    }

    if (maskSecrets) {
      return {
        ...settings,
        paystackSecretKey: settings.paystackSecretKey ? '••••••••••••••••' : null,
        flutterwaveSecretKey: settings.flutterwaveSecretKey ? '••••••••••••••••' : null,
        whatsappAccessToken: settings.whatsappAccessToken ? '••••••••••••••••' : null,
        resendApiKey: settings.resendApiKey ? '••••••••••••••••' : null,
      };
    }

    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const dataToUpdate: any = { ...dto };

    // Ignore placeholder masked values
    if (dataToUpdate.paystackSecretKey === '••••••••••••••••') delete dataToUpdate.paystackSecretKey;
    if (dataToUpdate.flutterwaveSecretKey === '••••••••••••••••') delete dataToUpdate.flutterwaveSecretKey;
    if (dataToUpdate.whatsappAccessToken === '••••••••••••••••') delete dataToUpdate.whatsappAccessToken;
    if (dataToUpdate.resendApiKey === '••••••••••••••••') delete dataToUpdate.resendApiKey;

    const updated = await this.prisma.systemSetting.upsert({
      where: { id: this.SETTING_ID },
      update: dataToUpdate,
      create: {
        id: this.SETTING_ID,
        ...dataToUpdate,
      },
    });

    return {
      message: 'System settings and white-label branding updated successfully.',
      settings: updated,
    };
  }
}

