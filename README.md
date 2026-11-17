# btc-race-24h

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/{owner}/{repo}/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/{owner}/{repo}/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A single-trend rider for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It
trades Coinbase Wrapped BTC against USDC in the replay of an Orca Whirlpool, minute by
minute, starting from 1,000 USDC of paper money.

## Why it trades so little

The race's cost structure sets the shape of the answer. A full-size round trip pays about
26 bps — `fee_bps` 4 (8 bps both ways), `slippage_bps` 2 (4 bps), and constant-product
impact of roughly 7 bps per side (14 bps) — while a bar's close-to-close move has a
standard deviation of only ~6.4 bps. Trading often is donating the spread.

That is not a guess. Every fast baseline shipped with the kit loses money on the dev
window: `ema-cross` sent 68 trades and finished −106.2 USDC, `adx-momentum` 26 trades
−32.7, `rsi-bollinger` 11 trades −24.3. The only two that made money sent exactly one
trade: `momentum` +2.45 and `buy-and-hold` +1.07.

## The rule

- **Enter once**, on the first bar whose close sits above an EMA-240 spine — and only
  after the warm-up, so the spine is already converged before trading opens.
- **Ride it.** No fixed target: BTC's daily range rarely pays a scalper, and cutting early
  just pays the 26 bps again.
- **Leave through a trailing stop** that arms only after the position is 100 bps in
  profit, then fires when the peak stands 50 bps above the price. A stop that arms sooner
  sells before the round trip has paid for itself.
- **Full size, wide slippage cap.** The score is net PnL, so a refused fill costs a whole
  bar of the move it was meant to catch.

Parameters were picked for robustness, not for peak dev PnL. On the dev window this exact
rule makes **+5.50 USDC in 2 trades** with 1.73% maximum drawdown (well inside the 25%
guardrail), and on **every** 12-hour sub-window of the dev data it also finishes positive
(min +1.17, mean +6.91 across six slices). The race window is one unseen 24-hour draw, so
a rule that wins from most starting points is the only honest way to enter it.

## Verification

```sh
node cli/makefun.mjs grade-local --kit . --bot . --driver process
```

Reports `status finished`, `net PnL 5.503993 USDC`, `2 trades`, `guardrails met`.
The entry is deterministic — the two graded executions reproduce byte for byte — because
it reads no clock, no environment and no unseeded randomness.

---

<sub>Entered on [make.fun](https://make.fun/?ref=a77vfnk6&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
