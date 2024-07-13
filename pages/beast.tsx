// /pages/beast.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Transition } from "@headlessui/react";
import axios from "axios";
import FileSaver from "file-saver";
import { Parser } from "json2csv";

const fetchTradingHistory = async (
  from: number,
  to: number,
  marketId: string | null,
  setTradingData: Function
) => {
  try {
    const response = await axios.get(
      `/api/getPnl?from=${from}&to=${to}&marketId=${marketId}`
    );
    setTradingData(response.data);
    console.log("Trading history data:", response.data);
  } catch (error) {
    console.error("Error fetching trading history:", error);
  }
};

const fetchUserTradingHistory = async (address: string) => {
  try {
    const response = await axios.get(
      `https://api.prod.flash.trade/trading-history/find-all-by-user-v2/${address}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching user trading history:", error);
    return [];
  }
};

const getTraderCsv = async (address: string) => {
  const tradingHistory = await fetchUserTradingHistory(address);
  if (tradingHistory.length === 0) return;

  const fields = [
    "txId",
    "eventIndex",
    "timestamp",
    "positionAddress",
    "owner",
    "market",
    "side",
    "tradeType",
    "price",
    "sizeUsd",
    "sizeAmount",
    "collateralUsd",
    "collateralPrice",
    "collateralAmount",
    "pnlUsd",
    "liquidationPrice",
    "feeAmount",
    "id",
    "oraclePrice",
    "oraclePriceExponent",
  ];

  const json2csvParser = new Parser({ fields });
  try {
    const csv = json2csvParser.parse(tradingHistory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    FileSaver.saveAs(blob, `trading_history_${address}.csv`);
  } catch (error) {
    console.error("Error converting JSON to CSV:", error);
  }
};

const copyToClipboard = (text: string, setNotificationVisible: Function) => {
  navigator.clipboard.writeText(`https://beast.flash.trade/?public_key=${text}`).then(
    () => {
      console.log(`Copied https://beast.flash.trade/?public_key=${text} to clipboard`);
      setNotificationVisible(true);
      setTimeout(() => setNotificationVisible(false), 2000); // Hide after 2 seconds
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
  const [tradingData, setTradingData] = useState<Record<string, number> | null>(
    null
  );
  const [notificationVisible, setNotificationVisible] = useState(false);

  useEffect(() => {
    if (from && to) {
      const fromTimestamp = parseInt(from as string, 10);
      const toTimestamp = parseInt(to as string, 10);
      const validMarketId = typeof marketId === "string" ? marketId : null;
      fetchTradingHistory(
        fromTimestamp,
        toTimestamp,
        validMarketId,
        setTradingData
      );
    }
  }, [from, to, marketId]);

  return (
    <div className="relative flex flex-col items-center gap-6 p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-800">Trading History</h1>

      {tradingData ? (
        <div className="mt-6 w-full max-w-2xl bg-white/30 backdrop-blur-md rounded-xl shadow-lg overflow-hidden">
          <table className="min-w-full bg-white/60 rounded-md backdrop-blur-md">
            <thead>
              <tr>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">
                  Trader
                </th>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">
                  Net Profit
                </th>
                <th className="px-6 py-3 border-b-2 border-blue-300 text-center text-lg font-medium text-blue-800">
                  CSV Of Trades
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tradingData).map(([user, pnl]) => (
                <tr key={user}>
                  <td
                    className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg cursor-pointer"
                    onClick={() =>
                      copyToClipboard(user, setNotificationVisible)
                    }
                  >
                    {shortenAddress(user)}
                  </td>
                  <td className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg">
                    {pnl.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 border-b border-blue-300 text-center">
                    <button
                      onClick={() => getTraderCsv(user)}
                      className="ml-4 p-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                      ⬇️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center flex-grow">
          <svg
            className="animate-spin h-12 w-12 text-blue-800"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
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
