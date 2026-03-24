import fs from 'fs';
import { web3 } from "@project-serum/anchor"
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes"
import { Percent } from "@raydium-io/raydium-sdk"
import { AddressLookupTableProgram, ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, VersionedTransaction, TransactionMessage, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Metaplex, amount } from "@metaplex-foundation/js";
import { TOKEN_PROGRAM_ID, getMint, getTokenMetadata } from "@solana/spl-token";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";

import axios from "axios";
export const METAPLEX = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const metadataCache = new Map();
const cacheExpirationTime = 300000; // Cache expiration time in milliseconds (e.g., 1 minute)

import { DEV_RPC, MAIN_RPC } from "./constant"
import { TokenMetadata } from '@solana/spl-token-metadata';


  

export const connection = new Connection(MAIN_RPC);
export const solanaConnection = new Connection(MAIN_RPC);
export const devConnection = new Connection(MAIN_RPC); // All connections use MAIN_RPC now
const log = console.log;

export const sendMultiTx = async (ixs: TransactionInstruction[], wallet: Keypair): Promise<string> => {
    try {
        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
            ...ixs
        );
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], { skipPreflight: true });
        console.log('Transaction successful with signature:', signature);
        return signature;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
};

export const sendSingleTx = async (ixs: TransactionInstruction[], wallet: Keypair): Promise<string> => {
    try {
        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
            ...ixs
        );
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], { skipPreflight: true });
        console.log('Transaction successful with signature:', signature);
        return signature;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
};

export const saveDataToFile = (newData: string[], filePath: string) => {
    try {
        let existingData: string[] = [];

        // Check if the file exists
        if (fs.existsSync(filePath)) {
            // If the file exists, read its content
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
        }

        // Add the new data to the existing array
        existingData.push(...newData);

        // Write the updated data back to the file
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    } catch (error) {
        console.log('Error saving data to JSON file:', error);
    }
};

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function calcDecimalValue(value: number, decimals: number): number {
    return value / (Math.pow(10, decimals))
}

export async function sendAndConfirmTX(tx: web3.VersionedTransaction | web3.Transaction, connection: web3.Connection) {
    const rawTx = tx.serialize()
    const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(Uint8Array.from(rawTx)), { commitment: 'confirmed', maxRetries: 4 })
        .catch(async () => {
            await sleep(500)
            return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(Uint8Array.from(rawTx)), { commitment: 'confirmed' })
                .catch((txError) => {
                    log({ txError })
                    return null
                })
        }))
    return txSignature
}

export async function getMetadata(mint: PublicKey): Promise<PublicKey> {
    const [metadataAddress] = await PublicKey.findProgramAddress(
        [
            Buffer.from('metadata'),
            METAPLEX.toBuffer(),
            mint.toBuffer(),
        ],
        METAPLEX
    );
    return metadataAddress;
}

export async function fetchTokenMetadata(mintToken: string) {
    const mintAddress = new PublicKey(mintToken);

    // Check cache first
    const cachedData = metadataCache.get(mintAddress.toString());
    if (cachedData) {
        const isCacheValid = Date.now() - cachedData.timestamp < cacheExpirationTime;
        if (isCacheValid) {
            console.log(`Cache hit for ${mintAddress.toString()} (valid)`);
            return cachedData.data;
        } else {
            console.log(`Cache expired for ${mintAddress.toString()}`);
            metadataCache.delete(mintAddress.toString());
        }
    } else {
        console.log(`Cache miss for ${mintAddress.toString()}`);
    }

    const metaplex = Metaplex.make(solanaConnection);
    const metadataAccount = metaplex.nfts().pdas().metadata({ mint: mintAddress });
    const metadataAccountInfo = await solanaConnection.getAccountInfo(metadataAccount);

    if (metadataAccountInfo) {
        const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
        let imageData = null;

        if (token.json?.image) {
            imageData = await fetch(token.json.image).then(res => res.json()).catch(() => null);
        }

        const tokenData = {
            tokenName: token.name,
            tokenSymbol: token.symbol,
            tokenLogo: imageData?.image || null,
        };

        // Cache the result with timestamp
        metadataCache.set(mintAddress.toString(), { data: tokenData, timestamp: Date.now() });
        return tokenData;
    }

    return {
        tokenName: null,
        tokenSymbol: null,
        tokenLogo: null,
    };
}


let previousTokenAccounts: string[] = []; // Stores the previously fetched token accounts

export async function getTokenList(address: PublicKey) {
    const tokenList = await solanaConnection.getTokenAccountsByOwner(address, {
        programId: TOKEN_PROGRAM_ID,
    });

    if (tokenList.value.length === 0) return [];

    const currentTokenAccounts = tokenList.value.map(item => item.pubkey.toBase58());

    // Check if there are any new tokens compared to the previous fetch
    const isNewTokenAdded = currentTokenAccounts.some(account => !previousTokenAccounts.includes(account));

    if (isNewTokenAdded || previousTokenAccounts.length === 0) {
        // If a new token is added or this is the first fetch, update the cache
        previousTokenAccounts = currentTokenAccounts;

        const fetchMetadataPromises = tokenList.value.map(async (item) => {
            const tokenAccountInfo = await solanaConnection.getParsedAccountInfo(item.pubkey);

            // Check if the account info is parsed
            if (tokenAccountInfo.value && 'parsed' in tokenAccountInfo.value.data) {
                const mintAddress = new PublicKey(tokenAccountInfo.value.data.parsed.info.mint);
                const meta = await getMetadata(mintAddress);

                try {
                    const metadadataContent = await Metadata.fromAccountAddress(solanaConnection, meta);
                    const detail = await axios.get(metadadataContent.pretty().data.uri);
                    return {
                        tokenName: detail.data.name,
                        ...metadadataContent.pretty(),
                        ...detail.data,
                        amount: tokenAccountInfo.value.data.parsed.info.tokenAmount.uiAmount,
                    };
                } catch (error) {
                    console.log('Error fetching metadata:', error);
                    return null; // Handle errors gracefully
                }
            } else {
                console.log('Token account info is not parsed:', tokenAccountInfo);
                return null; // Handle unparsed accounts
            }
        });

        const data = await Promise.all(fetchMetadataPromises);
        const filteredData = data.filter(item => item !== null); // Filter out any null responses
        // Always include native Solana at the top
        const solBalance = await solanaConnection.getBalance(address);
        const nativeSolToken = {
            tokenName: 'Solana',
            mint: 'So11111111111111111111111111111111111111112',
            tokenSymbol: 'SOL',
            image: 'https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67',
            amount: solBalance / LAMPORTS_PER_SOL,
        };
        filteredData.unshift(nativeSolToken);


        // Update the cache with the new token data
        filteredData.forEach(tokenData => {
            metadataCache.set(tokenData.mint, tokenData);
        });

        return filteredData;
    } else {
        // Return cached data if no new tokens are detected
        return Array.from(metadataCache.values());
    }
}


export function refreshTokenListCache() {
    previousTokenAccounts = []; // Resetting previous accounts will force cache refresh on next fetch
    metadataCache.clear(); // Optionally clear the cache to ensure full refresh
}

export const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...' + text.substring(text.length - maxLength, text.length);
    }
    return text;
}

export const createLAT = async (wallet: any, inst: any, ) => {

    // const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    //     authority: wallet.publicKey,
    //     payer: wallet.publicKey,
    //     recentSlot: await solanaConnection.getSlot(),
    // });

    // const addAddressesInstruction = AddressLookupTableProgram.extendLookupTable({
    //     payer: wallet.publicKey,
    //     authority: wallet.publicKey,
    //     lookupTable: lookupTableAddress,
    //     // addresses: ,

    // });
    
    // const messageV0 = new TransactionMessage({
    //     payerKey: wallet.publicKey,
    //     instructions: [lookupTableInst],
    //     recentBlockhash: (await solanaConnection.getLatestBlockhash()).blockhash
    // }).compileToV0Message();

    // const fullTX = new VersionedTransaction(messageV0);
    // return fullTX;
}

