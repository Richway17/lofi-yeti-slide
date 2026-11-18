import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

/** Published on Sui testnet — see move/lofi_slide and README. */
export const PACKAGE_ID = '0x5c0511a014bfef0372068c83efc94482defd70fdf7c9add1ce786897f8afa13d';
export const LEADERBOARD_ID = '0x316fa5f380dea9d20d3bde14b79a0c49444ec043c6eac74a94dfd4db8631e5e1';
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
