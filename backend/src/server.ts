import { backendConfig, ensureBackendDirectories } from "./config";
import { CipherRollDatabase } from "./db";
import { createCipherRollBackendServer } from "./http";
import { CipherRollIndexer } from "./indexer";

async function main() {
  ensureBackendDirectories();

  const db = new CipherRollDatabase();
  const indexer = new CipherRollIndexer(db);

  await indexer.syncOnce();
  setInterval(() => {
    indexer.syncOnce().catch((error) => {
      console.error("[cipherroll-backend] background sync failed:", error);
    });
  }, backendConfig.pollIntervalMs).unref();

  const server = createCipherRollBackendServer(db, indexer);
  server.listen(backendConfig.port, backendConfig.host, () => {
    console.log(
      `[cipherroll-backend] listening on http://${backendConfig.host}:${backendConfig.port}`
    );
  });
}

main().catch((error) => {
  console.error("[cipherroll-backend] fatal startup error:", error);
  process.exitCode = 1;
});
