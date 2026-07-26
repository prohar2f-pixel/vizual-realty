import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASELINE_MIGRATION = "20260710000000_initial_catalog_baseline";
const SYSTEM_ENV_KEYS = [
  "PATH",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
];
const DEFAULT_PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

function safeError(message) {
  return new Error(`database release failed: ${message}`);
}

function decodeUrlPart(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw safeError(`DATABASE_URL contains an invalid encoded ${label}`);
  }
}

function parseDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
    throw safeError("DATABASE_URL is missing from protected .env");
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw safeError("DATABASE_URL is not a valid URL");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw safeError("DATABASE_URL must use postgresql:// or postgres://");
  }
  if (!url.hostname || !url.username || url.pathname.length <= 1) {
    throw safeError("DATABASE_URL must contain host, user, and database");
  }

  const schema = url.searchParams.get("schema") ?? "public";
  if (schema !== "public") {
    throw safeError("baseline release supports only the public database schema");
  }

  return Object.freeze({
    original: databaseUrl,
    host: url.hostname.replace(/^\[(.*)\]$/, "$1"),
    port: url.port || "5432",
    database: decodeUrlPart(url.pathname.slice(1), "database name"),
    user: decodeUrlPart(url.username, "username"),
    password: url.password ? decodeUrlPart(url.password, "password") : undefined,
    schema,
    sslMode: url.searchParams.get("sslmode") ?? undefined,
    connectTimeout: url.searchParams.get("connect_timeout") ?? undefined,
  });
}

function minimalSystemEnvironment(sourceEnvironment) {
  const result = {};
  const entries = Object.entries(sourceEnvironment);
  for (const wantedKey of SYSTEM_ENV_KEYS) {
    const entry = entries.find(
      ([key, value]) =>
        key.toUpperCase() === wantedKey && typeof value === "string",
    );
    if (entry) result[wantedKey] = entry[1];
  }
  return result;
}

function childEnvironments(connection, sourceEnvironment) {
  const system = minimalSystemEnvironment(sourceEnvironment);
  const libpq = {
    ...system,
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGDATABASE: connection.database,
    PGUSER: connection.user,
    PGOPTIONS: `-c search_path=${connection.schema}`,
  };
  if (connection.password !== undefined) libpq.PGPASSWORD = connection.password;
  if (connection.sslMode !== undefined) libpq.PGSSLMODE = connection.sslMode;
  if (connection.connectTimeout !== undefined) {
    libpq.PGCONNECT_TIMEOUT = connection.connectTimeout;
  }

  return Object.freeze({
    libpq: Object.freeze(libpq),
    application: Object.freeze({
      ...system,
      DATABASE_URL: connection.original,
    }),
  });
}

function readProtectedDatabaseUrl(envFile) {
  let fileStat;
  try {
    fileStat = statSync(envFile);
  } catch {
    throw safeError("protected .env is unavailable");
  }
  if (!fileStat.isFile()) throw safeError("protected .env is not a file");
  if (process.platform !== "win32" && (fileStat.mode & 0o077) !== 0) {
    throw safeError("protected .env must not be accessible to group or others");
  }

  let parsed;
  try {
    parsed = parseEnv(readFileSync(envFile, "utf8"));
  } catch {
    throw safeError("protected .env could not be parsed");
  }
  return parsed.DATABASE_URL;
}

async function spawnRunner(call) {
  const child = spawn(call.command, call.args, {
    cwd: call.cwd,
    env: call.env,
    shell: false,
    stdio: "inherit",
  });
  const code = await new Promise((resolveCode, reject) => {
    child.once("error", () => reject(safeError(`${call.tool} could not be started`)));
    child.once("exit", (exitCode, signal) => {
      if (signal) reject(safeError(`${call.tool} stopped by signal ${signal}`));
      else resolveCode(exitCode ?? 1);
    });
  });
  if (code !== 0) throw safeError(`${call.tool} exited with code ${code}`);
}

async function invoke(runner, call) {
  const code = await runner(call);
  if (typeof code === "number" && code !== 0) {
    throw safeError(`${call.tool} exited with code ${code}`);
  }
}

export function parseReleaseCommand(args) {
  const [action] = args;
  if (action === "deploy-fresh") {
    if (args.length !== 1) {
      throw safeError("deploy-fresh does not accept extra arguments");
    }
    return { action };
  }
  if (action === "upgrade-existing") {
    if (args.length !== 2) {
      throw safeError("upgrade-existing requires exactly one backup output path");
    }
    const backupOutput = args[1];
    if (
      backupOutput.startsWith("-") ||
      /^[a-z][a-z\d+.-]*:\/\//i.test(backupOutput)
    ) {
      throw safeError("backup output must be a filesystem path");
    }
    return { action, backupOutput: resolve(backupOutput) };
  }
  throw safeError("unknown release action");
}

export async function runReleaseAction({
  action,
  backupOutput,
  envFile,
  projectRoot = DEFAULT_PROJECT_ROOT,
  sourceEnvironment = process.env,
  runner = spawnRunner,
}) {
  if (action !== "upgrade-existing" && action !== "deploy-fresh") {
    throw safeError("unknown release action");
  }
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedEnvFile = resolve(envFile ?? join(process.cwd(), ".env"));
  const connection = parseDatabaseUrl(readProtectedDatabaseUrl(resolvedEnvFile));
  const environments = childEnvironments(connection, sourceEnvironment);
  const isolatedChildCwd = mkdtempSync(join(tmpdir(), "vizual-release-child-"));
  const prismaConfig = join(
    resolvedProjectRoot,
    "scripts",
    "prisma-release.config.ts",
  );
  const prismaCli = join(
    resolvedProjectRoot,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  const tsxCli = join(
    resolvedProjectRoot,
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const seed = join(resolvedProjectRoot, "scripts", "seed-admin-content.ts");

  const call = (tool, command, args, env) =>
    invoke(runner, {
      tool,
      command,
      args,
      env,
      cwd: isolatedChildCwd,
    });

  try {
    if (action === "upgrade-existing") {
      if (typeof backupOutput !== "string") {
        throw safeError("upgrade-existing requires a backup output path");
      }
      const resolvedBackup = isAbsolute(backupOutput)
        ? backupOutput
        : resolve(backupOutput);
      if (existsSync(resolvedBackup)) {
        throw safeError("backup output already exists; refusing to overwrite it");
      }
      const backupDirectory = dirname(resolvedBackup);
      if (!existsSync(backupDirectory) || !statSync(backupDirectory).isDirectory()) {
        throw safeError("backup output directory does not exist");
      }

      await call(
        "pg_dump",
        "pg_dump",
        ["--format=custom", `--file=${resolvedBackup}`],
        environments.libpq,
      );
      if (
        !existsSync(resolvedBackup) ||
        !statSync(resolvedBackup).isFile() ||
        statSync(resolvedBackup).size === 0
      ) {
        throw safeError("pg_dump did not create a non-empty backup");
      }
      await call(
        "psql",
        "psql",
        [
          "-X",
          "--set",
          "ON_ERROR_STOP=1",
          "--file",
          join(resolvedProjectRoot, "scripts", "preflight-admin-baseline.sql"),
        ],
        environments.libpq,
      );
      await call(
        "prisma",
        process.execPath,
        [
          prismaCli,
          "--config",
          prismaConfig,
          "migrate",
          "resolve",
          "--applied",
          BASELINE_MIGRATION,
        ],
        environments.application,
      );
    }

    await call(
      "prisma",
      process.execPath,
      [prismaCli, "--config", prismaConfig, "migrate", "deploy"],
      environments.application,
    );
    await call("tsx", process.execPath, [tsxCli, seed], environments.application);
    await call("tsx", process.execPath, [tsxCli, seed], environments.application);
  } finally {
    rmSync(isolatedChildCwd, { recursive: true, force: true });
  }
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  let command;
  try {
    command = parseReleaseCommand(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "database release failed");
    process.exitCode = 1;
  }
  if (command) {
    runReleaseAction(command).catch((error) => {
      console.error(error instanceof Error ? error.message : "database release failed");
      process.exitCode = 1;
    });
  }
}
