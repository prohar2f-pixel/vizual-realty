import {
  isCanonicalTeamImageId,
  readTeamImage,
} from "../../../../lib/team-images";

type ImageDependencies = {
  readImage: (id: string) => Promise<Uint8Array | null>;
};

type ImageContext = {
  params: Promise<{ id: string }>;
};

const defaultDependencies: ImageDependencies = {
  readImage: readTeamImage,
};

function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function createTeamImageGetHandler(
  overrides: Partial<ImageDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function GET(
    _request: Request,
    context: ImageContext,
  ): Promise<Response> {
    try {
      const { id } = await context.params;
      if (!isCanonicalTeamImageId(id)) return notFound();
      const bytes = await dependencies.readImage(id);
      if (!bytes) return notFound();
      return new Response(Uint8Array.from(bytes), {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": "image/webp",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return notFound();
    }
  };
}

export const runtime = "nodejs";
export const GET = createTeamImageGetHandler();
