#!/usr/bin/env python
"""
Fetch order/fill/settlement history from Kalshi and analyze why losing trades lost.

Uses the same KalshiClient auth as server.py.
"""

import os, sys, json, time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(".env.prod")

from pylib.kalshi_client import KalshiClient


class KalshiAnalyzer(KalshiClient):
    """Extends KalshiClient with GET methods for order history."""

    def _get(self, path: str, params: dict = None) -> dict:
        url = self.base_url + path
        headers = self._get_auth_headers("GET", url)
        resp = self.session.get(url, headers=headers, params=params or {})
        resp.raise_for_status()
        return resp.json()

    def _paginate(self, path: str, params: dict = None, key: str = None) -> list:
        params = dict(params or {})
        params.setdefault("limit", 200)
        all_items = []
        cursor = None
        page = 0
        while True:
            if cursor:
                params["cursor"] = cursor
            data = self._get(path, params)
            items = data.get(key or self._infer_key(path), [])
            all_items.extend(items)
            cursor = data.get("cursor")
            page += 1
            if len(items) > 0:
                print(f"    page {page}: {len(items)} items (total {len(all_items)})", end="\r")
            if not cursor:
                break
            time.sleep(0.05)
        if all_items:
            print(f"    {len(all_items)} total items                    ")
        return all_items

    @staticmethod
    def _infer_key(path: str) -> str:
        return {
            "/portfolio/orders": "orders",
            "/portfolio/fills": "fills",
            "/portfolio/positions": "market_positions",
            "/portfolio/settlements": "settlements",
        }.get(path, "data")

    def get_orders(self, **filters) -> list:
        return self._paginate("/portfolio/orders", filters)

    def get_fills(self, **filters) -> list:
        return self._paginate("/portfolio/fills", filters)

    def get_positions(self, **filters) -> list:
        return self._paginate("/portfolio/positions", filters)

    def get_settlements(self, **filters) -> list:
        return self._paginate("/portfolio/settlements", filters)

    def get_market(self, ticker: str) -> dict:
        data = self._get(f"/markets/{ticker}")
        return data.get("market", data)


def parse_float(s) -> float:
    """Parse a string-or-number to float."""
    if isinstance(s, (int, float)):
        return float(s)
    if isinstance(s, str):
        return float(s) if s else 0.0
    return 0.0


def fmt_d(dollars) -> str:
    """Format dollar float as $X.XX."""
    return f"${dollars:,.2f}"


def get_fill_price(f: dict) -> float:
    """Extract price per contract from a fill."""
    side = f.get("side", "").lower()
    if side == "yes":
        return parse_float(f.get("yes_price_dollars", 0))
    else:
        return parse_float(f.get("no_price_dollars", 0))


def get_fill_cost(f: dict) -> float:
    """Total cost of a fill in dollars."""
    count = parse_float(f.get("count_fp", 0))
    price = get_fill_price(f)
    return count * price


def main():
    print("=" * 70)
    print("  KALSHI ORDER HISTORY ANALYSIS")
    print("=" * 70)

    client = KalshiAnalyzer(
        key_id=os.environ["KALSHI_KEY_ID"],
        private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
        environment=os.environ.get("KALSHI_ENV", "prod"),
    )
    print(f"Connected to: {client.base_url}\n")

    # Fetch everything
    print("Fetching settlements...")
    settlements = client.get_settlements()
    print("Fetching fills...")
    fills = client.get_fills()
    print("Fetching executed orders...")
    orders = client.get_orders(status="executed")

    # Index settlements by ticker
    settlement_by_ticker = {}
    for s in settlements:
        t = s.get("ticker", "")
        if t:
            settlement_by_ticker[t] = s

    # ============================================================
    # ANALYSIS: Group fills by ticker, match settlements, compute P&L
    # ============================================================
    market_data = defaultdict(lambda: {
        "fills": [],
        "orders": [],
        "yes_count": 0.0, "no_count": 0.0,
        "yes_cost": 0.0, "no_cost": 0.0,
    })

    for f in fills:
        t = f.get("ticker", "")
        if not t:
            continue
        side = f.get("side", "").lower()
        count = parse_float(f.get("count_fp", 0))
        cost = get_fill_cost(f)
        md = market_data[t]
        md["fills"].append(f)
        if side == "yes":
            md["yes_count"] += count
            md["yes_cost"] += cost
        else:
            md["no_count"] += count
            md["no_cost"] += cost

    for o in orders:
        t = o.get("ticker", "")
        if t:
            market_data[t]["orders"].append(o)

    # ============================================================
    # PRINT PER-MARKET BREAKDOWN
    # ============================================================
    print("\n" + "=" * 70)
    print("  PER-MARKET BREAKDOWN (resolved markets)")
    print("=" * 70)

    all_wins = []
    all_losses = []
    all_unknown = []
    total_win_pl = 0.0
    total_loss_pl = 0.0

    for ticker in sorted(market_data.keys()):
        md = market_data[ticker]
        total_cost = md["yes_cost"] + md["no_cost"]
        if total_cost == 0:
            continue

        settlement = settlement_by_ticker.get(ticker, {})
        market_result = settlement.get("market_result")  # "yes" or "no"

        if not market_result:
            all_unknown.append((ticker, md))
            continue

        winner = market_result.lower()

        if winner == "yes":
            win_count = md["yes_count"]
            lose_count = md["no_count"]
            lose_cost = md["no_cost"]
            win_side_label = "YES"
            lose_side_label = "NO"
        else:
            win_count = md["no_count"]
            lose_count = md["yes_count"]
            lose_cost = md["yes_cost"]
            win_side_label = "NO"
            lose_side_label = "YES"

        payout = win_count * 1.0  # each contract pays $1
        pl = payout - total_cost

        entry = (ticker, pl, md, settlement, win_side_label, lose_side_label, lose_cost, lose_count)

        if pl > 0:
            all_wins.append(entry)
            total_win_pl += pl
        elif pl < 0:
            all_losses.append(entry)
            total_loss_pl += pl

    # Sort by abs P&L
    all_wins.sort(key=lambda x: x[1], reverse=True)
    all_losses.sort(key=lambda x: x[1])

    def print_breakdown(entries, label):
        for ticker, pl, md, settlement, win_side, lose_side, lose_cost, lose_count in entries:
            total_cost = md["yes_cost"] + md["no_cost"]
            payout = pl + total_cost
            print(f"\n{'─' * 70}")
            print(f"  Ticker: {ticker}")
            print(f"  Settlement: market_result={win_side.upper()}  |  settled={settlement.get('settled_time','?')[:10]}")
            print(f"  Verdict: {label}  |  P&L: {fmt_d(pl)}")
            print(f"  ─────────────────────────────────────────────")
            print(f"  YES: {md['yes_count']:.0f} contracts @ cost {fmt_d(md['yes_cost'])}")
            print(f"  NO:  {md['no_count']:.0f} contracts @ cost {fmt_d(md['no_cost'])}")
            print(f"  Total cost: {fmt_d(total_cost)}  |  Payout: {fmt_d(payout)}")
            if label == "LOSS":
                print(f"  WHY LOST: Market resolved {win_side.upper()} but you bet {fmt_d(lose_cost)} on {lose_side} ({lose_count:.0f} contracts)")
                if lose_cost < total_cost:
                    # Mixed bets — won some, but not enough
                    win_amount = total_cost - lose_cost
                    print(f"           Had {fmt_d(win_amount)} on winning {win_side} side, but it wasn't enough to cover {lose_side} losses.")
                else:
                    print(f"           All {fmt_d(total_cost)} was on the losing {lose_side} side.")

    # ============================================================
    # LOSSES
    # ============================================================
    print(f"\n{'■' * 70}")
    print(f"  LOSSES ({len(all_losses)} markets, {fmt_d(total_loss_pl)} total)")
    print(f"{'■' * 70}")
    print_breakdown(all_losses, "LOSS")

    # ============================================================
    # WINS
    # ============================================================
    print(f"\n{'■' * 70}")
    print(f"  WINS ({len(all_wins)} markets, {fmt_d(total_win_pl)} total)")
    print(f"{'■' * 70}")
    print_breakdown(all_wins, "WIN")

    # ============================================================
    # UNKNOWN (unresolved or couldn't match)
    # ============================================================
    if all_unknown:
        print(f"\n{'■' * 70}")
        print(f"  UNRESOLVED (no settlement match, {len(all_unknown)} markets)")
        print(f"{'■' * 70}")
        for ticker, md in all_unknown:
            total_cost = md["yes_cost"] + md["no_cost"]
            print(f"  {ticker}: YES {md['yes_count']:.0f}ct@{fmt_d(md['yes_cost'])}  NO {md['no_count']:.0f}ct@{fmt_d(md['no_cost'])}  total {fmt_d(total_cost)}")

    # ============================================================
    # GRAND SUMMARY
    # ============================================================
    print(f"\n{'=' * 70}")
    print("  GRAND SUMMARY")
    print(f"{'=' * 70}")

    try:
        balance = client._get("/portfolio/balance")
        bal = parse_float(balance.get("balance", 0))
        print(f"  Current balance: {fmt_d(bal / 100)}")
    except Exception:
        pass

    print(f"  Winning markets: {len(all_wins)}  ({fmt_d(total_win_pl)})")
    print(f"  Losing markets:  {len(all_losses)}  ({fmt_d(total_loss_pl)})")
    print(f"  Unresolved:      {len(all_unknown)}")
    net = total_win_pl + total_loss_pl
    print(f"  Net P&L:         {fmt_d(net)}")

    # ============================================================
    # LOSING PATTERN ANALYSIS
    # ============================================================
    print(f"\n{'─' * 70}")
    print("  LOSING PATTERN ANALYSIS")
    print(f"{'─' * 70}")

    # Categorize losses
    pure_wrong_side = []  # 100% on losing side
    mixed_wrong = []       # had some on winning side but not enough

    for ticker, pl, md, settlement, win_side, lose_side, lose_cost, lose_count in all_losses:
        total_cost = md["yes_cost"] + md["no_cost"]
        if lose_cost >= total_cost * 0.99:
            pure_wrong_side.append((ticker, pl, lose_cost, lose_side))
        else:
            mixed_wrong.append((ticker, pl, total_cost, lose_cost, win_side))

    print(f"\n  PURE WRONG SIDE ({len(pure_wrong_side)} losses — bet entirely on the losing outcome):")
    if pure_wrong_side:
        total_pure = sum(x[1] for x in pure_wrong_side)
        print(f"  Combined P&L: {fmt_d(total_pure)}")
        for ticker, pl, cost, side in sorted(pure_wrong_side, key=lambda x: x[1])[:5]:
            print(f"    {ticker}: {fmt_d(pl)} — bet {fmt_d(cost)} on losing {side} side")

    print(f"\n  MIXED BETS ({len(mixed_wrong)} losses — some on winning side but too little):")
    if mixed_wrong:
        total_mixed = sum(x[1] for x in mixed_wrong)
        print(f"  Combined P&L: {fmt_d(total_mixed)}")
        for ticker, pl, total, lose_c, winner in sorted(mixed_wrong, key=lambda x: x[1])[:5]:
            win_c = total - lose_c
            print(f"    {ticker}: {fmt_d(pl)} — {fmt_d(win_c)} on winning {winner}, {fmt_d(lose_c)} on losing side")

    # ============================================================
    # SETTLEMENT ANALYSIS — which settlements had non-zero positions
    # ============================================================
    print(f"\n{'─' * 70}")
    print("  RECENT SETTLEMENTS WITH NON-ZERO POSITIONS")
    print(f"{'─' * 70}")

    settled_with_position = [(s.get("settled_time",""), s) for s in settlements
                              if parse_float(s.get("yes_count_fp", 0)) > 0
                              or parse_float(s.get("no_count_fp", 0)) > 0]
    settled_with_position.sort(key=lambda x: x[0], reverse=True)

    for _, s in settled_with_position[:20]:
        t = s.get("ticker", "")
        result = s.get("market_result", "?").upper()
        yes_ct = parse_float(s.get("yes_count_fp", 0))
        no_ct = parse_float(s.get("no_count_fp", 0))
        yes_cost = parse_float(s.get("yes_total_cost_dollars", 0))
        no_cost = parse_float(s.get("no_total_cost_dollars", 0))
        revenue = parse_float(s.get("revenue", 0))
        settled_date = s.get("settled_time", "")[:10]

        total_cost = yes_cost + no_cost
        if result == "YES":
            payout = yes_ct * 1.0
            pl = payout - total_cost
        elif result == "NO":
            payout = no_ct * 1.0
            pl = payout - total_cost
        else:
            payout = 0
            pl = -total_cost

        outcome_label = "WIN" if pl > 0 else ("LOSS" if pl < 0 else "EVEN")
        print(f"  {settled_date}  {t:50s}  {result:4s}  {outcome_label:4s}  P&L {fmt_d(pl):>10s}  (YES {yes_ct:.0f}ct/{fmt_d(yes_cost)}  NO {no_ct:.0f}ct/{fmt_d(no_cost)})")

    # ============================================================
    # PER-KEYWORD P&L ANALYSIS
    # ============================================================
    # Build ticker → keyword map from all scheduled session files
    scheduled_dir = Path(__file__).resolve().parent.parent / "scheduled"
    ticker_to_keyword = {}
    if scheduled_dir.is_dir():
        for fpath in scheduled_dir.glob("*.json"):
            try:
                with open(fpath) as fp:
                    data = json.load(fp)
                keywords = data.get("keywords", {})
                for word, ticker in keywords.items():
                    if ticker not in ticker_to_keyword:
                        ticker_to_keyword[ticker] = word
            except Exception:
                pass

    # Also try market_tracking DBs for additional tickers
    market_tracking_dir = Path(__file__).resolve().parent.parent / "market_tracking"
    if market_tracking_dir.is_dir():
        for db_path in market_tracking_dir.glob("*.db"):
            try:
                import sqlite3
                conn = sqlite3.connect(str(db_path))
                rows = conn.execute("SELECT DISTINCT ticker FROM snapshots").fetchall()
                for (ticker,) in rows:
                    if ticker and ticker not in ticker_to_keyword:
                        pass  # We can't derive keyword from ticker alone without the session file
                conn.close()
            except Exception:
                pass

    # Compute per-keyword P&L
    keyword_pl = defaultdict(lambda: {"pl": 0.0, "wins": 0, "losses": 0, "total_cost": 0.0,
                                       "yes_count": 0.0, "no_count": 0.0, "markets": set()})

    for ticker, md in market_data.items():
        # Look up keyword
        kw = ticker_to_keyword.get(ticker)
        if not kw:
            # Fallback: use ticker suffix
            parts = ticker.rsplit("-", 1)
            kw = parts[-1].lower() if len(parts) > 1 else ticker

        settlement = settlement_by_ticker.get(ticker, {})
        market_result = settlement.get("market_result")
        if not market_result:
            continue

        total_cost = md["yes_cost"] + md["no_cost"]
        if total_cost == 0:
            continue

        winner = market_result.lower()
        if winner == "yes":
            payout = md["yes_count"] * 1.0
        else:
            payout = md["no_count"] * 1.0

        pl = payout - total_cost
        kd = keyword_pl[kw]
        kd["pl"] += pl
        kd["total_cost"] += total_cost
        kd["yes_count"] += md["yes_count"]
        kd["no_count"] += md["no_count"]
        kd["markets"].add(ticker)
        if pl > 0:
            kd["wins"] += 1
        elif pl < 0:
            kd["losses"] += 1

    print(f"{'=' * 70}")
    print("  PER-KEYWORD P&L (resolved markets)")
    print(f"{'=' * 70}")

    print(f"\n{'─' * 70}")
    print("  NET NEGATIVE KEYWORDS (lost money overall)")
    print(f"{'─' * 70}")
    neg_keywords = [(kw, d) for kw, d in keyword_pl.items() if d["pl"] < 0]
    neg_keywords.sort(key=lambda x: x[1]["pl"])
    for kw, d in neg_keywords:
        total = d["wins"] + d["losses"]
        print(f"  {kw:20s}  P&L {fmt_d(d['pl']):>10s}  {d['wins']}W/{d['losses']}L  {len(d['markets'])} mkts  cost {fmt_d(d['total_cost'])}")

    print(f"\n{'─' * 70}")
    print("  NET POSITIVE KEYWORDS (made money overall)")
    print(f"{'─' * 70}")
    pos_keywords = [(kw, d) for kw, d in keyword_pl.items() if d["pl"] > 0]
    pos_keywords.sort(key=lambda x: x[1]["pl"], reverse=True)
    for kw, d in pos_keywords:
        total = d["wins"] + d["losses"]
        print(f"  {kw:20s}  P&L {fmt_d(d['pl']):>10s}  {d['wins']}W/{d['losses']}L  {len(d['markets'])} mkts  cost {fmt_d(d['total_cost'])}")

    print(f"\n{'─' * 70}")
    print("  BREAK-EVEN KEYWORDS (no P&L)")
    print(f"{'─' * 70}")
    zero_keywords = [(kw, d) for kw, d in keyword_pl.items() if d["pl"] == 0 and d["total_cost"] > 0]
    for kw, d in zero_keywords:
        print(f"  {kw:20s}  {d['wins']}W/{d['losses']}L  {len(d['markets'])} mkts  cost {fmt_d(d['total_cost'])}")

    # Summary stats
    print(f"\n  Total keywords with P&L data: {len(keyword_pl)}")
    print(f"  Net negative: {len(neg_keywords)}  ({fmt_d(sum(d['pl'] for _, d in neg_keywords))})")
    print(f"  Net positive: {len(pos_keywords)}  ({fmt_d(sum(d['pl'] for _, d in pos_keywords))})")
    print()


if __name__ == "__main__":
    main()
