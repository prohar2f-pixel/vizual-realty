import "dotenv/config";

import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { transformTeamImage } from "../src/lib/team-images";
import {
  configuredTeamUploadDirectory,
  isCanonicalTeamImageId,
  isContainedPath,
  resolvePhysicalTeamUploadRoot,
} from "../src/lib/team-image-files";

async function reprocessAvatar(id: string, uploadDirectory: string) {
  if (!isCanonicalTeamImageId(id)) {
    throw new Error(`Invalid team image ID: ${id}`);
  }
  const target = resolve(uploadDirectory, `${id}.webp`);
  const temporary = join(uploadDirectory, `.${id}.${randomUUID()}.tmp`);
  if (
    !isContainedPath(uploadDirectory, target) ||
    !isContainedPath(uploadDirectory, temporary)
  ) {
    throw new Error(`Unsafe team image ID: ${id}`);
  }

  const source = await readFile(target);
  const transformed = await transformTeamImage(source);
  try {
    await writeFile(temporary, transformed, { flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function main() {
  const ids = [...new Set(process.argv.slice(2))];
  if (ids.length === 0) {
    throw new Error("Pass one or more team image IDs.");
  }
  const uploadDirectory = await resolvePhysicalTeamUploadRoot({
    uploadDirectory: configuredTeamUploadDirectory(),
    create: false,
  });
  for (const id of ids) await reprocessAvatar(id, uploadDirectory);
  console.log(`reprocessed team avatars: ${ids.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
