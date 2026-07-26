import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const ALLOWED_TOOLS = new Set(["pg_dump", "psql"]);
const CLEARED_LIBPQ_KEYS = [
  "PGCONNECT_TIMEOUT",
  "PGDATABASE",
  "PGHOST",
  "PGOPTIONS",
  "PGPASSWORD",
  "PGPASSFILE",
  "PGPORT",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGSSLMODE",
  "PGUSER",
];

function decoded(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`DATABASE_URL contains an invalid encoded ${label}`);
  }
}

export function buildPostgresEnvironment(databaseUrl, baseEnvironment = {}) {
  if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use postgresql:// or postgres://");
  }
  if (!url.hostname || !url.username || url.pathname.length <= 1) {
    throw new Error("DATABASE_URL must contain host, user, and database");
  }

  const schema = url.searchParams.get("schema");
  if (schema !== null && schema !== "public") {
    throw new Error("baseline release supports only the public database schema");
  }

  const environment = { ...baseEnvironment };
  delete environment.DATABASE_URL;
  for (const key of CLEARED_LIBPQ_KEYS) delete environment[key];

  environment.PGHOST = url.hostname.replace(/^\[(.*)\]$/, "$1");
  environment.PGPORT = url.port || "5432";
  environment.PGDATABASE = decoded(url.pathname.slice(1), "database name");
  environment.PGUSER = decoded(url.username, "username");
  if (url.password) environment.PGPASSWORD = decoded(url.password, "password");

  const sslMode = url.searchParams.get("sslmode");
  if (sslMode) environment.PGSSLMODE = sslMode;
  const connectTimeout = url.searchParams.get("connect_timeout");
  if (connectTimeout) environment.PGCONNECT_TIMEOUT = connectTimeout;

  return environment;
}

export async function runPostgresTool(tool, args, environment = process.env) {
  if (!ALLOWED_TOOLS.has(tool)) {
    throw new Error("allowed PostgreSQL tools are pg_dump and psql");
  }

  const child = spawn(tool, args, {
    env: buildPostgresEnvironment(environment.DATABASE_URL, environment),
    shell: false,
    stdio: "inherit",
  });

  return await new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error(`${tool} could not be started`)));
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${tool} stopped by signal ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const [, , tool, ...args] = process.argv;
  runPostgresTool(tool, args)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "PostgreSQL tool failed");
      process.exitCode = 1;
    });
}
