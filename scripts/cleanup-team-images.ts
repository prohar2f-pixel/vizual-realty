import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cleanupOrphanTeamImages } from "../src/lib/team-images";

export async function runTeamImageCleanup(
  cleanup: (now: Date) => Promise<number> = cleanupOrphanTeamImages,
  now = new Date(),
) {
  return cleanup(now);
}

const entryPoint = process.argv[1];
if (
  entryPoint &&
  pathToFileURL(resolve(entryPoint)).href === import.meta.url
) {
  runTeamImageCleanup()
    .then((removed) => {
      console.log(`team_images_removed=${removed}`);
    })
    .catch(() => {
      console.error("team_image_cleanup_failed");
      process.exitCode = 1;
    });
}
