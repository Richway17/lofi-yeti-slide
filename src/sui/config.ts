import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

/** Published on Sui testnet — see move/lofi_slide and README. */
export const PACKAGE_ID = '0x4a41b5bc80946af797f4d48642f4d3083865126f11c7c7cc12c1702495241db3';
export const LEADERBOARD_ID = '0xf3c9a2490f371afd60528a4d1082d0ec9042c7bb83d3e5157dd908d6dbbed01f';
export const NETWORK = 'testnet' as const;
export const EXPLORER = 'https://suiscan.xyz/testnet';

const GRPC_URLS = { testnet: 'https://fullnode.testnet.sui.io:443' } as const;

export const readClient = new SuiGrpcClient({ network: NETWORK, baseUrl: GRPC_URLS.testnet });

export const dAppKit = createDAppKit({
  networks: [NETWORK],
  defaultNetwork: NETWORK,
  // Dev/demo only: append ?burner to the URL to get an in-browser burner wallet.
  enableBurnerWallet: typeof location !== 'undefined' && new URLSearchParams(location.search).has('burner'),
  slushWalletConfig: { appName: 'Lofi Slide' },
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
