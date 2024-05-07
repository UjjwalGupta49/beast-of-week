import { useState } from "react";
import { useRouter } from "next/router";
import DatePicker from "react-datepicker";
import axios from "axios";
import Head from "next/head";
import "react-datepicker/dist/react-datepicker.css";
import { setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

const DatePickerComponent = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [tradingData, setTradingData] = useState(null);
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
    const startTimestamp = getTimestampAtMidnight(startDate);
    const endTimestamp = getTimestampAtMidnight(endDate);
    if (startTimestamp !== null && endTimestamp !== null) {
      console.log("Start timestamp:", startTimestamp);
      console.log("End timestamp:", endTimestamp);

      // Redirect to /beast with the given parameters
      router.push({
        pathname: "/beast",
        query: { from: startTimestamp, to: endTimestamp },
      });
    } else {
      console.error("Please select both start and end dates");
    }
  };

  return (
    <>
      <Head>
        <title>Beast of the week</title>
      </Head>
      <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto bg-white/30 backdrop-blur-md rounded-xl shadow-lg">
        <div>
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
        <div>
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
      </div>
    </>
  );
};

export default DatePickerComponent;
