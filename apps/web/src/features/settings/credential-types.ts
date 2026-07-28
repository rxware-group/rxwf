export type CredentialFieldType = 'text' | 'secret' | 'select';

export type CredentialFieldSchema = {
  key: string;
  label: string;
  type: CredentialFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
};

export type CredentialTypeSummary = {
  id: string;
  displayName: string;
  description?: string;
  fields: CredentialFieldSchema[];
};

export type StoredCredential = {
  id: string;
  name: string;
  type: string;
};

export const GENERIC_CREDENTIAL_TYPE_IDS = [
  'apiKey',
  'httpHeaderAuth',
  'basicAuth',
  'oauth2Manual',
] as const;

export type GenericCredentialTypeId = (typeof GENERIC_CREDENTIAL_TYPE_IDS)[number];

export const HTTP_ACCEPTED_CREDENTIAL_TYPES: GenericCredentialTypeId[] = [
  'apiKey',
  'httpHeaderAuth',
  'basicAuth',
  'oauth2Manual',
];

export const AI_ACCEPTED_CREDENTIAL_TYPES: GenericCredentialTypeId[] = [
  'apiKey',
  'oauth2Manual',
];

export function filterCredentialsByAcceptedTypes(
  credentials: StoredCredential[],
  acceptedTypes?: string[],
): StoredCredential[] {
  if (!acceptedTypes?.length) return credentials;
  const allowed = new Set(acceptedTypes);
  return credentials.filter((credential) => allowed.has(credential.type));
}

export function resolveCredentialTypeDisplayName(
  typeId: string,
  types: CredentialTypeSummary[],
): string {
  return types.find((type) => type.id === typeId)?.displayName ?? typeId;
}

export function buildCredentialSelectOptions(
  credentials: StoredCredential[],
  types: CredentialTypeSummary[],
  noneLabel: string,
): Array<{ value: string; label: string }> {
  return [
    { value: '', label: noneLabel },
    ...credentials.map((credential) => ({
      value: credential.id,
      label: `${credential.name} (${resolveCredentialTypeDisplayName(credential.type, types)})`,
    })),
  ];
}

export function buildDefaultFieldValues(
  fields: CredentialFieldSchema[],
  previous: Record<string, string> = {},
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const field of fields) {
    next[field.key] = previous[field.key] ?? field.defaultValue ?? '';
  }
  return next;
}

export function validateRequiredCredentialFields(
  fields: CredentialFieldSchema[],
  values: Record<string, string>,
): string | null {
  for (const field of fields) {
    if (field.required && !values[field.key]?.trim()) {
      return `${field.label} is required`;
    }
  }
  return null;
}
