import { useState, useEffect } from 'react';
import { Input, Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/react';
import { Connection, VersionedTransactionResponse } from "@solana/web3.js";
import { getCpiEventsFromTransaction } from 'flash-sdk';

// Function to convert Uint8Array to hex string
const byteArrayToHexString = (bytes: Uint8Array): string => {
    return Array.prototype.map.call(bytes, (byte: number) => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

// Function to convert hex string to byte array
const hexStringToByteArray = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// Function to convert byte array to a 64-bit little-endian unsigned integer
const byteArrayToUint64LE = (bytes: Uint8Array): number => {
    let value = 0;
    for (let i = 0; i < 8; i++) {
        value += bytes[i] * Math.pow(2, 8 * i);
    }
    return value;
}

// Function to convert Unix timestamp to readable time
const unixTimestampToReadableTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000); // Convert to milliseconds
    return date.toUTCString();
}

// Function to convert hex to decimal and scale if needed
const hexToDecimal = (hex: string, scale: number = 1): string => {
    const decimalValue = parseInt(hex, 16);
    return (decimalValue * scale).toString();
}

const BackupOracle = () => {
    const [transactionId, setTransactionId] = useState('');
    const [timestamp, setTimestamp] = useState('');
    const [solanaTimestamp, setSolanaTimestamp] = useState<number | null>(null);
    const [trxBlockTime, setTrxBlockTime] = useState<number | null>(null);
    const [timeDifferenceTrx, setTimeDifferenceTrx] = useState<number | null>(null);
    const [events, setEvents] = useState<any[]>([]);

    const handleFetchTimestamp = async () => {
        const url = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://flashtr-flash-885f.mainnet.rpcpool.com/11a75a74-fd8e-44cc-87f4-d84bb82d0983';
        try {
            const connection = new Connection(url, { commitment: 'confirmed' });
            const transactionDetails: VersionedTransactionResponse | null = await connection.getTransaction(
                transactionId,
                { maxSupportedTransactionVersion: 0, commitment: "confirmed" }
            );

            if (transactionDetails && transactionDetails.transaction.message.compiledInstructions.length > 0) {
                const bufferData = transactionDetails.transaction.message.compiledInstructions[0].data;
                const hexString = byteArrayToHexString(new Uint8Array(bufferData));
                const dataBytes = hexStringToByteArray(hexString);
                const last8Bytes = dataBytes.slice(-8);
                const timestamp = byteArrayToUint64LE(last8Bytes);
                const readableTime = unixTimestampToReadableTime(timestamp);

                setTimestamp(readableTime);

                // Fetching CPI events
                const events = await getCpiEventsFromTransaction(transactionDetails);
                setEvents(events);

                // Set transaction block time and calculate time difference with transaction timestamp
                if (transactionDetails.blockTime) {
                    setTrxBlockTime(transactionDetails.blockTime);
                    setTimeDifferenceTrx(transactionDetails.blockTime - timestamp);
                } else {
                    setTrxBlockTime(null);
                    setTimeDifferenceTrx(null);
                }

                // Fetch Solana block time and calculate the difference
                const slot = await connection.getSlot();
                const blockTime = await connection.getBlockTime(slot);

                if (blockTime !== null) {
                    setSolanaTimestamp(blockTime);
                } else {
                    console.log('Failed to fetch block time');
                }

            } else {
                setTimestamp("No transaction details found.");
                setEvents([]);
                setSolanaTimestamp(null);
                setTrxBlockTime(null);
                setTimeDifferenceTrx(null);
            }
        } catch (error) {
            console.error("Error fetching timestamp:", error);
            setTimestamp("Error fetching timestamp.");
            setEvents([]);
            setSolanaTimestamp(null);
            setTrxBlockTime(null);
            setTimeDifferenceTrx(null);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 pt-4">
            <div className="w-full max-w-md p-8 bg-white shadow-md rounded-lg">
                <h1 className="text-2xl font-bold mb-4 text-black">Backup Oracle Details</h1>
                <div className="flex flex-col gap-4 mb-4">
                    <Input
                        type="text"
                        label="Transaction ID"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="w-full"
                    />
                </div>
                <button
                    onClick={handleFetchTimestamp}
                    className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                >
                    Fetch Timestamp & CPI events
                </button>
                {timestamp && (
                    <div className="mt-4 p-4 bg-gray-200 rounded-md">
                        <p className="text-lg text-black">Timestamp:</p>
                        <p className="text-xl font-mono text-black">{timestamp}</p>
                    </div>
                )}
                {solanaTimestamp !== null && (
                    <div className="mt-4 p-4 bg-gray-200 rounded-md">
                        <p className="text-lg text-black">Solana UNIX Timestamp:</p>
                        <p className="text-xl font-mono text-black">{(solanaTimestamp)}</p>
                    </div>
                )}
                {trxBlockTime !== null && (
                    <div className="mt-4 p-4 bg-gray-200 rounded-md">
                        <p className="text-lg text-black">Transaction Block Time:</p>
                        <p className="text-xl font-mono text-black">{unixTimestampToReadableTime(trxBlockTime)}</p>
                    </div>
                )}
                {timeDifferenceTrx !== null && (
                    <div className="mt-4 p-4 bg-gray-200 rounded-md">
                        <p className="text-lg text-black">Time Difference (seconds):</p>
                        <p className="text-xl font-mono text-black">{timeDifferenceTrx}</p>
                    </div>
                )}
            </div>
            {events.length > 0 && (
                <div className="mt-8 w-full max-w-3xl">
                    {events.map((event, index) => (
                        <Card key={index} className="mb-4 shadow-lg">
                            <CardBody>
                                <p className="text-sm text-gray-600 p-2">
                                    {event.name} Details:
                                </p>
                                <Table aria-label={`${event.name} Table`}>
                                    <TableHeader>
                                        <TableColumn>Field</TableColumn>
                                        <TableColumn>Value</TableColumn>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(event.data).map(([key, value]) => (
                                            <TableRow key={key}>
                                                <TableCell>{key}</TableCell>
                                                <TableCell>
                                                    {key === 'priceUsd' || key === 'sizeUsd' || key === 'collateralUsd'
                                                        ? hexToDecimal(value as string, 10 ** -6)
                                                        : key === 'amountIn' || key === 'amountOut' || key === 'custodyIdIn' || key === 'custodyIdOut'
                                                            ? hexToDecimal(value as string)
                                                            : key.endsWith('Usd') || key.endsWith('Amount')
                                                                ? hexToDecimal(value as string)
                                                                : JSON.stringify(value)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BackupOracle;
