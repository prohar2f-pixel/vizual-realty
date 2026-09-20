import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { readControlConfig } from "./config";

const adapter = new PrismaPg({ connectionString: readControlConfig().controlDatabaseUrl });

export const db = new PrismaClient({ adapter });
