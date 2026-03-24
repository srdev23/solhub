import { web3 } from "@project-serum/anchor";
import { BaseMpl } from "../base/baseMpl";
import { BaseRay } from "../base/baseRay";
import { toast } from 'react-toastify';
import { AddLiquidityInput, CreateMarketInput, CreateRaydiumPoolInput, CreateTokenInput, CreateTaxTokenInput, UpdateTokenInput, MintTokenInput, RFTokenInput, RemoveLiquidityInput, SwapInput, CreateMeteoraPoolInput } from "./types";
import { Metadata, TokenStandard, PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { NATIVE_MINT, createAssociatedTokenAccountInstruction, createCloseAccountInstruction, getAssociatedTokenAddressSync, createMintToCheckedInstruction, getMint, createInitializePermanentDelegateInstruction } from '@solana/spl-token'
import { Keypair, PublicKey, Transaction, Connection, SystemProgram } from '@solana/web3.js';
import type { TokenMetadata } from '@solana/spl-token-metadata';
import {
    ExtensionType,
    createInitializeMintInstruction,
    getMintLen,
    TOKEN_2022_PROGRAM_ID,
    createInitializeTransferFeeConfigInstruction,
    createInitializeMetadataPointerInstruction,
    createMintToInstruction,
    LENGTH_SIZE,
    TYPE_SIZE,
    AccountState,
    createInitializeDefaultAccountStateInstruction,
    createInitializeNonTransferableMintInstruction
} from '@solana/spl-token';

import {
    createInitializeInstruction,
    pack,
} from '@solana/spl-token-metadata';

import { ADD_LIQUIDITY_FEE, CREATE_MARKET_FEE, FEE_WALLET, REMOVE_LIQUIDITY_FEE, MINT_FEE, CREATE_POOL_FEE } from "./constant";
import { solanaConnection, devConnection } from "./utils";

const log = console.log;
const toastError = (str: string) => {
    toast.error(str, {
      position: "top-center"
    });
  }

// const data = JSON.parse(fs.readFileSync("./data.json", `utf8`))
// const PRIVATE_KEY = data.privKey
// const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
const COMPUTE_UNIT_PRICE = 1_800_000 // default: 200_000

export async function createToken(input: CreateTokenInput) {
    try {
        const { decimals, name, symbol, url, initialMintingAmount, metaUri, mintRevokeAuthorities, freezeRevokeAuthorities, mutable, wallet } = input;
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })
        const res = await baseMpl.createToken({
            name,
            uri: metaUri,
            symbol,
            sellerFeeBasisPoints: 0,
            isMutable: !mutable,
            tokenStandard: TokenStandard.Fungible,
            creators: [{ address: wallet.publicKey, share: 100 }]
        }, {
            decimal: decimals,
            mintAmount: initialMintingAmount ?? 0,
            mintRevokeAuthorities,
            freezeRevokeAuthorities,
        })
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function createTaxToken(input: CreateTaxTokenInput) {
    try {
        const { name, symbol, decimals, url, metaUri, initialMintingAmount, feeRate, maxFee, authWallet, withdrawWallet, useExtenstion, permanentWallet, defaultAccountState, bearingRate, transferable, wallet } = input;
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint;

        console.log("input=========>>>", input);

        // Initialize connection to local Solana node
        const connection = new Connection(endpoint, 'confirmed');


        // Generate keys for payer, mint authority, and mint
        const payer = wallet;
        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;

        // Generate keys for transfer fee config authority and withdrawal authority
        const transferFeeConfigAuthority = authWallet;
        const withdrawWithheldAuthority = withdrawWallet;

        // Define the extensions to be used by the mint
        const extensions = [
            ExtensionType.TransferFeeConfig,
            ExtensionType.MetadataPointer
        ];

        if (useExtenstion) {
            if (permanentWallet) {
                extensions.push(ExtensionType.PermanentDelegate)
            }
            extensions.push(ExtensionType.DefaultAccountState)
        }

        if (transferable) {
            extensions.push(ExtensionType.NonTransferable)
        }

        // Calculate the length of the mint
        const mintLen = getMintLen(extensions);
        console.log("mintLen====?>>>", mintLen);

        // Set the decimals, fee basis points, and maximum fee
        const feeBasisPoints = 100 * feeRate; // 1%
        const maxFees = BigInt(maxFee * Math.pow(10, decimals)); // 9 tokens

        // Define the amount to be minted and the amount to be transferred, accounting for decimals
        const mintAmount = BigInt(initialMintingAmount * Math.pow(10, decimals)); // Mint 1,000,000 tokens

        const metadata: TokenMetadata = {
            mint: mint,
            name: name,
            symbol: symbol,
            uri: metaUri,
            additionalMetadata: []
        };

        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

        // Step 2 - Create a New Token
        const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

        const mintTransaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint,
                space: mintLen,
                lamports: mintLamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeMetadataPointerInstruction(
                mint,
                payer.publicKey,
                mint,
                TOKEN_2022_PROGRAM_ID
            ),
            createInitializeTransferFeeConfigInstruction(
                mint,
                transferFeeConfigAuthority,
                withdrawWithheldAuthority,
                feeBasisPoints,
                maxFees,
                TOKEN_2022_PROGRAM_ID
            )
        );


        if (useExtenstion) {

            if (permanentWallet) {
                mintTransaction.add(
                    createInitializePermanentDelegateInstruction(
                        mint,
                        permanentWallet,
                        TOKEN_2022_PROGRAM_ID
                    )
                )
            }

            const defaultState = AccountState.Initialized;
            mintTransaction.add(
                createInitializeDefaultAccountStateInstruction(mint, defaultState, TOKEN_2022_PROGRAM_ID),
            )

        }

        // if (bearingRate) {
        //     mintTransaction.add(
        //         // add a custom field
        //         createUpdateFieldInstruction({
        //             metadata: mint,
        //             updateAuthority: payer.publicKey,
        //             programId: TOKEN_2022_PROGRAM_ID,
        //             field: 'bearingRate',
        //             value: bearingRate.toString(),
        //         }),
        //     )
        // }

        if (transferable) {
            mintTransaction.add(
                createInitializeNonTransferableMintInstruction(mint, TOKEN_2022_PROGRAM_ID)
            )
        }

        mintTransaction.add(
            createInitializeMintInstruction(mint, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
            createInitializeInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                mint: mint,
                metadata: mint,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                mintAuthority: payer.publicKey,
                updateAuthority: payer.publicKey
            })
        )

        const tokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

        mintTransaction.add(
            createAssociatedTokenAccountInstruction(payer.publicKey, tokenAccount, payer.publicKey, mint, TOKEN_2022_PROGRAM_ID),
            createMintToInstruction(
                mint, // mint
                tokenAccount, // receiver (should be a token account)
                payer.publicKey, // mint authority
                mintAmount, // amount. if your decimals is 8, you mint 10^8 for 1 token.
                [],
                TOKEN_2022_PROGRAM_ID
                // [signer1, signer2 ...], // only multisig account will use
            )
        )

        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        mintTransaction.recentBlockhash = recentBlockhash;
        mintTransaction.feePayer = wallet.publicKey;
        mintTransaction.sign(mintKeypair);

        const simRes = (await connection.simulateTransaction(mintTransaction)).value
        console.log('mintTransaction l', simRes)

        return {
            mint,
            mintTransaction
        }

    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function updateToken(input: UpdateTokenInput) {
    try {
        const { mint, name, symbol, url, metaUri, mintRevokeAuthorities, freezeRevokeAuthorities, mutable, wallet } = input;
        // const keyAuthI = Keypair.fromSecretKey(bs58.decode(keyAuth));
        // const wallet = new Wallet(keyAuthI)
        console.log("mutable---->>>>", mutable);
        const endpoint = url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint
        const baseMpl = new BaseMpl(wallet, { endpoint })
        const res = await baseMpl.getUpdateMetadataIx(
            mint,
            wallet.publicKey,
            {
                name,
                uri: metaUri,
                symbol,
                mintRevokeAuthorities,
                freezeRevokeAuthorities,
                isMutable: !mutable
            })
        return res;
    }
    catch (error) {
        log({ error })
        // return { Err: "failed to create the token" }
    }
}

export async function mintToken(input: MintTokenInput) {
    try {
        const { mint, url, mintingAmount, wallet } = input;

        // Choose the correct RPC endpoint based on the network (mainnet or devnet)
        const endpoint = url === 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint;

        // Get the mint account information
        const mintInfo = await getMint(solanaConnection, mint);

        // Check if the mint authority is revoked
        if (!mintInfo.mintAuthority) {
            // Display a toast error message
            toastError("Mint authority is revoked. Cannot mint tokens.");
            return; // Stop further execution
        }

        // Get the associated token account for the mint
        const tokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);

        // Calculate the minting amount based on the decimals
        const amount = mintingAmount * (10 ** mintInfo.decimals);

        // Create the minting instruction
        let tx = new web3.Transaction().add(
            createMintToCheckedInstruction(
                mint,            // mint
                tokenAccount,    // receiver (should be a token account)
                wallet.publicKey,// mint authority
                amount,          // amount. if your decimals is 8, you mint 10^8 for 1 token.
                mintInfo.decimals // decimals
            )
        );

        // Add a fee transfer instruction to the transaction
        const feeAmountLamports = MINT_FEE; // Replace with your method if you use a different fee calculation
        const feeIx = web3.SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new web3.PublicKey(FEE_WALLET),
            lamports: feeAmountLamports
        });

        // Add the fee instruction to the transaction
        tx.add(feeIx);

        // Set the recent blockhash and fee payer
        const blockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = blockhash;

        return tx; // Return the transaction ready to be signed and sent
    }
    catch (error) {
        console.error("Error creating mint token transaction:", error);
        if (error instanceof Error) {
            toastError("Failed to create the token minting transaction: " + error.message);
        } else {
            toastError("Failed to create the token minting transaction: An unknown error occurred.");
        }

    }
}




export async function removeFreezeAuth(input: RFTokenInput): Promise<web3.Transaction | null> {
    try {
        const { mint, url, wallet } = input;

        console.log("Starting removeFreezeAuth with:", mint.toString(), wallet.publicKey.toString());

        const endpoint = url === 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint;
        const baseMpl = new BaseMpl(wallet, { endpoint });

        // Get the mint account information
        const mintInfo = await getMint(solanaConnection, mint);

        // Check if the freeze authority is already revoked
        if (!mintInfo.freezeAuthority) {
            throw new Error("Freeze authority is already revoked.");
        }

        // Get the transaction instructions for revoking the freeze authority
        const tx = await baseMpl.getUpdateAuthorityIx(mint, {
            mintRevokeAuthorities: false,
            freezeRevokeAuthorities: true,
        }, wallet);

        if (!tx) {
            throw new Error("Failed to create the transaction for revoking freeze authority.");
        }
        return tx;
    } catch (error: any) {
        throw new Error(`${error.message || "Unknown error"}`);
    }
}



export async function removeMintAuth(input: RFTokenInput): Promise<Transaction | null> {
    try {
      const { mint, url, wallet } = input;
  
      console.log("Starting removeMintAuth with:", mint.toString(), wallet.publicKey.toString());
  
      const endpoint = url === 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint;
      const baseMpl = new BaseMpl(wallet, { endpoint });
  
      // Get the mint account information
      const mintInfo = await getMint(solanaConnection, mint);
  
      // Check if the mint authority is already revoked
      if (!mintInfo.mintAuthority) {
        throw new Error("Mint authority is already revoked.");
      }
  
      // Get the signed transaction from updateTokenAuthorities
      const signedTx = await baseMpl.getUpdateAuthorityIx(mint, {
        mintRevokeAuthorities: true,
        freezeRevokeAuthorities: false,
      }, wallet);
  
      if (!signedTx) {
        throw new Error("Failed to create the transaction for revoking mint authority.");
      }
  
      return signedTx;
    } catch (error: any) {
      throw new Error(`${error.message || "Unknown error"}`);
    }
  }
  
  





  export async function makeImmutableToken(input: any): Promise<Transaction | null> {
    try {
        const { mint, tokenMeta, url, wallet } = input;
        const connection = new Connection(url === 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint);
        const baseMpl = new BaseMpl(wallet, { endpoint: connection.rpcEndpoint });

        // Fetch the metadata account associated with the mint
        const [metadataPDA] = await PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );
        const metadataAccount = await connection.getAccountInfo(metadataPDA);

        if (!metadataAccount) {
            throw new Error("Metadata account not found.");
        }

        const metadata = Metadata.deserialize(metadataAccount.data)[0];

        // Check if the token is already immutable
        if (!metadata.isMutable) {
            throw new Error("This token is already immutable.");
        }

        // Proceed to create the transaction to make the token immutable
        const tx = await baseMpl.getUpdateMetadataIx(
            mint,
            wallet.publicKey,
            {
                name: tokenMeta.name,
                uri: tokenMeta.data.uri,
                symbol: tokenMeta.symbol,
                mintRevokeAuthorities: false,
                freezeRevokeAuthorities: false,
                mutable: false, // Make the token immutable
            }
        );

        if (!tx) {
            throw new Error("Failed to create the transaction for making the token immutable.");
        }

        return tx;
    } catch (error: any) {
        console.error("Error in makeImmutableToken:", error);
        throw new Error(`Failed to make the token immutable: ${error.message || "Unknown error"}`);
    }
}


export async function getRayPoolKeyInfo(poolId: PublicKey, url: string) {
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })

    return poolKeys;
}


export async function addLiquidity(input: AddLiquidityInput) {
    const { amount, amountSide, poolId, url, wallet } = input
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })

    if (!poolKeys) return;
    const amountInfo = await baseRay.computeAnotherAmount({ amount, fixedSide: amountSide, poolKeys, isRawAmount: false }).catch(computeAnotherAmountError => { log({ computeAnotherAmount: computeAnotherAmountError }); return null })
    if (!amountInfo) return;
    const { baseMintAmount, liquidity, quoteMintAmount, } = amountInfo
    const txInfo = await baseRay.addLiquidity({ baseMintAmount, fixedSide: amountSide, poolKeys, quoteMintAmount, user: wallet.publicKey }).catch(addLiquidityError => { log({ addLiquidityError }); return null })
    if (!txInfo) return;
    const { ixs } = txInfo

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const feeIx = web3.SystemProgram.transfer({fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET, lamports: ADD_LIQUIDITY_FEE})
    const tx = new web3.Transaction().add(updateCuIx, ...ixs, feeIx)
    tx.feePayer = wallet.publicKey
    tx.recentBlockhash = recentBlockhash
    // tx.sign(keypair)

    return tx;
}


export async function removeLiquidity(input: RemoveLiquidityInput) {
    const { amount, poolId, url, wallet } = input
    const user = wallet.publicKey
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const poolKeys = await baseRay.getPoolKeys(poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })
    if (!poolKeys) return;
    const txInfo = await baseRay.removeLiquidity({ amount, poolKeys, user }).catch(removeLiquidityError => { log({ removeLiquidityError }); return null })
    if (!txInfo) return;
    if (txInfo.Err) return;
    if (!txInfo.Ok) return;
    const ixs = txInfo.Ok.ixs
    const userSolAta = getAssociatedTokenAddressSync(NATIVE_MINT, user)
    if (input.unwrapSol) ixs.push(createCloseAccountInstruction(userSolAta, user, user))

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE * 3 })
    const feeIx = web3.SystemProgram.transfer({fromPubkey: user, toPubkey: FEE_WALLET, lamports: REMOVE_LIQUIDITY_FEE})
    const tx = new web3.Transaction().add(updateCuIx, ...ixs, feeIx)
    tx.feePayer = wallet.publicKey
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.recentBlockhash = recentBlockhash
    // tx.sign(keypair)

    const simRes = (await connection.simulateTransaction(tx)).value
    console.log('remove l', simRes)
    console.log("sending remove liq tx")
    return tx;
}

export async function createMarket(input: CreateMarketInput) {
    const { baseMint, orderSize, priceTick, quoteMint, url, wallet, eventLength, requestLength, orderBookLength } = input

    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    log('preTxInfo...')
    const preTxInfo = await baseRay.createMarket({ baseMint, quoteMint, eventLength, requestLength, orderBookLength, tickers: { lotSize: orderSize, tickSize: priceTick } }, wallet.publicKey).catch(createMarketError => { return null })
    log('preTxInfo done')
    if (!preTxInfo) {
        return;
        // return { Err: "Failed to prepare market creation transaction" }
    }
    if (preTxInfo.Err) {
        log(preTxInfo.Err)
        // return { Err: preTxInfo.Err }
        return;
    }
    // if (!preTxInfo.Ok) return { Err: "failed to prepare tx" }
    if (!preTxInfo.Ok) return;
    const { marketId } = preTxInfo.Ok
    log('marketId', marketId)
    try {
        console.log("preparing create market")
        const payer = wallet.publicKey
        const info = preTxInfo.Ok
        // speedup
        const updateCuIx1 = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
        const recentBlockhash1 = (await connection.getLatestBlockhash()).blockhash;
        const tx1 = new web3.Transaction().add(updateCuIx1, ...info.vaultInstructions)
        tx1.feePayer = wallet.publicKey
        tx1.recentBlockhash = recentBlockhash1
        tx1.sign(...info.vaultSigners);

        const updateCuIx2 = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
        const updateUnitLimit = web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 })
        const recentBlockhash2 = (await connection.getLatestBlockhash()).blockhash;
        const feeIx = web3.SystemProgram.transfer({fromPubkey: payer, toPubkey: FEE_WALLET, lamports: CREATE_MARKET_FEE})
        const tx2 = new web3.Transaction().add(updateUnitLimit, updateCuIx2, ...info.marketInstructions, feeIx)
        tx2.feePayer = wallet.publicKey
        tx2.recentBlockhash = recentBlockhash2
        tx2.sign(...info.marketSigners);

        const recentBlockhash3 = (await connection.getLatestBlockhash()).blockhash;
        const tx3 = new web3.Transaction().add(...info.dexCreateInstructions)
        tx3.feePayer = wallet.publicKey
        tx3.recentBlockhash = recentBlockhash3
        tx2.sign(...info.marketSigners);

        const simRes = (await connection.simulateTransaction(tx3)).value;

        console.log("sumRes===>>>", simRes);

        const res = {
            marketId: marketId.toBase58(),
            tx1,
            tx2,
            tx3
        }
        return res
    } catch (error) {
        log({ error })
        // return { Err: "failed to send the transaction" }
    }
}

export async function createRaydiumAmmPool(input: CreateRaydiumPoolInput) {
    let { baseMintAmount, quoteMintAmount, marketId, url, wallet, launchTime } = input
    const connection = new web3.Connection(url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint)
    console.log("marketId=======>>>>", marketId.toBase58());
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const marketState = await baseRay.getMarketInfo(marketId).catch((getMarketInfoError) => { log({ getMarketInfoError }); return null })
    // log({marketState})
    if (!marketState) {
        // return { Err: "market not found" }
        return;
    }
    console.log("marketState====>>", marketState);
    const { baseMint, quoteMint } = marketState;
    // log({
    //     baseToken: baseMint.toBase58(),
    //     quoteToken: quoteMint.toBase58(),
    // })
    const txInfo = await baseRay.createPool({ baseMint, quoteMint, marketId, baseMintAmount, quoteMintAmount, launchTime }, wallet.publicKey).catch((innerCreatePoolError) => { log({ innerCreatePoolError }); return null })
    if (!txInfo) {
        // return { Err: "Failed to prepare create pool transaction" }
        return;
    }

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    // const txMsg = new web3.TransactionMessage({
    //     instructions: [updateCuIx, ...txInfo.ixs],
    //     payerKey: wallet.publicKey,
    //     recentBlockhash,
    // }).compileToV0Message()
    const feeIx = web3.SystemProgram.transfer({fromPubkey: wallet.publicKey, toPubkey: FEE_WALLET, lamports: CREATE_MARKET_FEE})
    const tx = new web3.Transaction().add(updateCuIx, ...txInfo.ixs, feeIx)
    tx.feePayer = wallet.publicKey
    tx.recentBlockhash = recentBlockhash
    console.log("PoolId: ", txInfo.poolId.toBase58())
    console.log("SENDING CREATE POOL TX")
   
    const result = {
        poolId: txInfo.poolId.toBase58(),
        tx,
        baseAmount: txInfo.baseAmount,
        quoteAmount: txInfo.quoteAmount,
        baseDecimals: txInfo.baseDecimals,
        quoteDecimals: txInfo.quoteDecimals,
    }

    log(result)

    return result
}