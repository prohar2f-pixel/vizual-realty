import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { readControlConfig } from "./config";

let client: PrismaClient | undefined;

export function getDb() {
  if (!client) {
    const adapter = new PrismaPg({ connectionString: readControlConfig().controlDatabaseUrl });
    client = new PrismaClient({ adapter });
  }
  return client;
}
