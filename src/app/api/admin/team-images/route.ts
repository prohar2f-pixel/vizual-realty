import { readAdminAuthConfig } from "../../../../lib/admin/auth";
import {
  AdminRequestError,
  assertTrustedOrigin,
  getAdminSession,
} from "../../../../lib/admin/request";
import type { AdminSession } from "../../../../lib/admin/session";
import {
  storeTeamImage,
  TEAM_IMAGE_MAX_BYTES,
  TeamImageValidationError,
} from "../../../../lib/team-images";

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_MULTIPART_BODY_BYTES =
  TEAM_IMAGE_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;

type UploadDependencies = {
  readSession: () => Promise<AdminSession | null>;
  readSiteOrigin: () => string;
  store: (
    bytes: Uint8Array,
    claimedType: string,
  ) => Promise<{ id: string; url: string }>;
};

class UploadBodyError extends Error {}

const defaultDependencies: UploadDependencies = {
  readSession: getAdminSession,
  readSiteOrigin: () => readAdminAuthConfig().siteOrigin,
  store: storeTeamImage,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function readLimitedBody(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > MAX_MULTIPART_BODY_BYTES)
  ) {
    throw new UploadBodyError();
  }
  if (!request.body) throw new UploadBodyError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MULTIPART_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new UploadBodyError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new UploadBodyError();

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function isMultipart(contentType: string | null) {
  return (
    contentType !== null &&
    contentType.length <= 512 &&
    /^multipart\/form-data\s*;/i.test(contentType) &&
    /(?:^|;)\s*boundary=(?:"[^"]+"|[^;\s]+)(?:;|$)/i.test(contentType)
  );
}

export function createTeamImageUploadHandler(
  overrides: Partial<UploadDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      assertTrustedOrigin(request, dependencies.readSiteOrigin());
      const contentType = request.headers.get("content-type");
      if (!isMultipart(contentType)) throw new UploadBodyError();

      const rawBody = await readLimitedBody(request);
      const boundedRequest = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: rawBody,
      });
      let form: FormData;
      try {
        form = await boundedRequest.formData();
      } catch {
        throw new UploadBodyError();
      }
      const files = Array.from(form.entries()).filter(
        (entry): entry is [string, File] => typeof entry[1] !== "string",
      );
      if (
        files.length !== 1 ||
        files[0][0] !== "file" ||
        form.getAll("file").length !== 1
      ) {
        throw new UploadBodyError();
      }
      const file = files[0][1];
      if (file.size === 0 || file.size > TEAM_IMAGE_MAX_BYTES) {
        throw new UploadBodyError();
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stored = await dependencies.store(bytes, file.type);
      return json(
        { ok: true, imageId: stored.id, url: stored.url },
        201,
      );
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json({ ok: false, error: "Запрос отклонён" }, error.status);
      }
      if (
        error instanceof UploadBodyError ||
        error instanceof TeamImageValidationError
      ) {
        return json({ ok: false, error: "Некорректный файл" }, 400);
      }
      return json(
        { ok: false, error: "Не удалось загрузить фотографию" },
        500,
      );
    }
  };
}

export const runtime = "nodejs";
export const POST = createTeamImageUploadHandler();
