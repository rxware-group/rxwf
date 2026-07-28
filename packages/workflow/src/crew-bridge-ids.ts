/** Bridge token id for Sidecar credential resolution (matches tool bridge HMAC). */
export function crewCredentialBridgeId(credentialRef: string): string {
  return `credential:${credentialRef}`;
}
