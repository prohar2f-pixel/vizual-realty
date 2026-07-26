-- Run against an existing Vizual Realty database before marking the catalog
-- baseline migration as applied. psql must be started with ON_ERROR_STOP=1.
-- The only accepted migration-history state is no _prisma_migrations table or
-- an empty one; any applied, failed, or partial row requires manual review.
DO $preflight$
DECLARE
    problems TEXT;
    migration_count BIGINT;
BEGIN
    IF to_regclass('public."Agent"') IS NULL OR
       to_regclass('public."Property"') IS NULL THEN
        RAISE EXCEPTION 'baseline preflight failed: Agent or Property table is missing';
    END IF;

    IF to_regclass('public."SiteContent"') IS NOT NULL OR
       to_regclass('public."FeaturedProperty"') IS NOT NULL THEN
        RAISE EXCEPTION 'baseline preflight failed: admin tables already exist';
    END IF;

    IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
        SELECT count(*)
        INTO migration_count
        FROM public."_prisma_migrations";

        IF migration_count <> 0 THEN
            RAISE EXCEPTION
                'baseline preflight failed: migration history is not empty (% row(s)); manual review required',
                migration_count;
        END IF;
    END IF;

    WITH expected(table_name, column_name, formatted_type, is_not_null, default_expression) AS (
        VALUES
            ('Agent', 'id', 'text', true, NULL::TEXT),
            ('Agent', 'name', 'text', true, NULL::TEXT),
            ('Agent', 'phone', 'text', false, NULL::TEXT),
            ('Agent', 'photoUrl', 'text', false, NULL::TEXT),
            ('Property', 'id', 'text', true, NULL::TEXT),
            ('Property', 'shortId', 'integer', false, NULL::TEXT),
            ('Property', 'deal', 'text', true, NULL::TEXT),
            ('Property', 'objectType', 'text', true, NULL::TEXT),
            ('Property', 'title', 'text', true, NULL::TEXT),
            ('Property', 'price', 'integer', true, NULL::TEXT),
            ('Property', 'rooms', 'integer', false, NULL::TEXT),
            ('Property', 'area', 'double precision', false, NULL::TEXT),
            ('Property', 'city', 'text', false, NULL::TEXT),
            ('Property', 'district', 'text', false, NULL::TEXT),
            ('Property', 'address', 'text', false, NULL::TEXT),
            ('Property', 'description', 'text', false, NULL::TEXT),
            ('Property', 'photos', 'text[]', true, NULL::TEXT),
            ('Property', 'isFeed', 'boolean', true, 'true'),
            ('Property', 'agentId', 'text', false, NULL::TEXT),
            ('Property', 'updatedAt', 'timestamp(3) without time zone', true, NULL::TEXT)
    ),
    actual AS (
        SELECT
            relation.relname::TEXT AS table_name,
            attribute.attname::TEXT AS column_name,
            format_type(attribute.atttypid, attribute.atttypmod) AS formatted_type,
            attribute.attnotnull AS is_not_null,
            pg_get_expr(definition.adbin, definition.adrelid) AS default_expression
        FROM pg_class relation
        JOIN pg_namespace namespace
          ON namespace.oid = relation.relnamespace
        JOIN pg_attribute attribute
          ON attribute.attrelid = relation.oid
         AND attribute.attnum > 0
         AND NOT attribute.attisdropped
        LEFT JOIN pg_attrdef definition
          ON definition.adrelid = attribute.attrelid
         AND definition.adnum = attribute.attnum
        WHERE namespace.nspname = 'public'
          AND relation.relname IN ('Agent', 'Property')
    ),
    issues AS (
        SELECT format(
            '%I.%I expected type=%s not_null=%s default=%s; actual type=%s not_null=%s default=%s',
            expected.table_name,
            expected.column_name,
            expected.formatted_type,
            expected.is_not_null,
            coalesce(expected.default_expression, '<none>'),
            coalesce(actual.formatted_type, '<missing>'),
            coalesce(actual.is_not_null::TEXT, '<missing>'),
            coalesce(actual.default_expression, '<none>')
        ) AS problem
        FROM expected
        LEFT JOIN actual
          ON actual.table_name = expected.table_name
         AND actual.column_name = expected.column_name
        WHERE actual.column_name IS NULL
           OR actual.formatted_type <> expected.formatted_type
           OR actual.is_not_null <> expected.is_not_null
           OR actual.default_expression IS DISTINCT FROM expected.default_expression

        UNION ALL

        SELECT format('unexpected column %I.%I', actual.table_name, actual.column_name)
        FROM actual
        LEFT JOIN expected
          ON expected.table_name = actual.table_name
         AND expected.column_name = actual.column_name
        WHERE expected.column_name IS NULL
    )
    SELECT string_agg(problem, '; ' ORDER BY problem)
    INTO problems
    FROM issues;

    IF problems IS NOT NULL THEN
        RAISE EXCEPTION 'baseline preflight failed: %', problems;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_record
        WHERE constraint_record.conrelid = 'public."Agent"'::regclass
          AND constraint_record.conname = 'Agent_pkey'
          AND constraint_record.contype = 'p'
          AND constraint_record.conkey = ARRAY[
              (SELECT attnum::SMALLINT
               FROM pg_attribute
               WHERE attrelid = 'public."Agent"'::regclass
                 AND attname = 'id')
          ]::SMALLINT[]
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_record
        WHERE constraint_record.conrelid = 'public."Property"'::regclass
          AND constraint_record.conname = 'Property_pkey'
          AND constraint_record.contype = 'p'
          AND constraint_record.conkey = ARRAY[
              (SELECT attnum::SMALLINT
               FROM pg_attribute
               WHERE attrelid = 'public."Property"'::regclass
                 AND attname = 'id')
          ]::SMALLINT[]
    ) OR (
        SELECT count(*)
        FROM pg_constraint
        WHERE conrelid IN ('public."Agent"'::regclass, 'public."Property"'::regclass)
          AND contype = 'p'
    ) <> 2 THEN
        RAISE EXCEPTION 'baseline preflight failed: primary key columns mismatch';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_record
        WHERE constraint_record.conrelid = 'public."Property"'::regclass
          AND constraint_record.confrelid = 'public."Agent"'::regclass
          AND constraint_record.conname = 'Property_agentId_fkey'
          AND constraint_record.contype = 'f'
          AND constraint_record.conkey = ARRAY[
              (SELECT attnum::SMALLINT
               FROM pg_attribute
               WHERE attrelid = 'public."Property"'::regclass
                 AND attname = 'agentId')
          ]::SMALLINT[]
          AND constraint_record.confkey = ARRAY[
              (SELECT attnum::SMALLINT
               FROM pg_attribute
               WHERE attrelid = 'public."Agent"'::regclass
                 AND attname = 'id')
          ]::SMALLINT[]
          AND constraint_record.confdeltype = 'n'
          AND constraint_record.confupdtype = 'c'
    ) OR (
        SELECT count(*)
        FROM pg_constraint
        WHERE conrelid IN ('public."Agent"'::regclass, 'public."Property"'::regclass)
          AND contype = 'f'
    ) <> 1 THEN
        RAISE EXCEPTION 'baseline preflight failed: Property.agentId foreign key mismatch';
    END IF;

    RAISE NOTICE 'baseline_preflight_ok';
END
$preflight$;
