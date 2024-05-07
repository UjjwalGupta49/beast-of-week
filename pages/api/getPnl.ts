import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface TradingHistoryQuery {
    from: string;
    to: string;
}

interface Trade {
    owner: string;
    pnlUsd: string | null;
}

const fetchTradingHistory = async (from: number, to: number) => {
    const url = `https://api.prod.flash.trade/trading-history/filter?to=${to}&from=${from}&eventTypes=TAKE_PROFIT&eventTypes=CLOSE_POSITION&eventTypes=STOP_LOSS&eventTypes=LIQUIDATE`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching trading history:', error);
        throw error;
    }
};

const calculateCumulativePnls = (trades: Trade[]) => {
    const pnlByOwner: Record<string, number> = {};
    
    // Calculate the cumulative PnLs for each owner
    for (const trade of trades) {
        if (trade.pnlUsd !== null) {
            const pnl = parseFloat(trade.pnlUsd);
            if (!isNaN(pnl)) {
                pnlByOwner[trade.owner] = (pnlByOwner[trade.owner] || 0) + pnl;
            }
        }
    }

    // Multiply the cumulative PnLs by 10^-6 for each owner
    for (const owner in pnlByOwner) {
        pnlByOwner[owner] *= 10 ** -6;
    }

    // Convert the object to an array of entries [owner, pnl] and sort it in descending order
    const sortedPnls = Object.entries(pnlByOwner).sort(([, a], [, b]) => b - a);

    // Convert back to an object
    const sortedPnlByOwner = Object.fromEntries(sortedPnls);
    
    return sortedPnlByOwner;
};


const handler = async (
    req: NextApiRequest & { query: TradingHistoryQuery },
    res: NextApiResponse,
) => {
    const { from, to } = req.query;

    if (typeof from !== 'string' || typeof to !== 'string') {
        res.status(400).json({ error: 'Invalid or missing query parameters' });
        return;
    }

    try {
        const fromTimestamp = parseInt(from, 10);
        const toTimestamp = parseInt(to, 10);

        if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
            throw new Error("Invalid timestamps");
        }

        const trades = await fetchTradingHistory(fromTimestamp, toTimestamp);
        const pnlByOwner = calculateCumulativePnls(trades);
        res.status(200).json(pnlByOwner);
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: 'Failed to fetch trading history' });
    }
};

export default handler;
