import { getEnv } from '../config/env.js';
import { metaProvider } from './metaProvider.js';
import { simulatorProvider } from './simulatorProvider.js';
import type { IWhatsAppProvider } from './types.js';

export function getWhatsAppProvider(connectionMode?: 'simulator' | 'meta'): IWhatsAppProvider {
  const env = getEnv();
  const mode = connectionMode ?? env.WHATSAPP_MODE;

  // Hard rule: test env cannot send live
  if (env.NODE_ENV === 'test') {
    return simulatorProvider;
  }

  if (mode === 'meta' && env.WHATSAPP_MODE === 'meta') {
    return metaProvider;
  }
  return simulatorProvider;
}

export { simulatorProvider, metaProvider };
export * from './types.js';
export { verifyMetaSignature } from './metaProvider.js';
