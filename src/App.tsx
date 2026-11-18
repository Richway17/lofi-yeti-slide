import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Game, type Hud, type RunResult } from './game/engine';
import { audio } from './game/audio';
import { lofiHeadSVG } from './game/lofi';
import { EXPLORER, LEADERBOARD_ID, PACKAGE_ID } from './sui/config';
import { explainError, fetchBoard, mintBadgeTx, short, submitScoreTx, tierFor, TIERS, type Board } from './sui/leaderboard';

type Screen = 'title' | 'playing' | 'over';
type TxState = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'ok'; label: string; digest: string } | { kind: 'err'; msg: string };

const headUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(lofiHeadSVG(256));

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>('title');
  const [hud, setHud] = useState<Hud>({ score: 0, distance: 0, crystals: 0, combo: 0, speed: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [best, setBest] = useState(() => Number(localStorage.getItem('lofi-slide-best') || 0));
  const [muted, setMuted] = useState(() => localStorage.getItem('lofi-slide-muted') === '1');
  const [name, setName] = useState(() => localStorage.getItem('lofi-slide-name') || '');
  const [board, setBoard] = useState<Board | null>(null);
  const [boardErr, setBoardErr] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: 'idle' });
  const [submitted, setSubmitted] = useState(false);
  const [minted, setMinted] = useState(false);
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const loadBoard = useCallback(async () => {
    try { setBoard(await fetchBoard()); setBoardErr(false); } catch { setBoardErr(true); }
  }, []);

  useEffect(() => {
    const g = new Game(canvasRef.current!);
    gameRef.current = g;
    // test hook for the burner-wallet demo mode only
    if (new URLSearchParams(location.search).has('burner')) (window as unknown as { __lofiGame: Game }).__lofiGame = g;
    g.onHud = setHud;
    g.onOver = (r) => {
      setResult(r);
      setScreen('over');
      setSubmitted(false);
      setMinted(false);
      setTx({ kind: 'idle' });
      setBest(b => {
        const nb = Math.max(b, r.score);
        localStorage.setItem('lofi-slide-best', String(nb));
        return nb;
      });
    };
    audio.setMuted(localStorage.getItem('lofi-slide-muted') === '1');
    void loadBoard();
    return () => g.destroy();
  }, [loadBoard]);

  const play = useCallback(() => {
    audio.click();
    gameRef.current?.start();
    setHud({ score: 0, distance: 0, crystals: 0, combo: 0, speed: 0 });
    setShowBoard(false);
    setScreen('playing');
  }, []);

  // keyboard
  useEffect(() => {
    const isAction = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!isAction(e) && e.code !== 'Enter') return;
      e.preventDefault();
      if (e.repeat) return;
      if (screenRef.current === 'playing') gameRef.current?.press();
      else play();
    };
    const up = (e: KeyboardEvent) => { if (isAction(e)) gameRef.current?.release(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [play]);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    audio.setMuted(m);
    localStorage.setItem('lofi-slide-muted', m ? '1' : '0');
  };

  const runTx = async (label: string, build: () => ReturnType<typeof submitScoreTx>) => {
    setTx({ kind: 'busy', label });
    try {
      const r = await dAppKit.signAndExecuteTransaction({ transaction: build() });
      if (r.FailedTransaction) throw new Error(r.FailedTransaction.status.error?.message ?? 'Transaction failed');
      setTx({ kind: 'ok', label, digest: r.Transaction.digest });
      setTimeout(() => void loadBoard(), 1500);
      return true;
    } catch (e) {
      setTx({ kind: 'err', msg: explainError(e) });
      return false;
    }
  };

  const submit = async () => {
    if (!result) return;
    const n = (name.trim() || 'Yeti').slice(0, 16);
    localStorage.setItem('lofi-slide-name', n);
    if (await runTx('Score submitted on-chain', () => submitScoreTx(n, result.score, result.distance))) setSubmitted(true);
  };
  const mint = async () => { if (await runTx(`${tierFor(result?.score ?? 0)?.name ?? ''} Badge NFT minted`, mintBadgeTx)) setMinted(true); };

  const tier = useMemo(() => (result ? tierFor(result.score) : null), [result]);
  const nextTier = useMemo(() => (result ? TIERS.find(t => t.min > result.score) : null), [result]);

  const pointerDown = (e: React.PointerEvent) => {
    if (screen !== 'playing') return;
    e.preventDefault();
    gameRef.current?.press();
  };
  const pointerUp = () => gameRef.current?.release();

  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={pointerUp} />

      <header className="topbar">
        {screen === 'playing' ? (
          <div className="hud">
            <div className="hud-score">{hud.score.toLocaleString()}</div>
            <div className="hud-row">
              <span>{hud.distance} m</span>
              <span className="gem">◆ {hud.crystals}</span>
              {hud.combo > 1 && <span className="combo">combo ×{hud.combo}</span>}
            </div>
          </div>
        ) : (
          <div className="brand"><img src={headUrl} alt="" /> <b>LOFI SLIDE</b></div>
        )}
        <div className="top-actions">
          <button className="icon" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
              {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
            </svg>
          </button>
          {screen !== 'playing' && <ConnectButton />}
        </div>
      </header>

      {screen === 'title' && !showBoard && (
        <main className="panel title">
          <img className="hero" src={headUrl} alt="Lofi the Yeti" />
          <h1>LOFI SLIDE</h1>
          <p className="tag">Shred Mount Lofi. Flip for points. Put your best run on Sui.</p>
          <button className="primary" onClick={play}>Play</button>
          <div className="how">
            <div><kbd>Tap</kbd> / <kbd>Space</kbd> jump</div>
            <div><kbd>Hold</kbd> in the air to backflip</div>
            <div>Land on your board · dodge rocks & ice · grab ◆</div>
          </div>
          <button className="ghost" onClick={() => setShowBoard(true)}>On-chain leaderboard</button>
          <p className="fine">Best: {best.toLocaleString()} · No wallet needed to play</p>
        </main>
      )}

      {screen === 'over' && result && !showBoard && (
        <main className="panel over">
          <p className="eyebrow">Wipeout</p>
          <div className="big">{result.score.toLocaleString()}</div>
          {result.score >= best && result.score > 0 && <p className="pb">New personal best!</p>}
          <div className="stats">
            <div><b>{result.distance} m</b><span>distance</span></div>
            <div><b>{result.crystals}</b><span>crystals</span></div>
            <div><b>{result.flips}</b><span>flips</span></div>
            <div><b>{result.bestAir.toFixed(1)}s</b><span>best air</span></div>
          </div>

          <div className="chain">
            {!account ? (
              <p className="muted">Connect a Sui wallet (testnet) to post this run to the on-chain leaderboard and mint a Summit Badge NFT.</p>
            ) : (
              <>
                <div className="name-row">
                  <input value={name} maxLength={16} placeholder="Your yeti name" onChange={e => setName(e.target.value)} />
                  <button className="primary small" disabled={tx.kind === 'busy' || submitted} onClick={submit}>
                    {submitted ? 'Submitted ✓' : 'Submit to Sui'}
                  </button>
                </div>
                <div className="badge-row">
                  {tier ? (
                    <button className="tier" style={{ borderColor: tier.color, color: tier.color }} disabled={tx.kind === 'busy' || !submitted || minted} onClick={mint}>
                      {minted ? `${tier.name} badge minted ✓` : `Mint ${tier.name} Badge NFT`}
                    </button>
                  ) : (
                    <span className="muted">Score {TIERS[0].min.toLocaleString()}+ to earn a Bronze badge.</span>
                  )}
                  {nextTier && tier && <span className="muted">Next: {nextTier.name} at {nextTier.min.toLocaleString()}</span>}
                </div>
                {!submitted && tier && <p className="muted fine">Submit first — badges are checked against your on-chain best.</p>}
              </>
            )}
            {tx.kind === 'busy' && <p className="status">Waiting for wallet…</p>}
            {tx.kind === 'ok' && <p className="status ok">{tx.label} · <a href={`${EXPLORER}/tx/${tx.digest}`} target="_blank" rel="noreferrer">view tx</a></p>}
            {tx.kind === 'err' && <p className="status err">{tx.msg}</p>}
          </div>

          <div className="actions">
            <button className="primary" onClick={play}>Ride again</button>
            <button className="ghost" onClick={() => { setShowBoard(true); void loadBoard(); }}>Leaderboard</button>
          </div>
        </main>
      )}

      {showBoard && (
        <main className="panel board">
          <p className="eyebrow">Sui testnet · live</p>
          <h2>Leaderboard</h2>
          {boardErr && <p className="status err">Couldn't reach Sui right now. Try again.</p>}
          {!board && !boardErr && <p className="muted">Loading from chain…</p>}
          {board && (
            <>
              <ol>
                {board.top.length === 0 && <li className="muted">No runs yet — be the first yeti.</li>}
                {board.top.map((e, i) => (
                  <li key={e.player} className={account?.address === e.player ? 'me' : ''}>
                    <span className="rank">{i + 1}</span>
                    <span className="who">{e.name}<small>{short(e.player)}</small></span>
                    <span className="pts">{e.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
              <p className="fine">{board.totalRuns} {board.totalRuns === 1 ? 'run' : 'runs'} submitted · <a href={`${EXPLORER}/object/${LEADERBOARD_ID}`} target="_blank" rel="noreferrer">leaderboard object</a> · <a href={`${EXPLORER}/object/${PACKAGE_ID}`} target="_blank" rel="noreferrer">package</a></p>
            </>
          )}
          <div className="actions">
            <button className="primary" onClick={play}>Play</button>
            <button className="ghost" onClick={() => setShowBoard(false)}>Back</button>
          </div>
        </main>
      )}

      {screen === 'playing' && hud.distance < 25 && <div className="hint">Tap / Space to jump · hold in the air to flip</div>}
    </div>
  );
}
