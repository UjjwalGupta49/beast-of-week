import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Transition } from '@headlessui/react';
import axios from 'axios';
import { Switch } from '@nextui-org/react';

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

const formatAddress = (address: string) => {
    return `${address.slice(0, 5)}...${address.slice(-3)}`;
};

const BeastPage = () => {
    const router = useRouter();
    const { from, to, marketId } = router.query;
    const [tradingData, setTradingData] = useState<any[] | null>(null);
    const [notificationVisible, setNotificationVisible] = useState(false);
    const [sortGrossDescending, setSortGrossDescending] = useState(false);
    const [sortNetDescending, setSortNetDescending] = useState(true); // Initially set to false to prioritize Gross Profit sorting by default

    useEffect(() => {
        if (from && to) {
            const fromTimestamp = parseInt(from as string, 10);
            const toTimestamp = parseInt(to as string, 10);
            const validMarketId = typeof marketId === 'string' ? marketId : null;
            fetchTradingHistory(fromTimestamp, toTimestamp, validMarketId, setTradingData);
        }
    }, [from, to, marketId]);

    const sortedData = tradingData
        ? tradingData.sort((a, b) => {
            if (sortGrossDescending) {
                return parseFloat(b["gross profit"]) - parseFloat(a["gross profit"]);
            } else if (sortNetDescending) {
                return parseFloat(b["net profit"]) - parseFloat(a["net profit"]);
            }
            return 0;
        })
        : [];

    const handleGrossSwitchChange = () => {
        setSortGrossDescending(!sortGrossDescending);
        setSortNetDescending(false);
        console.log(`Gross Profit sorting is now ${!sortGrossDescending ? "Descending" : "Ascending"}`);
    };

    const handleNetSwitchChange = () => {
        setSortNetDescending(!sortNetDescending);
        setSortGrossDescending(false);
        console.log(`Net Profit sorting is now ${!sortNetDescending ? "Descending" : "Ascending"}`);
    };

    return (
        <div className="relative flex flex-col items-center gap-6 p-6 bg-gray-100 min-h-screen">
            <div className="flex justify-between w-full max-w-2xl">
                <h1 className="text-2xl font-bold text-blue-800">Trading History</h1>
                <div className="flex gap-4">
                    <Switch
                        defaultSelected={sortGrossDescending}
                        size="lg"
                        color="secondary"
                        onChange={handleGrossSwitchChange}
                        thumbIcon={({ isSelected, className }) =>
                            isSelected ? (
                                <p>⬇️</p> 
                            ) : (
                                <p>⬆️</p>
                            )
                        }
                    >
                        Gross Profit {sortGrossDescending ? "Descending" : "Ascending"}
                    </Switch>
                    <Switch
                        defaultSelected={sortNetDescending}
                        size="lg"
                        color="secondary"
                        onChange={handleNetSwitchChange}
                        thumbIcon={({ isSelected, className }) =>
                            isSelected ? (
                                <p>⬇️</p> 
                            ) : (
                                <p>⬆️</p>
                            )
                        }
                    >
                        Net Profit {sortNetDescending ? "Descending" : "Ascending"}
                    </Switch>
                </div>
            </div>

            {tradingData ? (
                <div className="mt-6 w-full max-w-2xl mx-auto">
                    <p className="text-sm text-gray-600 mb-2 text-left">PNL now includes the entry fee paid by the trader.</p>
                    <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-lg overflow-hidden">
                        <table className="min-w-full w-auto bg-white/60 rounded-md backdrop-blur-md">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">
                                        USER
                                    </th>
                                    <th className="px-4 py-2 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">
                                        GROSS PROFIT
                                    </th>
                                    <th className="px-4 py-2 border-b-2 border-blue-300 text-left text-lg font-medium text-blue-800">
                                        NET PROFIT
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map(({ owner, "gross profit": grossProfit, "net profit": netProfit }) => (
                                    <tr key={owner}>
                                        <td className="px-4 py-2 border-b border-blue-300 text-blue-800 text-lg cursor-pointer" onClick={() => copyToClipboard(owner, setNotificationVisible)}>
                                            {formatAddress(owner)}
                                        </td>
                                        <td className="px-4 py-2 border-b border-blue-300 text-blue-800 text-lg">
                                            {grossProfit}
                                        </td>
                                        <td className="px-4 py-2 border-b border-blue-300 text-blue-800 text-lg">
                                            {netProfit}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
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
