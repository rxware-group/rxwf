import { registerCredentialType } from './registry.js';
import { apiKeyCredentialType } from './generic/api-key.js';
import { httpHeaderAuthCredentialType } from './generic/http-header-auth.js';
import { basicAuthCredentialType } from './generic/basic-auth.js';
import { oauth2ManualCredentialType } from './generic/oauth2-manual.js';

let registered = false;

export function registerGenericCredentialTypes(): void {
  if (registered) return;
  registerCredentialType(apiKeyCredentialType);
  registerCredentialType(httpHeaderAuthCredentialType);
  registerCredentialType(basicAuthCredentialType);
  registerCredentialType(oauth2ManualCredentialType);
  registered = true;
}
