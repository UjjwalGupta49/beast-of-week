import { useState } from 'react';
import { Input } from '@nextui-org/react';
import { Connection, VersionedTransactionResponse } from "@solana/web3.js";


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

const BackupOracle = () => {
    const [transactionId, setTransactionId] = useState('');
    const [timestamp, setTimestamp] = useState('');

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
            } else {
                setTimestamp("No transaction details found.");
            }
        } catch (error) {
            console.error("Error fetching timestamp:", error);
            setTimestamp("Error fetching timestamp.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white shadow-md rounded-lg">
                <h1 className="text-2xl font-bold mb-4 text-black">Backup Oracle Timestamp</h1>
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
                    Fetch Timestamp
                </button>
                {timestamp && (
                    <div className="mt-4 p-4 bg-gray-200 rounded-md">
                        <p className="text-lg text-black">Timestamp:</p>
                        <p className="text-xl font-mono text-black">{timestamp}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BackupOracle;
