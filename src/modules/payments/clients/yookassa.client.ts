import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

type YooKassaCreatePaymentParams = {
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  idempotenceKey: string;
};

type YooKassaPaymentResponse = {
  id: string;
  status: string;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
};

@Injectable()
export class YooKassaClient {
  private readonly apiBaseUrl = 'https://api.yookassa.ru/v3';
  private readonly shopId: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.shopId = this.configService.get<string>('payments.yookassa.shopId', '');
    this.secretKey = this.configService.get<string>('payments.yookassa.secretKey', '');
  }

  async createPayment(params: YooKassaCreatePaymentParams): Promise<YooKassaPaymentResponse> {
    if (!this.shopId || !this.secretKey) {
      return {
        id: `mock-${randomUUID()}`,
        status: 'pending',
        confirmation: {
          type: 'redirect',
          confirmation_url: `${params.returnUrl}?mockPaymentId=${randomUUID()}`,
        },
      };
    }

    const basicToken = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
    const response = await fetch(`${this.apiBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Idempotence-Key': params.idempotenceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: {
          value: params.amount.toFixed(2),
          currency: params.currency,
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: params.returnUrl,
        },
        description: params.description,
        metadata: params.metadata,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`YooKassa create payment failed: ${response.status} ${message}`);
    }

    return (await response.json()) as YooKassaPaymentResponse;
  }
}
