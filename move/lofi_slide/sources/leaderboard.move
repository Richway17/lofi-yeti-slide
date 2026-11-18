/// Lofi Slide — on-chain leaderboard + Summit Badge NFTs for CLAY Hackathon III.
///
/// * One shared `Leaderboard` object holds the global top-10 and every player's personal best.
/// * Players submit runs with `submit_score`; only improvements change their best.
/// * `mint_badge` mints a `SummitBadge` NFT for the highest tier the
///   player's on-chain personal best has reached (Bronze / Silver / Gold / Summit),
///   at most once per tier.
module lofi_slide::leaderboard;

use std::string::{Self, String};
use sui::clock::Clock;
use sui::display_registry::{Self, DisplayRegistry};
use sui::event;
use sui::table::{Self, Table};

// ===== Errors =====
const ENameTooLong: u64 = 1;
const EScoreTooHigh: u64 = 2;
const ENoNewTier: u64 = 3;

// ===== Constants =====
const MAX_ENTRIES: u64 = 10;
const MAX_NAME_BYTES: u64 = 16;
/// Sanity cap: a run cannot claim more than this many points.
const MAX_SCORE: u64 = 10_000_000;

const TIER_BRONZE: u64 = 1_000;
const TIER_SILVER: u64 = 5_000;
const TIER_GOLD: u64 = 15_000;
const TIER_SUMMIT: u64 = 40_000;

/// One-time witness (guarantees `init` runs exactly once).
public struct LEADERBOARD has drop {}

/// Held by the publisher; allows one-time Display setup for badges.
public struct AdminCap has key, store { id: UID }

public struct Entry has copy, drop, store {
    player: address,
    name: String,
    score: u64,
    distance: u64,
    timestamp_ms: u64,
}

public struct Leaderboard has key {
    id: UID,
    /// Sorted high -> low, length <= MAX_ENTRIES, at most one entry per player.
    top: vector<Entry>,
    /// Every player's personal best score.
    bests: Table<address, u64>,
    /// Highest badge tier (1..4) each player has minted.
    minted_tier: Table<address, u8>,
    total_runs: u64,
}

public struct SummitBadge has key, store {
    id: UID,
    tier: u8,
    tier_name: String,
    score: u64,
    image_url: String,
}

public struct ScoreSubmitted has copy, drop {
    player: address,
    name: String,
    score: u64,
    distance: u64,
    new_best: bool,
    rank: u64, // 0 = not in top 10, otherwise 1-based
}

public struct BadgeMinted has copy, drop {
    player: address,
    badge_id: ID,
    tier: u8,
    score: u64,
}

fun init(_otw: LEADERBOARD, ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    transfer::share_object(Leaderboard {
        id: object::new(ctx),
        top: vector[],
        bests: table::new(ctx),
        minted_tier: table::new(ctx),
        total_runs: 0,
    });
}

// ===== Admin =====

/// Registers Display V2 metadata for `SummitBadge` in the system DisplayRegistry (0xd).
/// Call once after publishing. The DisplayCap goes to the admin for future edits.
public fun setup_display(_: &AdminCap, registry: &mut DisplayRegistry, ctx: &mut TxContext) {
    let (mut d, cap) = display_registry::new<SummitBadge>(
        registry,
        std::internal::permit<SummitBadge>(),
        ctx,
    );
    d.set(&cap, string::utf8(b"name"), string::utf8(b"Lofi Slide {tier_name} Badge"));
    d.set(
        &cap,
        string::utf8(b"description"),
        string::utf8(b"Earned by sliding {score} points down Mount Lofi in Lofi Slide."),
    );
    d.set(&cap, string::utf8(b"image_url"), string::utf8(b"{image_url}"));
    d.share();
    transfer::public_transfer(cap, ctx.sender());
}

// ===== Public entry points =====

public fun submit_score(
    lb: &mut Leaderboard,
    name: String,
    score: u64,
    distance: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(name.length() <= MAX_NAME_BYTES, ENameTooLong);
    assert!(score <= MAX_SCORE, EScoreTooHigh);
    let player = ctx.sender();
    lb.total_runs = lb.total_runs + 1;

    let mut new_best = false;
    if (lb.bests.contains(player)) {
        let best = &mut lb.bests[player];
        if (score > *best) {
            *best = score;
            new_best = true;
        };
    } else {
        lb.bests.add(player, score);
        new_best = true;
    };

    let mut rank = 0;
    if (new_best) {
        rank = insert_top(lb, Entry { player, name, score, distance, timestamp_ms: clock.timestamp_ms() });
    };

    event::emit(ScoreSubmitted { player, name, score, distance, new_best, rank });
}

/// Mint a badge for the highest tier reached by the caller's on-chain personal best.
public fun mint_badge(lb: &mut Leaderboard, ctx: &mut TxContext): SummitBadge {
    let player = ctx.sender();
    let best = if (lb.bests.contains(player)) { lb.bests[player] } else { 0 };
    let tier = tier_for(best);
    let already = if (lb.minted_tier.contains(player)) { lb.minted_tier[player] } else { 0 };
    assert!(tier > already, ENoNewTier);
    if (lb.minted_tier.contains(player)) {
        *(&mut lb.minted_tier[player]) = tier;
    } else {
        lb.minted_tier.add(player, tier);
    };
    let badge = SummitBadge {
        id: object::new(ctx),
        tier,
        tier_name: tier_name(tier),
        score: best,
        image_url: tier_image(tier),
    };
    event::emit(BadgeMinted { player, badge_id: object::id(&badge), tier, score: best });
    badge
}

#[allow(lint(self_transfer))]
public fun mint_badge_to_sender(lb: &mut Leaderboard, ctx: &mut TxContext) {
    let badge = mint_badge(lb, ctx);
    transfer::public_transfer(badge, ctx.sender());
}

// ===== Views =====

public fun best_of(lb: &Leaderboard, player: address): u64 {
    if (lb.bests.contains(player)) { lb.bests[player] } else { 0 }
}

public fun minted_tier_of(lb: &Leaderboard, player: address): u8 {
    if (lb.minted_tier.contains(player)) { lb.minted_tier[player] } else { 0 }
}

public fun top(lb: &Leaderboard): vector<Entry> { lb.top }

public fun total_runs(lb: &Leaderboard): u64 { lb.total_runs }

public fun entry_score(e: &Entry): u64 { e.score }

public fun entry_player(e: &Entry): address { e.player }

public fun badge_tier(b: &SummitBadge): u8 { b.tier }

public fun tier_for(score: u64): u8 {
    if (score >= TIER_SUMMIT) 4
    else if (score >= TIER_GOLD) 3
    else if (score >= TIER_SILVER) 2
    else if (score >= TIER_BRONZE) 1
    else 0
}

// ===== Internals =====

fun tier_name(tier: u8): String {
    if (tier == 4) string::utf8(b"Summit")
    else if (tier == 3) string::utf8(b"Gold")
    else if (tier == 2) string::utf8(b"Silver")
    else string::utf8(b"Bronze")
}

fun tier_image(tier: u8): String {
    // Inline SVG data URI so the badge renders in wallets without any off-chain host.
    let color = if (tier == 4) b"5ee7ff"
        else if (tier == 3) b"ffc93c"
        else if (tier == 2) b"cfd8e3"
        else b"d98a4e";
    let mut s = b"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='18' fill='%230b1b3a'/><polygon points='50,14 86,82 14,82' fill='%23";
    s.append(color);
    s.append(b"'/><polygon points='50,14 62,37 38,37' fill='white'/><circle cx='50' cy='64' r='9' fill='%233b82f6'/></svg>");
    string::utf8(s)
}

/// Removes any existing entry for the player, inserts the new one in sorted position,
/// trims to MAX_ENTRIES. Returns 1-based rank or 0 if it didn't make the board.
fun insert_top(lb: &mut Leaderboard, e: Entry): u64 {
    let top = &mut lb.top;
    let mut i = 0;
    let n = top.length();
    while (i < n) {
        if (top[i].player == e.player) {
            top.remove(i);
            break
        };
        i = i + 1;
    };
    let mut pos = 0;
    let n = top.length();
    while (pos < n && top[pos].score >= e.score) {
        pos = pos + 1;
    };
    if (pos >= MAX_ENTRIES) return 0;
    top.insert(e, pos);
    if (top.length() > MAX_ENTRIES) {
        top.pop_back();
    };
    pos + 1
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(LEADERBOARD {}, ctx);
}
