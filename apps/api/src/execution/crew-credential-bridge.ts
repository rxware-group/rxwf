export function crewCredentialBridgeId(credentialRef: string): string {
  return `credential:${credentialRef}`;
}

export function extractApiKeyFromCredentialData(
  data: Record<string, string>,
): string {
  return (
    data.apiKey?.trim() ||
    data.accessToken?.trim() ||
    data.API_KEY?.trim() ||
    ''
  );
}
