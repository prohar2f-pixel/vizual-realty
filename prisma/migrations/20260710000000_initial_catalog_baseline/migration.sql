-- Baseline for clean installations. Existing installations that already have
-- the Agent and Property tables must preflight the schema and mark this
-- migration applied before running `prisma migrate deploy`.
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "shortId" INTEGER,
    "deal" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "rooms" INTEGER,
    "area" DOUBLE PRECISION,
    "city" TEXT,
    "district" TEXT,
    "address" TEXT,
    "description" TEXT,
    "photos" TEXT[] NOT NULL,
    "isFeed" BOOLEAN NOT NULL DEFAULT true,
    "agentId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
