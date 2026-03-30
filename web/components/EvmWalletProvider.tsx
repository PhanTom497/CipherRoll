'use client'

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { createBrowserProvider, hasEthereumProvider } from "@/lib/cipherroll-client";
import { BrowserProvider, JsonRpcSigner } from "@/lib/cipherroll-client";

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  isConnecting: boolean;
  isInstalled: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

async function hydrateWalletState() {
  const provider = await createBrowserProvider();
  const accounts = (await provider.send("eth_accounts", [])) as string[];

  if (!accounts.length) {
    return {
      address: null,
      chainId: null,
      provider,
      signer: null
    };
  }

  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  return {
    address: await signer.getAddress(),
    chainId: Number(network.chainId),
    provider,
    signer
  };
}

export default function EvmWalletProvider({
  children
}: {
  children: ReactNode;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isInstalled = hasEthereumProvider();

  useEffect(() => {
    if (!isInstalled) return;

    hydrateWalletState()
      .then((state) => {
        setAddress(state.address);
        setChainId(state.chainId);
        setProvider(state.provider);
        setSigner(state.signer);
      })
      .catch((error) => {
        console.warn("Unable to hydrate wallet state", error);
      });
  }, [isInstalled]);

  useEffect(() => {
    if (!window.ethereum?.on) return;

    const onAccountsChanged = async () => {
      const state = await hydrateWalletState();
      setAddress(state.address);
      setChainId(state.chainId);
      setProvider(state.provider);
      setSigner(state.signer);
    };

    const onChainChanged = async () => {
      const state = await hydrateWalletState();
      setAddress(state.address);
      setChainId(state.chainId);
      setProvider(state.provider);
      setSigner(state.signer);
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      provider,
      signer,
      isConnecting,
      isInstalled,
      connect: async () => {
        setIsConnecting(true);

        try {
          const nextProvider = await createBrowserProvider();
          await nextProvider.send("eth_requestAccounts", []);
          const nextSigner = await nextProvider.getSigner();
          const network = await nextProvider.getNetwork();

          setProvider(nextProvider);
          setSigner(nextSigner);
          setAddress(await nextSigner.getAddress());
          setChainId(Number(network.chainId));
        } finally {
          setIsConnecting(false);
        }
      },
      disconnect: () => {
        setAddress(null);
        setChainId(null);
        setProvider(null);
        setSigner(null);
      }
    }),
    [address, chainId, isConnecting, isInstalled, provider, signer]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useCipherRollWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useCipherRollWallet must be used inside EvmWalletProvider");
  }

  return context;
}
