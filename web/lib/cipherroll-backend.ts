import {
  CipherRollBackendClient,
  createCipherRollBackendClient
} from "../../packages/cipherroll-sdk/src";
import { BACKEND_BASE_URL } from "./cipherroll-config";

let backendClient: CipherRollBackendClient | null = null;

export function getCipherRollBackendClient() {
  if (!backendClient) {
    backendClient = createCipherRollBackendClient({
      baseUrl: BACKEND_BASE_URL
    });
  }

  return backendClient;
}
