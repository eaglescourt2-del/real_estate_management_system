import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppSendResult {
  success: boolean;
  externalMessageId?: string;
  failureReason?: string;
}

export interface WhatsAppWebhookStatusItem {
  externalMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  recipientId?: string;
  timestamp: Date;
  failureReason?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiToken: string | null;
  private readonly phoneNumberId: string | null;
  private readonly verifyToken: string;

  constructor(private readonly configService: ConfigService) {
    this.apiToken = this.configService.get<string>('WHATSAPP_API_TOKEN') || null;
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '0541196364';
    this.verifyToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || 'ghana_real_estate_webhook_token_2026';
  }

  /**
   * Normalizes Ghana telephone numbers to WhatsApp Cloud API format (E.164 without leading '+').
   * Examples:
   *  +233244123456 -> 233244123456
   *  0244123456    -> 233244123456
   *  233244123456  -> 233244123456
   */
  public formatToWhatsAppPhone(rawPhone: string): string {
    const cleaned = rawPhone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1);
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `233${cleaned.substring(1)}`;
    }
    if (cleaned.startsWith('233')) {
      return cleaned;
    }
    return cleaned;
  }

  /**
   * Dispatches WhatsApp message via Meta Cloud API or mock driver in test/dev
   */
  async sendMessage(
    to: string,
    messageBody: string,
    dynamicConfig?: { apiToken?: string | null; phoneNumberId?: string | null },
  ): Promise<WhatsAppSendResult> {
    const formattedRecipient = this.formatToWhatsAppPhone(to);
    const token = dynamicConfig?.apiToken || this.apiToken;
    const phoneId = dynamicConfig?.phoneNumberId || this.phoneNumberId;

    // If Cloud API credentials are not configured, simulate delivery in development/mock mode
    if (!token) {
      const mockId = `wamid.MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      this.logger.warn(
        `[SIMULATION MODE] WhatsApp Cloud API token not set. Message to +${formattedRecipient} simulated. [Assigned Mock ID: ${mockId}]`,
      );
      return {
        success: false,
        failureReason: 'WhatsApp Cloud API token not configured. Use the green "Send via WhatsApp Web" button to deliver directly to the customer.',
        externalMessageId: mockId,
      };
    }

    try {
      const endpoint = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: messageBody,
          },
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData?.error?.message || `WhatsApp API HTTP ${response.status}`;
        this.logger.error(`Failed to send WhatsApp message to +${formattedRecipient}: ${errorMsg}`);
        return {
          success: false,
          failureReason: errorMsg,
        };
      }

      const messageId = responseData?.messages?.[0]?.id || `wamid.${Date.now()}`;
      this.logger.log(`WhatsApp message sent successfully to +${formattedRecipient}. ID: ${messageId}`);

      return {
        success: true,
        externalMessageId: messageId,
      };
    } catch (err: any) {
      const errDetail = err?.message || 'Network error communicating with WhatsApp Cloud API';
      this.logger.error(`Exception dispatching WhatsApp message: ${errDetail}`);
      return {
        success: false,
        failureReason: errDetail,
      };
    }
  }

  /**
   * Meta Webhook Verification Handshake
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully.');
      return challenge;
    }
    this.logger.warn(`WhatsApp webhook verification failed. Token mismatch or invalid mode: ${mode}`);
    return null;
  }

  /**
   * Parse status updates from incoming Meta WhatsApp Cloud Webhooks
   */
  parseWebhookStatuses(payload: any): WhatsAppWebhookStatusItem[] {
    const results: WhatsAppWebhookStatusItem[] = [];

    try {
      const entry = payload?.entry;
      if (!Array.isArray(entry)) return results;

      for (const e of entry) {
        const changes = e?.changes;
        if (!Array.isArray(changes)) continue;

        for (const c of changes) {
          const statuses = c?.value?.statuses;
          if (!Array.isArray(statuses)) continue;

          for (const s of statuses) {
            const externalMessageId = s?.id;
            const statusRaw = s?.status; // 'sent', 'delivered', 'read', 'failed'
            const recipientId = s?.recipient_id;
            const timestamp = s?.timestamp ? new Date(parseInt(s.timestamp, 10) * 1000) : new Date();

            let mappedStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT';
            let failureReason: string | undefined = undefined;

            if (statusRaw === 'delivered') mappedStatus = 'DELIVERED';
            else if (statusRaw === 'read') mappedStatus = 'READ';
            else if (statusRaw === 'failed') {
              mappedStatus = 'FAILED';
              failureReason = s?.errors?.[0]?.title || s?.errors?.[0]?.message || 'WhatsApp delivery failed';
            }

            if (externalMessageId) {
              results.push({
                externalMessageId,
                status: mappedStatus,
                recipientId,
                timestamp,
                failureReason,
              });
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error parsing WhatsApp webhook payload: ${err.message}`);
    }

    return results;
  }
}

