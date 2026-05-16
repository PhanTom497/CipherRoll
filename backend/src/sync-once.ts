import { ensureBackendDirectories } from "./config";
import { CipherRollDatabase } from "./db";
import { CipherRollIndexer } from "./indexer";

async function main() {
  ensureBackendDirectories();

  const db = new CipherRollDatabase();
  const indexer = new CipherRollIndexer(db);

  await indexer.syncOnce();

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: db.getIndexerStatus()
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[cipherroll-backend] sync failed:", error);
  process.exitCode = 1;
});
