import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { PoolConfig, Token } from "flash-sdk";
import { marketInfo, MarketInfo } from "@/utils/marketInfo";
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
interface Profit {
  "net profit": number;
  "gross profit": number;
  "total fees": number;
  "open fee": number;
}

const POOL_NAMES = ["Crypto.1", "Virtual.1", "Governance.1", "Community.1"];
const POOL_CONFIGS = POOL_NAMES.map((f) =>
  PoolConfig.fromIdsByName(f, "mainnet-beta")
);

const DUPLICATE_TOKENS = POOL_CONFIGS.map((f) => f.tokens).flat();
const tokenMap = new Map();
for (const token of DUPLICATE_TOKENS) {
  tokenMap.set(token.symbol, token);
}

// Define ALL_TOKENS
const ALL_TOKENS: Token[] = Array.from(tokenMap.values());

const getCollateralTokenDecimals = (marketId: string): number => {
  const tokenPair = marketInfo[marketId]?.tokenPair;
  if (!tokenPair) return 0;
  const secondTokenSymbol = tokenPair.split("/")[1];
  if (marketId == "DvvnSEZueicT9UN9WMvfYP3B4NQDgiNjjtbKLenLakxv") {
    console.log({
      tokenPair: tokenPair,
      secondTokenSymbol: secondTokenSymbol,
      decimals: ALL_TOKENS.find((i) => i.symbol === secondTokenSymbol)?.decimals || 0
    })
  };
  return ALL_TOKENS.find((i) => i.symbol === secondTokenSymbol)?.decimals || 0;
};

const fetchTradingHistory = async (
  from: number,
  to: number,
  marketId?: string | null
) => {
  let queryParams = `to=${to}&from=${from}&eventTypes=TAKE_PROFIT&eventTypes=CLOSE_POSITION&eventTypes=STOP_LOSS&eventTypes=LIQUIDATE&eventTypes=OPEN_POSITION&eventTypes=INCREASE_SIZE`;
  const url = `https://api.prod.flash.trade/trading-history/filter?${queryParams}`;
  try {
    const response = await axios.get(url);

    // Write the response data to trades.json
    // fs.writeFileSync("trades.json", JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error("Error fetching trading history:", error);
    throw error;
  }
};

const sortPnlByOwner = (
  pnlByOwner: Record<string, Profit>
): Record<string, Profit> => {
  const sortedPnls = Object.entries(pnlByOwner)
    .sort(([, a], [, b]) => b["net profit"] - a["net profit"]) // Descending sort based on net profit
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, Profit>);

  return sortedPnls;
};

const calculateCumulativePnls = (trades: Trade[]): Record<string, Profit> => {
    const pnlByOwner: Record<string, Profit> = {};
  
    for (const trade of trades) {
      const feeAmount = parseFloat(trade.feeAmount);
      const collateralTokenDecimals = getCollateralTokenDecimals(trade.market);
      
      const oraclePrice = parseFloat(trade.oraclePrice);
      const oraclePriceExponent = trade.oraclePriceExponent;
      const collateralTokenPrice =
        trade.side === "long"
          ? oraclePrice !== null
            ? oraclePrice * 10 ** oraclePriceExponent
            : trade.price !== null
            ? parseFloat(trade.price) * 10 ** -6
            : 1.0
          : 1.0;
  
      const feeUsd =
        feeAmount * 10 ** -collateralTokenDecimals * collateralTokenPrice;
  
      let openFeeUsd = 0;
      if (
        trade.tradeType === "OPEN_POSITION" ||
        trade.tradeType === "INCREASE_SIZE"
      ) {
        openFeeUsd = feeUsd;
      }

      if (!pnlByOwner[trade.owner]) {
        pnlByOwner[trade.owner] = {
          "net profit": 0,
          "gross profit": 0,
          "total fees": 0,
          "open fee": 0,
        };
      }
  
      if (trade.pnlUsd !== null) {
        const pnl = parseFloat(trade.pnlUsd);
        if (!isNaN(pnl)) {
  
          pnlByOwner[trade.owner]["net profit"] += pnl;
          pnlByOwner[trade.owner]["gross profit"] += feeUsd;
          pnlByOwner[trade.owner]["total fees"] += feeUsd;
          
        }
      } else if (trade.tradeType == "OPEN_POSITION" || trade.tradeType == "INCREASE_SIZE") {
        pnlByOwner[trade.owner]["open fee"] += openFeeUsd;
        pnlByOwner[trade.owner]["total fees"] += feeUsd;
      }
    }
  
    for (const owner in pnlByOwner) {
      pnlByOwner[owner]["net profit"] *= 10 ** -6; // net profit + opening fee
      pnlByOwner[owner]["gross profit"] += pnlByOwner[owner]["net profit"]; // net profit + opening fee + closing fees
      pnlByOwner[owner]["net profit"] -= pnlByOwner[owner]["open fee"]; // net profit
    }
  
    return pnlByOwner;
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

    const pnlByOwner = calculateCumulativePnls(filteredTrades);
    const sortedPnlByOwner = sortPnlByOwner(pnlByOwner);

    res.status(200).json(sortedPnlByOwner);
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Failed to fetch trading history" });
  }
};

export default handler;
