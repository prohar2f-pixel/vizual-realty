import type { SourceName } from "../sources/types";

export type CanonicalId = {
  source: SourceName;
  rawId: string;
  canonicalId: string;
  mappingVersion: "identity-v1";
};

export function canonicalize(source: SourceName, value: unknown): CanonicalId {
  const rawId = String(value).trim();
  if (!rawId) throw new Error("ID_MAPPING_UNCONFIRMED");

  return {
    source,
    rawId,
    canonicalId: rawId,
    mappingVersion: "identity-v1",
  };
}
