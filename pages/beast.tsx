import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Transition } from "@headlessui/react";
import axios from "axios";
import FileSaver from "file-saver";
import { Parser } from "json2csv";
import { PoolConfig, Token } from "flash-sdk";
import { marketInfo } from "@/utils/marketInfo";

interface Profit {
  "net profit": number;
  "gross profit": number;
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
};

type UsdFields = 'sizeUsd' | 'collateralUsd' | 'pnlUsd';


const POOL_NAMES = ["Crypto.1", "Virtual.1", "Governance.1", "Community.1"];
const POOL_CONFIGS = POOL_NAMES.map((f) =>
  PoolConfig.fromIdsByName(f, "mainnet-beta")
);

const DUPLICATE_TOKENS = POOL_CONFIGS.flatMap((f) => f.tokens);
const tokenMap = new Map(DUPLICATE_TOKENS.map((token) => [token.symbol, token]));
const ALL_TOKENS: Token[] = Array.from(tokenMap.values());

const fetchTradingHistory = async (from: number, to: number, marketId: string | null, setTradingData: Function) => {
  try {
    const response = await axios.get(`/api/getPnl?from=${from}&to=${to}&marketId=${marketId}`);
    setTradingData(response.data);
  } catch (error) {
    console.error("Error fetching trading history:", error);
  }
};

const fetchUserTradingHistory = async (address: string) => {
  try {
    const response = await axios.get(`https://api.prod.flash.trade/trading-history/find-all-by-user-v2/${address}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user trading history:", error);
    return [];
  }
};

const formatTradeData = (trades: Trade[]): Trade[] => {
  return trades.map((trade) => {
    const marketKey = trade.market;
    if (marketInfo[marketKey]) {
      trade.market = marketInfo[marketKey].tokenPair;
    }

    (['sizeUsd', 'collateralUsd', 'pnlUsd'] as UsdFields[]).forEach((field) => {
      if (trade[field]) {
        trade[field] = (parseFloat(trade[field] as string) * 10 ** -6).toString();
      }
    });

    const collateralToken = ALL_TOKENS.find((token) => token.symbol === trade.market);
    const collateralTokenDecimals = collateralToken?.decimals || 0;
    const collateralTokenPrice =
      trade.side === 'long'
        ? trade.oraclePrice
          ? parseFloat(trade.oraclePrice) * 10 ** trade.oraclePriceExponent
          : trade.price
          ? parseFloat(trade.price) * 10 ** -6
          : 1.0
        : 1.0;
    trade.oraclePrice = collateralTokenPrice.toString();

    let feesUsd;
    if (trade.feeAmount) {
      feesUsd = parseFloat(trade.feeAmount) * 10 ** -collateralTokenDecimals * collateralTokenPrice;
    }

    // Convert the timestamp to human-readable UTC standard date and time
    const timestamp = parseInt(trade.timestamp, 10);
    const date = new Date(timestamp * 1000).toISOString();

    return { ...trade, feesUsd, timestamp: date };
  });
};




const generateCSV = (data: Trade[], filename: string) => {
  const fields = [
    "txId", "eventIndex", "timestamp", "positionAddress", "owner", "market",
    "side", "tradeType", "price", "sizeUsd", "sizeAmount", "collateralUsd",
    "collateralPrice", "collateralAmount", "pnlUsd", "liquidationPrice",
    "feeAmount", "feesUsd", "id", "oraclePrice", "oraclePriceExponent"
  ];
  const json2csvParser = new Parser({ fields });

  try {
    const csv = json2csvParser.parse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    FileSaver.saveAs(blob, filename);
  } catch (error) {
    console.error("Error converting JSON to CSV:", error);
  }
};

const getTraderCsv = async (address: string) => {
  const filteredData = await fetchUserTradingHistory(address);
  if (filteredData.length === 0) return;

  const updatedData = formatTradeData(filteredData);
  generateCSV(updatedData, `trading_history_${address}.csv`);
};

const fetchAllSettledPosition = async (from: number, to: number, marketId?: string, setLoading?: Function) => {
  if (setLoading) setLoading(true);
  try {
    const queryParams = `to=${to}&from=${from}&eventTypes=OPEN_POSITION&eventTypes=CLOSE_POSITION&eventTypes=TAKE_PROFIT&eventTypes=STOP_LOSS&eventTypes=LIQUIDATE&eventTypes=ADD_COLLATERAL&eventTypes=REMOVE_COLLATERAL&eventTypes=INCREASE_SIZE&eventTypes=DECREASE_SIZE`;
    const url = `https://api.prod.flash.trade/trading-history/filter?${queryParams}`;
    const response = await axios.get(url);

    let filteredData = response.data;
    if (marketId) {
      filteredData = filteredData.filter((trade:Trade) => trade.market === marketId);
    }

    const updatedData = formatTradeData(filteredData);
    generateCSV(updatedData, `settled_positions_${from}_to_${to}.csv`);
  } catch (error) {
    console.error("Error fetching settled positions:", error);
  } finally {
    if (setLoading) setLoading(false);
  }
};

const copyToClipboard = (text: string, setNotificationVisible: Function) => {
  navigator.clipboard.writeText(`https://beast.flash.trade/?public_key=${text}`).then(
    () => {
      setNotificationVisible(true);
      setTimeout(() => setNotificationVisible(false), 2000);
    },
    (err) => console.error("Could not copy text to clipboard", err)
  );
};

const shortenAddress = (address: string) => {
  return `${address.slice(0, 5)}...${address.slice(-3)}`;
};

const BeastPage = () => {
  const router = useRouter();
  const { from, to, marketId } = router.query;

  const [tradingData, setTradingData] = useState<Record<string, Profit> | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (from && to) {
      const fromTimestamp = parseInt(from as string, 10);
      const toTimestamp = parseInt(to as string, 10);
      const validMarketId = typeof marketId === "string" ? marketId : null;
      fetchTradingHistory(fromTimestamp, toTimestamp, validMarketId, setTradingData);
    }
  }, [from, to, marketId]);

  return (
    <div className="relative flex flex-col items-center gap-6 p-6 bg-gray-100 min-h-screen">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-blue-800">Trading History</h1>
        <button
          onClick={() => fetchAllSettledPosition(parseInt(from as string, 10), parseInt(to as string, 10), marketId ? marketId as string : undefined, setLoading)}
          className="ml-4 p-3 bg-green-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition duration-200 ease-in-out transform hover:scale-105"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
          ) : (
            "Download Trades"
          )}
        </button>
      </div>

      {tradingData ? (
        <div className="mt-6 w-full max-w-2xl bg-white/30 backdrop-blur-md rounded-xl shadow-lg overflow-hidden">
          <table className="min-w-full bg-white/60 rounded-md backdrop-blur-md">
            <thead>
              <tr>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">Trader</th>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">Net Profit</th>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-center text-lg font-medium text-blue-800">Gross Profit</th>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-center text-lg font-medium text-blue-800">CSV Of Trades</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tradingData).map(([user, pnl]) => (
                <tr key={user}>
                  <td
                    className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg cursor-pointer"
                    onClick={() => copyToClipboard(user, setNotificationVisible)}
                  >
                    {shortenAddress(user)}
                  </td>
                  <td className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg">{pnl["net profit"].toFixed(2)}</td>
                  <td className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg">{pnl["gross profit"].toFixed(2)}</td>
                  <td className="px-6 py-4 border-b border-blue-300 text-center">
                    <button onClick={() => getTraderCsv(user)} className="ml-4 p-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">⬇️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center flex-grow">
          <svg className="animate-spin h-12 w-12 text-blue-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        </div>
      )}

      <Transition
        show={notificationVisible}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="absolute top-5 left-5 bg-white/60 backdrop-blur-md text-blue-800 text-lg rounded-lg shadow-lg px-4 py-2">
          Address copied to clipboard
        </div>
      </Transition>
    </div>
  );
};

export default BeastPage;
