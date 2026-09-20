import { isIP } from "node:net";

export type ControlConfig = {
  controlDatabaseUrl: string;
  siteReadonlyDatabaseUrl: string;
  origin: string;
  topnlabBaseUrl: string;
  topnlabKey: string;
  topnlabFeedUrl: string;
  adminUsername: string;
  adminPasswordHash: string;
  sessionSecret: string;
  allowedIps: string[];
};

type Environment = Record<string, string | undefined>;

function required(environment: Environment, name: keyof Environment): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireUrl(environment: Environment, name: keyof Environment): string {
  const value = required(environment, name);
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function requireOrigin(environment: Environment): string {
  const origin = required(environment, "CONTROL_ORIGIN");
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin) {
      throw new Error();
    }
    return origin;
  } catch {
    throw new Error("CONTROL_ORIGIN must be an exact HTTPS origin");
  }
}

function readAllowedIps(environment: Environment): string[] {
  const raw = environment.CONTROL_ALLOWED_IPS?.trim();
  if (!raw) return [];

  const ips = raw.split(",").map((ip) => ip.trim());
  if (ips.some((ip) => !ip || isIP(ip) === 0)) {
    throw new Error("CONTROL_ALLOWED_IPS must contain comma-separated IP addresses");
  }
  return [...new Set(ips)];
}

export function readControlConfig(environment: Environment = process.env): ControlConfig {
  const sessionSecret = required(environment, "CONTROL_SESSION_SECRET");
  if (Buffer.byteLength(sessionSecret, "utf8") < 32) {
    throw new Error("CONTROL_SESSION_SECRET must be at least 32 bytes");
  }

  return {
    controlDatabaseUrl: requireUrl(environment, "CONTROL_DATABASE_URL"),
    siteReadonlyDatabaseUrl: requireUrl(environment, "SITE_READONLY_DATABASE_URL"),
    origin: requireOrigin(environment),
    topnlabBaseUrl: requireUrl(environment, "TOPNLAB_BASE_URL"),
    topnlabKey: required(environment, "TOPNLAB_KEY"),
    topnlabFeedUrl: requireUrl(environment, "TOPNLAB_FEED_URL"),
    adminUsername: required(environment, "CONTROL_ADMIN_USERNAME"),
    adminPasswordHash: required(environment, "CONTROL_ADMIN_PASSWORD_HASH"),
    sessionSecret,
    allowedIps: readAllowedIps(environment),
  };
}
