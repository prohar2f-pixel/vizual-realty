import "dotenv/config";
import { syncPropertyContent } from "../src/lib/topnlab/content";

syncPropertyContent()
  .then(({ updated, skipped }) => {
    console.log(`updated property content: ${updated}`);
    console.log(`skipped property content: ${skipped}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
