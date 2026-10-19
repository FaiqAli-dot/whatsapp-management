import { randomUUID } from 'node:crypto';
import type {
  IWhatsAppProvider,
  ProviderHealth,
  SendResult,
  SendTemplateParams,
  SendTextParams,
} from './types.js';
import { logger } from '../lib/logger.js';

/**
 * Fully separated from production Meta path.
 * Every simulated event is marked simulated: true.
 */
export class SimulatorProvider implements IWhatsAppProvider {
  readonly name = 'simulator' as const;
  readonly simulated = true;

  /** Injected failure mode for tests */
  forceFail = false;

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    logger.info({
      msg: 'simulator_send_template',
      simulated: true,
      to: params.toE164.slice(0, 4) + '***',
      template: params.templateName,
    });
    if (this.forceFail || params.toE164.endsWith('0000')) {
      const err = new Error('SIMULATED_SEND_FAILURE');
      (err as Error & { code: string }).code = 'SIMULATED_SEND_FAILURE';
      throw err;
    }
    return {
      providerMessageId: `sim_out_${randomUUID()}`,
      accepted: true,
      simulated: true,
    };
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    logger.info({
      msg: 'simulator_send_text',
      simulated: true,
      to: params.toE164.slice(0, 4) + '***',
    });
    if (this.forceFail) {
      throw new Error('SIMULATED_SEND_FAILURE');
    }
    return {
      providerMessageId: `sim_out_${randomUUID()}`,
      accepted: true,
      simulated: true,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, message: 'Simulator healthy', simulated: true };
  }
}

export const simulatorProvider = new SimulatorProvider();
