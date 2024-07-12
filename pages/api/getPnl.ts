import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface TradingHistoryQuery {
    from: string;
    to: string;
    marketId?: string | null;
}

interface Trade {
    owner: string;
    pnlUsd: string | null;
}

const fetchTradingHistory = async (from: number, to: number, marketId?: string | null) => {
    let queryParams = `to=${to}&from=${from}&eventTypes=TAKE_PROFIT&eventTypes=CLOSE_POSITION&eventTypes=STOP_LOSS&eventTypes=LIQUIDATE`;
    const url = `https://api.prod.flash.trade/trading-history/filter?${queryParams}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching trading history:', error);
        throw error;
    }
};
const sortPnlByOwner = (pnlByOwner: Record<string, number>): Record<string, number> => {
    const sortedPnls = Object.entries(pnlByOwner)
        .sort(([, a], [, b]) => b - a)  // Descending sort based on PNL values
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, number>);

    return sortedPnls;
};

const calculateCumulativePnls = (trades: Trade[]) => {
    const pnlByOwner: Record<string, number> = {};
    for (const trade of trades) {
        if (trade.pnlUsd !== null) {
            const pnl = parseFloat(trade.pnlUsd);
            if (!isNaN(pnl)) {
                pnlByOwner[trade.owner] = (pnlByOwner[trade.owner] || 0) + pnl;
            }
        }
    }

    for (const owner in pnlByOwner) {
        pnlByOwner[owner] *= 10 ** -6;
    }

    return pnlByOwner;
};

const handler = async (
    req: NextApiRequest & { query: TradingHistoryQuery },
    res: NextApiResponse,
) => {
    const { from, to, marketId } = req.query;

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
        const trades = await fetchTradingHistory(fromTimestamp, toTimestamp, marketId);
        let filteredTrades = trades;
        if (marketId) {
            filteredTrades = trades.filter((trade: any) => trade.market === marketId);
        }

        const pnlByOwner = calculateCumulativePnls(filteredTrades);
        const sortedPnlByOwner = sortPnlByOwner(pnlByOwner);

        res.status(200).json(sortedPnlByOwner);

    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: 'Failed to fetch trading history' });
    }
};

export default handler;
