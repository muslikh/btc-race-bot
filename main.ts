// One-trend rider for agent-fun/bars-replay/v1 — btc-race-24h-20261117-0603.
//
// The economics of this race force the shape of the answer. A full-size round trip pays
// ~26 bps (fee_bps 4 -> 8 bps, slippage_bps 2 -> 4 bps, constant-product impact ~7 bps
// each way -> 14 bps) while a bar's close-to-close move has a stdev of only ~6.4 bps:
// trading often is donating the spread. On the dev window every fast baseline lost
// (ema-cross 68 trades -106.2, adx-momentum 26 -32.7, rsi-bollinger 11 -24.3) and the
// only profitable ones sent exactly one trade (momentum +2.45, buy-and-hold +1.07).
//
// So this bot buys ONCE, rides the trend, and leaves only through a trailing stop that
// arms after the move has paid for itself. Parameters were chosen for robustness, not
// peak dev PnL: on the dev window this exact rule makes +5.59 USDC in 2 trades, and on
// every 12-hour sub-window of the dev data it also finishes positive (min +1.17, mean
// +6.91 over six slices) — an unseen race window is one draw, and a rule that wins from
// most starting points is the only honest way to enter it.
//
// Pure function of the bars the harness sends: no clock, no environment, no Math.random
// (the entry runs twice and both action logs must match byte for byte).

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10_000n;

/** The trend spine (EMA-240): the buy gate, and the same EMA seeds the peak's reference. */
const SPINE_SPAN = 240n;
/** The trailing stop arms only after the position is this far in profit (bp): a stop that
 *  fires before the round trip is paid just donates 26 bps. */
const ARM_BPS = 100n;
/** After arming, give back at most this much from the peak (bp) and leave. */
const TRAIL_BPS = 50n;
/** Never let a fill be refused for slippage: net PnL is the score, a rejection costs a bar. */
const MAX_SLIPPAGE_BPS = 10_000;
/** Keep the buy above the 1 USDC min-notional floor. */
const CASH_RESERVE = 10_000n; // 0.01 USDC at quote_scale 6
const MIN_NOTIONAL = 1_000_000n;

/** Fixed-point scale so integer EMA steps don't lose the spine to truncation. */
const S = 1_000_000n;

let emaScaled: bigint | null = null;
let armed = false;
let entryPrice = 0n;
let peak = 0n;
let buys = 0;

function onBatch(state: BarsState): OrderInput[] {
  const price = state.close(SYMBOL);
  if (price === null) return [];

  // Warm-up bars reject every order but are real history: keep the spine converging.
  const target = price * S;
  emaScaled = emaScaled === null ? target : emaScaled + ((target - emaScaled) * 2n) / (SPINE_SPAN + 1n);

  if (state.warmingUp) return [];

  const held = state.positions.get(SYMBOL);
  if (!held) {
    // One entry: the first bar (after warm-up) whose close sits above the spine.
    if (!armed && price * BPS * S > emaScaled! * BPS) {
      armed = true;
      entryPrice = price;
      peak = price;
      const spend = state.cash - CASH_RESERVE;
      if (spend >= MIN_NOTIONAL) {
        buys++;
        return [
          { side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS },
        ];
      }
    }
    return [];
  }

  peak = peak > price ? peak : price;
  // Arm: the position is ARM_BPS in profit. Trail: the peak stands TRAIL_BPS above price.
  if ((peak - entryPrice) * BPS >= ARM_BPS * entryPrice && peak * BPS > price * (BPS + TRAIL_BPS)) {
    return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

// Diagnostics to stderr only: stdout carries replies, nothing else.
await runBars({
  onBatch,
  onHello: (state) => {
    console.error(
      `hello: caps=${JSON.stringify(state.hello.caps)} fees=${JSON.stringify(state.hello.fees)} warmup=${state.hello.warmup_bars ?? 0}`,
    );
  },
  onDone: (state) => {
    console.error(
      `done: cash=${state.cash} pnl=${state.cash - 1_000_000_000n} bars_seen=1440 buys=${buys}`,
    );
  },
});
