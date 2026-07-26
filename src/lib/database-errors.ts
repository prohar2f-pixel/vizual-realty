const DATABASE_AVAILABILITY_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1009",
  "P1010",
  "P1011",
  "P1013",
  "P1017",
  "P2037",
]);

// Prisma 7 raw queries wrap adapter-pg failures in P2010. Only the adapter
// causes that represent connectivity, TLS, pool exhaustion, or timeouts are
// safe public fallbacks; PostgreSQL query errors must remain visible.
const RAW_QUERY_AVAILABILITY_KINDS = new Set([
  "DatabaseNotReachable",
  "ConnectionClosed",
  "TlsConnectionError",
  "SocketTimeout",
  "TooManyConnections",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function driverAdapterCauseKind(meta: unknown): string | null {
  const driverAdapterError = asRecord(asRecord(meta)?.driverAdapterError);
  const cause = asRecord(driverAdapterError?.cause);
  return typeof cause?.kind === "string" ? cause.kind : null;
}

export function isDatabaseAvailabilityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "PrismaClientInitializationError") return true;
  if (error.name !== "PrismaClientKnownRequestError") return false;

  const requestError = error as Error & { code?: unknown; meta?: unknown };
  if (typeof requestError.code !== "string") return false;
  if (requestError.code === "P2010") {
    const kind = driverAdapterCauseKind(requestError.meta);
    return kind !== null && RAW_QUERY_AVAILABILITY_KINDS.has(kind);
  }
  return DATABASE_AVAILABILITY_CODES.has(requestError.code);
}
