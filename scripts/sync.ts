import "dotenv/config";
import { fullSync } from "../src/lib/topnlab/sync";

fullSync()
  .then((n) => {
    console.log(`synced ${n}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
