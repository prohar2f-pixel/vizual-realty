import { Prisma } from "../../generated/prisma/client";

const SITE_CONTENT_LOCK_NAMESPACE = 1_448_765_013;
const SITE_CONTENT_LOCK_KEY = 1;

type QueryClient = {
  $queryRaw<T>(query: unknown): Promise<T>;
};

type TransactionHost = {
  $transaction<T>(
    run: (transaction: unknown) => Promise<T>,
  ): Promise<T>;
};

export async function acquireSiteContentMutationLock(
  client: QueryClient,
) {
  await client.$queryRaw<unknown>(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      ${SITE_CONTENT_LOCK_NAMESPACE},
      ${SITE_CONTENT_LOCK_KEY}
    )
  `);
}

export async function withSiteContentMutationLock<T>(
  rawClient: unknown,
  run: (transaction: unknown) => Promise<T>,
) {
  const client = rawClient as TransactionHost;
  return client.$transaction(async (transaction) => {
    await acquireSiteContentMutationLock(transaction as QueryClient);
    return run(transaction);
  });
}
