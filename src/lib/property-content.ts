const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&([a-z]+);/gi, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase())
        ? NAMED_ENTITIES[name.toLowerCase()]
        : match,
    )
    .replace(/&#(\d+);/g, (match, code: string) => {
      const codePoint = Number(code);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    });
}

export function normalizePropertyDescription(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;

  const normalized = decodeEntities(value)
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|h[1-6]|li|p)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized || undefined;
}

function textValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
    if (value && typeof value === "object" && "name" in value) {
      const text = String((value as { name?: unknown }).name ?? "").trim();
      if (text) return text;
    }
  }
  return undefined;
}

export function formatTopnlabAddress(
  entity: Record<string, unknown>,
): string | undefined {
  const region = textValue(entity.region_name, entity.region);
  const city = textValue(entity.city_name, entity.locality, entity.city);
  const district = textValue(
    entity.city_district_name,
    entity.city_district,
    entity.district_name,
    entity.district,
  );
  const street = textValue(entity.street_name, entity.street);
  const house = textValue(entity.house, entity.house_number, entity.building);
  const structured = [
    region,
    city,
    district,
    street,
    house,
  ].filter((part): part is string => Boolean(part));

  const unique = structured.filter(
    (part, index) =>
      structured.findIndex(
        (candidate) =>
          candidate.toLocaleLowerCase("ru") === part.toLocaleLowerCase("ru"),
      ) === index,
  );

  if (street && house) return unique.join(", ");

  return textValue(
    entity.full_address,
    entity.address_full,
    entity.formatted_address,
    entity.address,
  );
}
