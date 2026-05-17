import { CipherRollDatabase } from "./db";
import { CipherRollIndexer } from "./indexer";

async function main() {
  const db = await CipherRollDatabase.create();
  const indexer = new CipherRollIndexer(db);

  await indexer.syncOnce();

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: await db.getIndexerStatus()
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
