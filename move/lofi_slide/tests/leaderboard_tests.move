#[test_only, allow(deprecated_usage)]
module lofi_slide::leaderboard_tests;

use lofi_slide::leaderboard::{Self, Leaderboard, SummitBadge};
use std::string;
use sui::clock;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const P1: address = @0xB1;
const P2: address = @0xB2;

#[test]
fun submit_and_rank() {
    let mut sc = ts::begin(ADMIN);
    leaderboard::init_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    sc.next_tx(P1);
    {
        let mut lb = sc.take_shared<Leaderboard>();
        leaderboard::submit_score(&mut lb, string::utf8(b"yeti"), 1200, 300, &clk, sc.ctx());
        leaderboard::submit_score(&mut lb, string::utf8(b"yeti"), 800, 200, &clk, sc.ctx());
        assert!(leaderboard::best_of(&lb, P1) == 1200);
        ts::return_shared(lb);
    };
    sc.next_tx(P2);
    {
        let mut lb = sc.take_shared<Leaderboard>();
        leaderboard::submit_score(&mut lb, string::utf8(b"lofi"), 6000, 900, &clk, sc.ctx());
        let top = leaderboard::top(&lb);
        assert!(top.length() == 2);
        assert!(leaderboard::entry_player(&top[0]) == P2);
        assert!(leaderboard::total_runs(&lb) == 3);
        leaderboard::mint_badge_to_sender(&mut lb, sc.ctx());
        assert!(leaderboard::minted_tier_of(&lb, P2) == 2);
        ts::return_shared(lb);
    };
    sc.next_tx(P2);
    {
        let b = sc.take_from_sender<SummitBadge>();
        assert!(leaderboard::badge_tier(&b) == 2);
        sc.return_to_sender(b);
    };
    clk.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = leaderboard::ENoNewTier)]
fun cannot_mint_same_tier_twice() {
    let mut sc = ts::begin(ADMIN);
    leaderboard::init_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    sc.next_tx(P1);
    let mut lb = sc.take_shared<Leaderboard>();
    leaderboard::submit_score(&mut lb, string::utf8(b"yeti"), 1200, 300, &clk, sc.ctx());
    leaderboard::mint_badge_to_sender(&mut lb, sc.ctx());
    leaderboard::mint_badge_to_sender(&mut lb, sc.ctx());
    ts::return_shared(lb);
    clk.destroy_for_testing();
    sc.end();
}

#[test]
fun top_is_capped_at_ten() {
    let mut sc = ts::begin(ADMIN);
    leaderboard::init_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let mut i = 1;
    while (i <= 12) {
        sc.next_tx(sui::address::from_u256((i as u256) + 100));
        let mut lb = sc.take_shared<Leaderboard>();
        leaderboard::submit_score(&mut lb, string::utf8(b"p"), i * 100, i, &clk, sc.ctx());
        ts::return_shared(lb);
        i = i + 1;
    };
    sc.next_tx(ADMIN);
    let lb = sc.take_shared<Leaderboard>();
    let top = leaderboard::top(&lb);
    assert!(top.length() == 10);
    assert!(leaderboard::entry_score(&top[0]) == 1200);
    assert!(leaderboard::entry_score(&top[9]) == 300);
    ts::return_shared(lb);
    clk.destroy_for_testing();
    sc.end();
}
