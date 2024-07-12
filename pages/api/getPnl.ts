import { NextApiRequest, NextApiResponse } from "next";
import { PoolConfig, Token } from "flash-sdk";
import { marketInfo, MarketInfo } from "@/utils/marketInfo";
import { MARKETS } from "../../utils/markets";
import axios from "axios";
import fs from "fs";

interface TradingHistoryQuery {
  from: string;
  to: string;
  marketId?: string | null;
}

interface Trade {
  txId: string;
  eventIndex: number;
  timestamp: string;
  positionAddress: string;
  owner: string;
  market: string;
  side: string;
  tradeType: string;
  price: string | null;
  sizeUsd: string;
  sizeAmount: string;
  collateralUsd: string;
  collateralPrice: number | null;
  collateralAmount: string;
  pnlUsd: string | null;
  liquidationPrice: number | null;
  feeAmount: string;
  id: number;
  oraclePrice: string;
  oraclePriceExponent: number;
}

const POOL_NAMES = ["Crypto.1", "Virtual.1", "Governance.1"];
const POOL_CONFIGS = POOL_NAMES.map((f) =>
  PoolConfig.fromIdsByName(f, "mainnet-beta")
);
const DUPLICATE_TOKENS = POOL_CONFIGS.map((f) => f.tokens).flat();

const tokenMap = new Map();
for (const token of DUPLICATE_TOKENS) {
  tokenMap.set(token.symbol, token);
}

const ALL_TOKENS: Token[] = Array.from(tokenMap.values());

const fetchTradingHistory = async (
  from: number,
  to: number,
  marketId?: string | null
) => {
  let queryParams = `to=${to}&from=${from}&eventTypes=TAKE_PROFIT&eventTypes=CLOSE_POSITION&eventTypes=STOP_LOSS&eventTypes=LIQUIDATE&eventTypes=DECREASE_SIZE&eventTypes=OPEN_POSITION&eventTypes=INCREASE_SIZE`;
  const url = `https://api.prod.flash.trade/trading-history/filter?${queryParams}`;
  try {
    const response = await axios.get(url);
    const data = response.data;

    // Write the response data to a JSON file
    // fs.writeFile(
    //   "tradingHistory.json",
    //   JSON.stringify(data, null, 2),
    //   (err) => {
    //     if (err) {
    //       console.error("Error writing to JSON file:", err);
    //       throw err;
    //     }
    //     console.log("Trading history has been written to tradingHistory.json");
    //   }
    // );

    return data;
  } catch (error) {
    console.error("Error fetching trading history:", error);
    throw error;
  }
};

const sortTradesByOwner = (
  trades: Trade[]
): Record<string, Trade[]> => {
  const tradesByOwner: Record<string, Trade[]> = {};

  for (const trade of trades) {
    if (!tradesByOwner[trade.owner]) {
      tradesByOwner[trade.owner] = [];
    }
    tradesByOwner[trade.owner].push(trade);
  }

  return tradesByOwner;
};

const calculateProfitsByOwner = (
  tradesByOwner: Record<string, Trade[]>
): { owner: string; "gross profit": string; "net profit": string }[] => {
  const results: { owner: string; "gross profit": string; "net profit": string }[] = [];

  const baseDiscount = 0.05;
  const maxFeeDiscount = 0.35;
  
  for (const [owner, trades] of Object.entries(tradesByOwner)) {
    let balance = 0;
    let balanceAfterFees = 0;
    let closingFeesUsd = 0;
    let totalFeesPaid = 0;
    let sumOriginalFee = 0;
    let feeSavings = 0;

    for (const trade of trades) {
      const market = MARKETS[trade.market];
  
      if (!market) {
        console.log('Trade market not found:', trade.market);
        continue;
      }
  
      const pnlUsd = trade.pnlUsd !== null ? parseFloat(trade.pnlUsd) * 10 ** -6 : 0;
      const sizeUsd = parseFloat(trade.sizeUsd) * 10 ** -6;
      const feeAmount = parseFloat(trade.feeAmount);
      const oraclePrice = trade.oraclePrice !== null ? parseFloat(trade.oraclePrice) : null;
      const oraclePriceExponent = trade.oraclePriceExponent;
  
      if (trade.tradeType === "CLOSE_POSITION" || trade.tradeType === "DECREASE_SIZE" || trade.tradeType === "TAKE_PROFIT" || trade.tradeType === "STOP_LOSS") {
        balance += pnlUsd;
        balanceAfterFees += pnlUsd;
        const collateralTokenDecimals = ALL_TOKENS.find((i) => i.symbol === market.name)?.decimals || 0;
        const collateralTokenPrice = trade.side === "long"
          ? (oraclePrice !== null ? oraclePrice * 10 ** oraclePriceExponent : (trade.price !== null ? parseFloat(trade.price) * 10 ** -6 : 1.0))
          : 1.0;
        const feeUsd = feeAmount * (10 ** -collateralTokenDecimals) * collateralTokenPrice;
        closingFeesUsd += feeUsd;
      }
  
      if (trade.tradeType === "OPEN_POSITION" || trade.tradeType === "INCREASE_SIZE") {
        const collateralTokenDecimals = ALL_TOKENS.find((i) => i.symbol === market.name)?.decimals || 0;
        const collateralTokenPrice = trade.side === "long"
          ? (oraclePrice !== null ? oraclePrice * 10 ** oraclePriceExponent : (trade.price !== null ? parseFloat(trade.price) * 10 ** -6 : 1.0))
          : 1.0;
        const feeUsd = feeAmount * (10 ** -collateralTokenDecimals) * collateralTokenPrice;

        balanceAfterFees -= feeUsd;
        totalFeesPaid += feeUsd;

        const originalFee = sizeUsd * (market.entryFeeBps / 10_000);
        const discountedFee = originalFee * (1 - baseDiscount);
        sumOriginalFee += originalFee;
        feeSavings += (originalFee - feeUsd);
      }
    }

    const finalPnl = parseFloat(balance.toFixed(2));
    const finalNetProfit = parseFloat((balanceAfterFees).toFixed(2));
    const grossProfit = parseFloat((finalPnl + closingFeesUsd).toFixed(2));

    results.push({
      owner,
      "gross profit": grossProfit.toFixed(2),
      "net profit": finalNetProfit.toFixed(2),
    });
  }

  results.sort((a, b) => parseFloat(b["gross profit"]) - parseFloat(a["gross profit"]));

  return results;
};


const handler = async (
  req: NextApiRequest & { query: TradingHistoryQuery },
  res: NextApiResponse
) => {
  const { from, to, marketId } = req.query;

  if (typeof from !== "string" || typeof to !== "string") {
    res.status(400).json({ error: "Invalid or missing query parameters" });
    return;
  }

  try {
    const fromTimestamp = parseInt(from, 10);
    const toTimestamp = parseInt(to, 10);

    if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
      throw new Error("Invalid timestamps");
    }
    const trades = await fetchTradingHistory(
      fromTimestamp,
      toTimestamp,
      marketId
    );
    let filteredTrades = trades;
    if (marketId) {
      filteredTrades = trades.filter((trade: Trade) => trade.market === marketId);
    }

    const tradesByOwner = sortTradesByOwner(filteredTrades);
    const profitsByOwner = calculateProfitsByOwner(tradesByOwner);

    res.status(200).json(profitsByOwner);
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Failed to fetch trading history" });
  }
};

export default handler;
