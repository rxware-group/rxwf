/** Postgres node parameter helpers (save validation). */

export type PostgresValidationIssue = {
  code: 'E2002';
  message: string;
};

export function validatePostgresParameters(
  parameters: Record<string, unknown>,
): PostgresValidationIssue | null {
  if (parameters.query == null) {
    return null;
  }
  const query = String(parameters.query);
  if (query.length > 0 && query.trim() === '') {
    return {
      code: 'E2002',
      message: 'postgres query must not be blank',
    };
  }
  return null;
}
