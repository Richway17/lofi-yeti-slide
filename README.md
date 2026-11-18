<p align="center"><img src="docs/logo.png" width="180" alt="Lofi Slide logo"></p>

# Lofi Slide

**Shred Mount Lofi as Lofi the Yeti, flip for points, and put your best run on Sui.**

**▶ Play now: https://lofi-slide.vercel.app** · Built for **CLAY Hackathon III · Mini-game track**

Lofi Slide is an endless snowboarding arcade game made for **CLAY Hackathon III** (mini-game track). It runs in any desktop or mobile browser, in portrait or landscape. **You can play right away with no wallet and no sign-up.** A wallet is only needed when you want to save a score on-chain. If you connect a Sui wallet, you can post your run to an **on-chain leaderboard** and mint a **Summit Badge NFT**, written in Move and deployed on **Sui testnet**.

| Title | Gameplay | On-chain game over |
|---|---|---|
| ![](docs/screenshots/title.png) | ![](docs/screenshots/gameplay.png) | ![](docs/screenshots/onchain-gameover.png) |

---

## How to play

| Action | Desktop | Mobile |
|---|---|---|
| Jump | `Space` / `↑` / `W` | Tap |
| Backflip | Hold while in the air | Hold while in the air |
| Start / restart | `Space` / `Enter` | Tap **Play** |

- **Land on your board.** If you come down at a bad angle, you wipe out. When you let go in the air, Lofi slowly levels out, so short hops are forgiving.
- **Rocks and ice spikes** end your run. Jump over them.
- **Blue crystals ◆** are worth 25 points times your combo.
- **Backflips** are worth 250 points × flips × combo. A *clean* landing (nearly flush with the slope) doubles that.
- **Combos** stack with every flip, up to ×10. A real jump that lands without a flip resets the combo.
- **Big air** (1.1 s or more in the air) gives bonus points.
- Each metre you travel adds 1 point. The slope gets steeper and faster the further you go.

## Features

- Hand-built canvas engine with sub-stepped slope physics, crest take-offs, flips with landing checks, and a speed curve that keeps getting harder.
- All Lofi art is **original procedural vector art** drawn for this game: white fur, blue face, hands and feet, dark shades, and a yellow scarf. The game loads no sprite files.
- Polish: particles, snow spray, screen shake, score popups, parallax mountain ranges with pine silhouettes, and falling snow.
- **Generated audio** made with WebAudio, so the game ships no audio files. It plays a mellow lo-fi chord loop (it's Lofi, after all) and has sound effects for jumps, crystals, flips and crashes. You can mute it, and the setting is remembered.
- Responsive layout: the camera zoom adapts to landscape desktops and portrait phones. Touch, mouse and keyboard all work.
- A clean glass UI using Inter and Space Grotesk.

## Built on the Sui Stack

```
Browser (React + Canvas)
 ├─ gameplay ── fully off-chain, no wallet needed
 └─ @mysten/dapp-kit-react ── Connect Wallet (Slush & any Wallet-Standard wallet)
       │  signAndExecuteTransaction (PTB)
       ▼
 Sui testnet ── package lofi_slide::leaderboard (Move 2024)
       ├─ Leaderboard (shared object): top-10, personal bests (Table), minted tiers (Table), total runs
       ├─ submit_score(name, score, distance, Clock)  → emits ScoreSubmitted
       ├─ mint_badge_to_sender()                       → SummitBadge NFT, emits BadgeMinted
       └─ Display V2 (DisplayRegistry 0xd) → badge name / description / image_url
 Walrus testnet ── badge artwork, one blob per tier; the NFT's image_url points at the Walrus aggregator
 Reads: SuiGrpcClient.core.getObject(...) → live leaderboard, with no wallet needed
```

### Deployed on Sui testnet

| | ID |
|---|---|
| **Package ID** | `0x4a41b5bc80946af797f4d48642f4d3083865126f11c7c7cc12c1702495241db3` |
| Leaderboard (shared object) | `0xf3c9a2490f371afd60528a4d1082d0ec9042c7bb83d3e5157dd908d6dbbed01f` |
| Publish tx | `4Jn99hSXUoLCrc72NiuDHVcaDAbjxqSF4QZSprcQtVXc` |

Explorer: [package](https://suiscan.xyz/testnet/object/0x4a41b5bc80946af797f4d48642f4d3083865126f11c7c7cc12c1702495241db3) · [leaderboard](https://suiscan.xyz/testnet/object/0xf3c9a2490f371afd60528a4d1082d0ec9042c7bb83d3e5157dd908d6dbbed01f)

> **Transparency note on the demo entry.** At the time of submission the v3 leaderboard has one entry, **"Demo Run" (9,488 points)**. It was posted while recording the demo video. The run was played in the real live game by an **automated input bot**, not a human. The bot only pressed and released Space; it did not change the score, the physics or the game state. It was submitted from a throwaway **testnet burner wallet** (`0xb310d17a…bd67747`), which also minted the Silver badge shown in the video ([submit tx](https://suiscan.xyz/testnet/tx/7TaAiEZ8YeHZwNAck78W73KdGV6hnimeufFr6X9RRv7L) · [mint tx](https://suiscan.xyz/testnet/tx/4HK4Lagv9CoJdpnQ681XJzy1M9dzAPRFUedqXvCBKGcN) · [badge](https://suiscan.xyz/testnet/object/0xe50dc029b7bb79281a89b0dafc1248bb47b67bf370d20c6a861ba13d4480493f)). Every other entry comes from players using the live site. Earlier test packages (v1, v2) are abandoned and the game doesn't use them.

### Walrus: badge artwork

Each tier's artwork (`docs/badges/*.png`) is a blob on **Walrus testnet**, stored for 53 epochs (about early January 2027, given testnet's one-day epochs). The blob IDs are hard-coded in the Move package, so the NFT's `image_url` always points at the matching Walrus blob. The game-over screen also loads the badge art straight from Walrus.

| Tier | Min score | Walrus blob ID |
|---|---|---|
| Bronze | 1,000 | [`l76ptFGafZqo7ZW0IyUDV2OoBQQ2151Z5a8RJmDeWwU`](https://aggregator.walrus-testnet.walrus.space/v1/blobs/l76ptFGafZqo7ZW0IyUDV2OoBQQ2151Z5a8RJmDeWwU) |
| Silver | 5,000 | [`W_cnZGcVTDMly5cKGTQVYg8PH44PtdvSuGktYyEn1k4`](https://aggregator.walrus-testnet.walrus.space/v1/blobs/W_cnZGcVTDMly5cKGTQVYg8PH44PtdvSuGktYyEn1k4) |
| Gold | 15,000 | [`Ufclv5iLTOHpT5hKuCXrEFgROHSOnliJTxZY8SBGq0Q`](https://aggregator.walrus-testnet.walrus.space/v1/blobs/Ufclv5iLTOHpT5hKuCXrEFgROHSOnliJTxZY8SBGq0Q) |
| Summit | 40,000 | [`_rHci0zskSfV5ynnowlZuQKfRCh-PC6HnN41-jmlgwU`](https://aggregator.walrus-testnet.walrus.space/v1/blobs/_rHci0zskSfV5ynnowlZuQKfRCh-PC6HnN41-jmlgwU) |

![badges](docs/badges/sheet.png)

### Move package (`move/lofi_slide`)

- **`Leaderboard`** is a shared object. It holds a sorted top-10 with at most one entry per player, plus a `Table<address, u64>` of every player's personal best. Only improvements update your best or your rank.
- **`SummitBadge`** is a `key + store` NFT with four tiers: **Bronze** at 1,000, **Silver** at 5,000, **Gold** at 15,000 and **Summit** at 40,000. Minting checks your **on-chain** personal best, so you have to submit a run before you can mint. Each tier can be minted only once per player, and you can always move up to a higher tier. The badge artwork is stored on **Walrus** (see above). Each badge carries `image_url` (Walrus aggregator URL) and `walrus_blob_id`.
- **Events:** `ScoreSubmitted` (player, name, score, distance, new_best, rank) and `BadgeMinted`.
- **Display V2:** after publishing, `setup_display(AdminCap, DisplayRegistry)` registers the NFT metadata through the new `sui::display_registry`.
- **Unit tests** cover ranking, dedup, the top-10 cap and the one-mint-per-tier rule.

> **Trust model (hackathon scope):** scores are reported by the client, as in most web arcade leaderboards. The contract caps obviously impossible scores and keeps only one best per address, but a determined cheater could still post a fake score. Possible hardening: a server-signed run attestation checked on-chain with `ed25519_verify`, or replay verification from a recorded input log stored on Walrus. See *Roadmap*.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve dist/
```

Requirements: Node 20 or later. To use the on-chain features, install a Sui wallet such as [Slush](https://slush.app), switch it to **Testnet**, and get test SUI from the [faucet](https://faucet.sui.io).

**Demo/test mode:** open the game with `?burner` (for example `http://localhost:5173/?burner`) to turn on dApp Kit's in-browser *Unsafe Burner Wallet*. Send it a little testnet SUI and you can try submit and mint without installing anything.

## Deploy

**Frontend:** the app is a static site, so any static host works.

- **Vercel / Netlify:** build command `npm run build`, output folder `dist`.
- **GitHub Pages:** copy `docs/github-pages-workflow.yml` to `.github/workflows/pages.yml`. It builds with `VITE_BASE=/<repo-name>/` and deploys. Then turn it on under *Settings → Pages → Source: GitHub Actions*.

**Move package** (Sui CLI 1.84 or later):

```bash
cd move/lofi_slide
sui move test
sui client switch --env testnet
sui client faucet
sui client publish --gas-budget 200000000
# then, with the AdminCap id from the publish output:
sui client call --package <PACKAGE_ID> --module leaderboard --function setup_display \
  --args <ADMIN_CAP_ID> 0xd --gas-budget 50000000
```

Put the new `PACKAGE_ID` and `LEADERBOARD_ID` into `src/sui/config.ts`.

## Project structure

```
src/
  game/engine.ts      game loop, physics, spawning, rendering
  game/lofi.ts        original procedural Lofi the Yeti vector art
  game/audio.ts       WebAudio music + SFX synth
  sui/config.ts       dApp Kit + gRPC client, package/object IDs
  sui/leaderboard.ts  PTB builders, on-chain reads, error mapping
  App.tsx             menus, HUD, wallet flow, leaderboard
move/lofi_slide/      Move package + unit tests
docs/                 logo + screenshots
```

## Roadmap

- **Anti-cheat:** server-signed scores verified on-chain, plus replayable runs (seed and input log) stored on **Walrus**.
- **Walrus Sites:** host the game itself on Walrus.
- **Seasons:** weekly leaderboards reset by the AdminCap, with prizes for the top runs.
- **Unlockable boards and scarves** as on-chain collectibles.
- **Charity seasons** supporting Lofi's clean-water mission.
- A mainnet deployment.

## Credits

Built for **CLAY Hackathon III · Mini-game track** (Code Like A Yeti), hosted by the Lofi Foundation. Lofi the Yeti is the Lofi community mascot. All art, audio and code in this repo are original.

MIT licensed.
