-- CreateTable
CREATE TABLE "FeaturedProperty" (
    "propertyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedProperty_pkey" PRIMARY KEY ("propertyId"),
    CONSTRAINT "FeaturedProperty_position_check" CHECK ("position" BETWEEN 1 AND 3)
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB NOT NULL,
    "previousPublished" JSONB,
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedProperty_position_key" ON "FeaturedProperty"("position");

-- AddForeignKey
ALTER TABLE "FeaturedProperty" ADD CONSTRAINT "FeaturedProperty_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the initial selection without making content JSON part of the migration.
INSERT INTO "FeaturedProperty" ("propertyId", "position", "updatedAt")
SELECT "id", "position", CURRENT_TIMESTAMP
FROM (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "price" DESC)::INTEGER AS "position"
    FROM "Property"
    WHERE "isFeed" = true
    ORDER BY "price" DESC
    LIMIT 3
) AS "initialFeatured";
