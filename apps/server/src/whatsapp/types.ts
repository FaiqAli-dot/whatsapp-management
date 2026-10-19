export interface SendTemplateParams {
  toE164: string;
  templateName: string;
  templateLanguage: string;
  components?: unknown[];
  /** Merchant connection credentials (already decrypted by caller) */
  accessToken: string;
  phoneNumberId: string;
}

export interface SendTextParams {
  toE164: string;
  body: string;
  accessToken: string;
  phoneNumberId: string;
}

export interface SendResult {
  providerMessageId: string;
  accepted: boolean;
  simulated: boolean;
  raw?: unknown;
}

export interface ProviderHealth {
  ok: boolean;
  message: string;
  simulated: boolean;
}

export interface IWhatsAppProvider {
  readonly name: 'meta' | 'simulator';
  readonly simulated: boolean;
  sendTemplate(params: SendTemplateParams): Promise<SendResult>;
  sendText(params: SendTextParams): Promise<SendResult>;
  healthCheck(params: { accessToken: string; phoneNumberId: string }): Promise<ProviderHealth>;
}

/** Test mode must be unable to send live messages. */
export function assertNotLiveInTest(mode: string, nodeEnv: string): void {
  if (nodeEnv === 'test' && mode === 'meta') {
    throw new Error('Live Meta WhatsApp sends are forbidden in test environment');
  }
}
