import { Transaction } from '@mysten/sui/transactions';
import { LEADERBOARD_ID, PACKAGE_ID, readClient } from './config';

export interface BoardEntry { player: string; name: string; score: number; distance: number; timestamp: number }
export interface Board { top: BoardEntry[]; totalRuns: number }

export const TIERS = [
  { tier: 1, name: 'Bronze', min: 1_000, color: '#d98a4e' },
  { tier: 2, name: 'Silver', min: 5_000, color: '#cfd8e3' },
  { tier: 3, name: 'Gold', min: 15_000, color: '#ffc93c' },
  { tier: 4, name: 'Summit', min: 40_000, color: '#5ee7ff' },
];
export const tierFor = (score: number) => [...TIERS].reverse().find(t => score >= t.min) ?? null;

export async function fetchBoard(): Promise<Board> {
  const r = await readClient.core.getObject({ objectId: LEADERBOARD_ID, include: { json: true } });
  const j = (r.object as unknown as { json: Record<string, unknown> }).json as {
    top: { player: string; name: string; score: string; distance: string; timestamp_ms: string }[];
    total_runs: string;
  };
  return {
    totalRuns: Number(j.total_runs),
    top: j.top.map(e => ({ player: e.player, name: e.name, score: Number(e.score), distance: Number(e.distance), timestamp: Number(e.timestamp_ms) })),
  };
}

export function submitScoreTx(name: string, score: number, distance: number) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::leaderboard::submit_score`,
    arguments: [tx.object(LEADERBOARD_ID), tx.pure.string(name.slice(0, 16)), tx.pure.u64(score), tx.pure.u64(distance), tx.object.clock()],
  });
  return tx;
}

export function mintBadgeTx() {
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::leaderboard::mint_badge_to_sender`, arguments: [tx.object(LEADERBOARD_ID)] });
  return tx;
}

/** Turn Move abort codes into friendly text. */
export function explainError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/rejected|denied|cancel/i.test(m)) return 'Transaction cancelled in wallet.';
  if (/MoveAbort.*3\b|abort code: 3|, 3\)/.test(m)) return 'You already own the badge for this tier — beat a higher tier first.';
  if (/InsufficientGas|No valid gas|balance/i.test(m)) return 'Your wallet needs some testnet SUI for gas (use the faucet).';
  return m.length > 140 ? m.slice(0, 140) + '…' : m;
}

export const short = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);
