-- Run against an existing Vizual Realty database before marking the catalog
-- baseline migration as applied. psql must be started with ON_ERROR_STOP=1.
DO $preflight$
DECLARE
    problems TEXT;
BEGIN
    IF to_regclass('public."Agent"') IS NULL OR
       to_regclass('public."Property"') IS NULL THEN
        RAISE EXCEPTION 'baseline preflight failed: Agent or Property table is missing';
    END IF;

    IF to_regclass('public."SiteContent"') IS NOT NULL OR
       to_regclass('public."FeaturedProperty"') IS NOT NULL THEN
        RAISE EXCEPTION 'baseline preflight failed: admin tables already exist';
    END IF;

    WITH expected(table_name, column_name, data_type, is_nullable) AS (
        VALUES
            ('Agent', 'id', 'text', 'NO'),
            ('Agent', 'name', 'text', 'NO'),
            ('Agent', 'phone', 'text', 'YES'),
            ('Agent', 'photoUrl', 'text', 'YES'),
            ('Property', 'id', 'text', 'NO'),
            ('Property', 'shortId', 'integer', 'YES'),
            ('Property', 'deal', 'text', 'NO'),
            ('Property', 'objectType', 'text', 'NO'),
            ('Property', 'title', 'text', 'NO'),
            ('Property', 'price', 'integer', 'NO'),
            ('Property', 'rooms', 'integer', 'YES'),
            ('Property', 'area', 'double precision', 'YES'),
            ('Property', 'city', 'text', 'YES'),
            ('Property', 'district', 'text', 'YES'),
            ('Property', 'address', 'text', 'YES'),
            ('Property', 'description', 'text', 'YES'),
            ('Property', 'photos', 'ARRAY', 'NO'),
            ('Property', 'isFeed', 'boolean', 'NO'),
            ('Property', 'agentId', 'text', 'YES'),
            ('Property', 'updatedAt', 'timestamp without time zone', 'NO')
    )
    SELECT string_agg(
        format('%I.%I expected %s nullable=%s',
            expected.table_name,
            expected.column_name,
            expected.data_type,
            expected.is_nullable),
        '; '
    )
    INTO problems
    FROM expected
    LEFT JOIN information_schema.columns actual
      ON actual.table_schema = 'public'
     AND actual.table_name = expected.table_name
     AND actual.column_name = expected.column_name
     AND actual.data_type = expected.data_type
     AND actual.is_nullable = expected.is_nullable
    WHERE actual.column_name IS NULL;

    IF problems IS NOT NULL THEN
        RAISE EXCEPTION 'baseline preflight failed: %', problems;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public."Agent"'::regclass
          AND conname = 'Agent_pkey'
          AND contype = 'p'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public."Property"'::regclass
          AND conname = 'Property_pkey'
          AND contype = 'p'
    ) THEN
        RAISE EXCEPTION 'baseline preflight failed: primary key mismatch';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public."Property"'::regclass
          AND confrelid = 'public."Agent"'::regclass
          AND conname = 'Property_agentId_fkey'
          AND contype = 'f'
          AND confdeltype = 'n'
          AND confupdtype = 'c'
    ) THEN
        RAISE EXCEPTION 'baseline preflight failed: Property agent foreign key mismatch';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        JOIN pg_attrdef definition
          ON definition.adrelid = attribute.attrelid
         AND definition.adnum = attribute.attnum
        WHERE attribute.attrelid = 'public."Property"'::regclass
          AND attribute.attname = 'isFeed'
          AND pg_get_expr(definition.adbin, definition.adrelid) IN ('true', 'TRUE')
    ) THEN
        RAISE EXCEPTION 'baseline preflight failed: Property.isFeed default mismatch';
    END IF;

    RAISE NOTICE 'baseline_preflight_ok';
END
$preflight$;
