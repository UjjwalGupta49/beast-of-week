import { useState } from "react";
import { useRouter } from "next/router";
import DatePicker from "react-datepicker";
import axios from "axios";
import Head from "next/head";
import { marketInfo } from "@/utils/marketInfo";
import "react-datepicker/dist/react-datepicker.css";
import { setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

const DatePickerComponent = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [tradingData, setTradingData] = useState(null);
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [endTimestamp, setEndTimestamp] = useState<number | null>(null);
  const [pageMode, setPageMode] = useState("overall"); // State to track the current page mode
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const router = useRouter();

  const getTimestampAtMidnight = (date: Date | null): number | null => {
    if (!date) return null;
    const dateAtMidnight = setMilliseconds(
      setSeconds(setMinutes(setHours(date, 0), 0), 0),
      0
    );
    return Math.floor(dateAtMidnight.getTime() / 1000);
  };

  const fetchTradingHistory = async (from: number, to: number) => {
    try {
      const response = await axios.get(`/api/getPnl?from=${from}&to=${to}`);
      setTradingData(response.data);
      console.log("Trading history data:", response.data);
    } catch (error) {
      console.error("Error fetching trading history:", error);
    }
  };

  const handleGetTradingHistory = () => {
    const start = getTimestampAtMidnight(startDate);
    const end = getTimestampAtMidnight(endDate);
    setStartTimestamp(start);
    setEndTimestamp(end);
    if (startTimestamp !== null && endTimestamp !== null) {
      if (pageMode === "markets") {
        setIsMarketModalOpen(true);
      } else {
        router.push({
          pathname: "/beast",
          query: { from: startTimestamp, to: endTimestamp, marketId: null },
        });
      }
    } else {
      console.error("Please select both start and end dates");
    }
  };

  return (
    <>
      <Head>
        <title>Beast of the week</title>
      </Head>
      <div className="flex flex-col items-center justify-center gap-4 p-6 max-w-lg mx-auto bg-white/30 backdrop-blur-md rounded-xl shadow-lg">
        {/* Switch Component */}
        <div className="flex justify-center items-center space-x-4 mb-4">
          <button
            className={`px-4 py-2 rounded-full font-medium ${
              pageMode === "overall"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
            onClick={() => setPageMode("overall")}
          >
            Overall
          </button>
          <button
            className={`px-4 py-2 rounded-full font-medium ${
              pageMode === "markets"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
            onClick={() => setPageMode("markets")}
          >
            Markets
          </button>
        </div>

        <div className="w-full">
          <label className="block text-xl font-medium text-blue-800">
            Start Date
          </label>
          <p className="text-lg text-gray-700">
            The starting date of the trading history
          </p>
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            dateFormat="yyyy/MM/dd"
            className="mt-2 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-400 focus:ring focus:ring-blue-200 focus:ring-opacity-50 text-lg bg-white/60 text-blue-800 backdrop-blur-md text-center"
            placeholderText="Select start date"
            popperClassName="z-50"
          />
        </div>
        <div className="w-full">
          <label className="block text-xl font-medium text-blue-800">
            End Date
          </label>
          <p className="text-lg text-gray-700">
            The end date of accounting of the trading history
          </p>
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            dateFormat="yyyy/MM/dd"
            className="mt-2 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-400 focus:ring focus:ring-blue-200 focus:ring-opacity-50 text-lg bg-white/60 text-blue-800 backdrop-blur-md text-center"
            placeholderText="Select end date"
            popperClassName="z-50"
          />
        </div>
        <div>
          <button
            onClick={handleGetTradingHistory}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-5 rounded-lg text-lg shadow-lg backdrop-blur-lg"
          >
            Get Trading History
          </button>
        </div>

        {isMarketModalOpen && (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center">
    <div className="bg-white/90 p-4 rounded-xl shadow-xl text-center backdrop-blur-md border border-gray-300">
      <h3 className="font-bold text-lg text-blue-800">Select a Token Pair</h3>
      <div className="grid grid-cols-4 gap-4 mt-4">
        {Object.entries(marketInfo).map(
          ([key, { tokenPair, side }]) => (
            <button
              key={key}
              onClick={() => {
                console.log(`Token Pair Selected: ${tokenPair}`);
                setIsMarketModalOpen(false);
                router.push({
                  pathname: "/beast",
                  query: {
                    from: startTimestamp,
                    to: endTimestamp,
                    marketId: key,
                  },
                });
              }}
              className={`${
                side === "long"
                  ? "bg-green-200 hover:bg-green-300"
                  : "bg-red-200 hover:bg-red-300"
              } text-blue-800 p-2 rounded transition duration-150 ease-in-out`}
            >
              {tokenPair}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => setIsMarketModalOpen(false)}
        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-5 rounded-lg text-lg shadow-lg backdrop-blur-lg"
      >
        Close
      </button>
    </div>
  </div>
)}

      </div>
    </>
  );
};

export default DatePickerComponent;
