// /pages/beast.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Transition } from '@headlessui/react';
import axios from 'axios';

const fetchTradingHistory = async (from: number, to: number, marketId: string | null, setTradingData: Function) => {
    try {
        const response = await axios.get(`/api/getPnl?from=${from}&to=${to}&marketId=${marketId}`);
        setTradingData(response.data);
        console.log('Trading history data:', response.data);
    } catch (error) {
        console.error('Error fetching trading history:', error);
    }
};

const copyToClipboard = (text: string, setNotificationVisible: Function) => {
    navigator.clipboard.writeText(text).then(
        () => {
            console.log(`Copied ${text} to clipboard`);
            setNotificationVisible(true);
            setTimeout(() => setNotificationVisible(false), 2000); // Hide after 2 seconds
        },
        (err) => console.error("Could not copy text to clipboard", err)
    );
};

const BeastPage = () => {
    const router = useRouter();
    const { from, to, marketId } = router.query;
    const [tradingData, setTradingData] = useState<Record<string, number> | null>(null);
    const [notificationVisible, setNotificationVisible] = useState(false);

    useEffect(() => {
        if (from && to) {
            const fromTimestamp = parseInt(from as string, 10);
            const toTimestamp = parseInt(to as string, 10);
            const validMarketId = typeof marketId === 'string' ? marketId : null;
            fetchTradingHistory(fromTimestamp, toTimestamp, validMarketId, setTradingData);
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
                                    USER
                                </th>
                                <th className="px-6 py-3 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">
                                    PNL USD
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(tradingData).map(([user, pnl]) => (
                                <tr key={user}>
                                    <td className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg cursor-pointer" onClick={() => copyToClipboard(user, setNotificationVisible)}>
                                        {user}
                                    </td>
                                    <td className="px-6 py-4 border-b border-blue-300 text-blue-800 text-lg">
                                        {pnl.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) :(
                <div className="flex items-center justify-center flex-grow">
                    <svg className="animate-spin h-12 w-12 text-blue-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            )
            }

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
