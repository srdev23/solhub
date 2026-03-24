import {
  AddressLookupTableAccount,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import DLMM, { IDL, LBCLMM_PROGRAM_IDS } from "@meteora-ag/dlmm";
import { AnchorProvider, BN, Program } from "@project-serum/anchor";
import { solanaConnection } from "@/lib/utils";
import { createLut } from "../createLut";
import { JitoAccounts, JitoBundleService } from "../jito/jito";
import { extendLut } from "./extendLut";
import { getSignature, sleep } from "../utils";
import { BUNDLER_FEE, FEE_WALLET, VOLUME_FEE } from "@/lib/constant";

export type MeteoraDlmmParam = {
  dlmmPool: DLMM;
  binArraysPubkey: any[];
  inLamports: BN;
  mintOutLamports: BN;
  outLamports: BN;
};

type MeteVolumeParams = {
  data: {
    lbPair: any,
    lookupTableAccount: AddressLookupTableAccount
  },
  keypairs: Keypair[];
  mint: PublicKey;
  amount: number;
  tip: number;
};

export const meteoraDlmmCheck = async (
  swapParam: any
): Promise<MeteoraDlmmParam | null> => {
  try {
    const { mint, amount, slippage, is_buy } = swapParam;

    const inLamports = is_buy
      ? new BN(amount * LAMPORTS_PER_SOL)
      : new BN(
          amount * 10 ** (await spl.getMint(solanaConnection, mint)).decimals
        );

    //start building transaction
    const lbPair = await getMeteoraDlmmPool(mint);
    const dlmmPool = await DLMM.create(solanaConnection, lbPair.publicKey);

    
    // Swap quote
    const swapY2X = spl.NATIVE_MINT.equals(lbPair.account.tokenYMint)
      ? is_buy
      : !is_buy;
    const binArrays = await dlmmPool.getBinArrayForSwap(swapY2X);
    const swapQuote = dlmmPool.swapQuote(
      inLamports,
      swapY2X,
      new BN(slippage * 100),
      binArrays
    );

    return {
      dlmmPool,
      binArraysPubkey: swapQuote.binArraysPubkey,
      inLamports,
      mintOutLamports: swapQuote.minOutAmount,
      outLamports: swapQuote.outAmount,
    };
  } catch (error) {
    return null;
  }
};

async function getLbPairsForTokens(mint: PublicKey) {
  const provider = new AnchorProvider(
    solanaConnection,
    {} as any,
    AnchorProvider.defaultOptions()
  );
  const program = new Program(
    IDL,
    LBCLMM_PROGRAM_IDS["mainnet-beta"],
    provider
  );

  const [poolsForTokenAMint, poolsForTokenBMint] = await Promise.all([
    program.account.lbPair.all([
      {
        memcmp: {
          offset: 88,
          bytes: mint.toBase58(),
        },
      },
      {
        memcmp: {
          offset: 120,
          bytes: spl.NATIVE_MINT.toBase58(),
        },
      },
    ]),
    program.account.lbPair.all([
      {
        memcmp: {
          offset: 88,
          bytes: spl.NATIVE_MINT.toBase58(),
        },
      },
      {
        memcmp: {
          offset: 120,
          bytes: mint.toBase58(),
        },
      },
    ]),
  ]);

  return [...poolsForTokenAMint, ...poolsForTokenBMint];
}

export const getMeteoraDlmmPool = async (mint: PublicKey) => {
  const lbPairs = await getLbPairsForTokens(mint);
  if (lbPairs.length === 0) {
    throw new Error("No LB pair found for token");
  }
  const tokenAmounts = await Promise.all(
    lbPairs.map((lbPair) =>
      solanaConnection.getTokenAccountBalance(
        lbPair.account.tokenXMint.toBase58() === spl.NATIVE_MINT.toBase58()
          ? lbPair.account.reserveX
          : lbPair.account.reserveY
      )
    )
  );

  const maxIndex = tokenAmounts.reduce((maxIdx, current, idx, arr) => {
    const currentValue = current.value.uiAmount;
    const maxValue = arr[maxIdx].value.uiAmount;

    if (currentValue === null) return maxIdx;
    if (maxValue === null || currentValue > maxValue) return idx;

    return maxIdx;
  }, 0);
  console.log("- Meteora DLMM:", lbPairs[maxIndex].publicKey.toBase58());

  return lbPairs[maxIndex];
};

export const meteoraDlmmSwapTxn = async (
  swapParam: any,
) => {
  const { wallet, mint, amount } = swapParam;

  const inLamports = new BN(amount * LAMPORTS_PER_SOL);
  const slippage = new BN(100 * 100);
  //start building transaction
  const lbPair = await getMeteoraDlmmPool(mint);
  const dlmmPool = await DLMM.create(solanaConnection, lbPair.publicKey);

  // Swap quote
  const swapY2X = spl.NATIVE_MINT.equals(lbPair.account.tokenYMint)
    ? true
    : false;
  const swapX2Y = !swapY2X;
  const buyBinArrays = await dlmmPool.getBinArrayForSwap(swapY2X);
  const sellBinArrays = await dlmmPool.getBinArrayForSwap(swapX2Y);

  const buySwapQuote = dlmmPool.swapQuote(
    inLamports,
    swapY2X,
    slippage,
    buyBinArrays
  );
  const buySwapQuoteOut = dlmmPool.swapQuoteExactOut(
    buySwapQuote.outAmount,
    swapY2X,
    slippage,
    buyBinArrays
  );

  const sellSwapQuote = dlmmPool.swapQuote(
    buySwapQuoteOut.outAmount,
    swapX2Y,
    slippage,
    sellBinArrays
  );

  // Buy Swap
  const buyTxn = await dlmmPool.swapExactOut({
    inToken: spl.NATIVE_MINT,
    binArraysPubkey: buySwapQuoteOut.binArraysPubkey,
    outAmount: buySwapQuoteOut.outAmount,
    lbPair: dlmmPool.pubkey,
    user: wallet,
    maxInAmount: buySwapQuoteOut.maxInAmount,
    outToken: mint,
  });

  // Sell Swap
  const sellTxn = await dlmmPool.swap({
    inToken: mint,
    binArraysPubkey: sellSwapQuote.binArraysPubkey,
    inAmount: buySwapQuoteOut.outAmount,
    lbPair: dlmmPool.pubkey,
    user: wallet,
    minOutAmount: sellSwapQuote.minOutAmount,
    outToken: spl.NATIVE_MINT,
  });

  const instructions = [...buyTxn.instructions, ...sellTxn.instructions];
  const recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;
  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash,
    instructions,
  }).compileToV0Message();
  return new VersionedTransaction(messageV0);
};


export const prepareMeteBuySell = async (
  params: {
    keypairs: Keypair[];
    mint: PublicKey;
  }
): Promise<{lbPair: any, lookupTableAccount: AddressLookupTableAccount}> => {
  const { keypairs, mint } = params;
  const wallets = keypairs.map((kp) => kp.publicKey);
  const payerKey = keypairs[0];
  const numOfInstructions = 4;
  //prepare to make a lookup table
  const lbPair = await getMeteoraDlmmPool(mint)
  const jitoInstance = new JitoBundleService();

  // create lookup table
  const { vTxn: lutTxn, lut } = await createLut(payerKey.publicKey, "volume");
  console.log("lookuptable: ", lut.toBase58());
  lutTxn.sign([payerKey]);
  const lutSignature = await jitoInstance.sendTransaction(lutTxn.serialize());
  const lutTxnRes = await solanaConnection.confirmTransaction(lutSignature);
  if(lutTxnRes.value.err)
    throw new Error("LUT creating transaction failed");

  const keys: PublicKey[] = [
    lbPair.publicKey,
    lbPair.account.reserveX,
    lbPair.account.reserveY,
    // lbPair.account.tokenXMint,
    // lbPair.account.tokenYMint,
    // lbPair.account.owner,
    // lbPair.account.feeOwner,
    // lbPair.account.preActivationSwapAddress,
    // lbPair.account.baseKey,
    // lbPair.account.creator,
    // lbPair.account.lbPair,
    // lbPair.account.operator,
    // lbPair.account.oracle
  ]
  // const lut = new PublicKey("Bja9LTL4prqiyrKVb2bineMiSTPJNvqZ2x5npQkTcQXU");

  const extendTxn = await extendLut(lut, mint, wallets, keys);
  // console.log("1");
  extendTxn.map(txn => txn.sign([payerKey]));
  const extendSerializedTxn = extendTxn.map((txn) => txn.serialize());
  const extendBundleId = await jitoInstance.sendBundle(extendSerializedTxn);
  const result = await jitoInstance.getBundleStatus(extendBundleId);
  if(!result)
    throw new Error("Extend bundle failed");
  const lutExtendTxnRes = await solanaConnection.confirmTransaction(getSignature(extendTxn[0]));
  if(lutExtendTxnRes.value.err)
    throw new Error("LUT extending transaction failed");
  //end of extend lookup table

  //fetch lookup table data
  // const lut = new PublicKey("6TUoQwe5V1L9nmqQFr1YqB8CA7PfasxAammWCXK96B5j");
  // const lut = new PublicKey("Ci361LB9EPmANRLMb36wDPmQR5wh3iWWBrnqs8RpGeCR");
  const getLookupTable = async (start_t: number): Promise<AddressLookupTableAccount> => {
    const lookupTableAccount = (await solanaConnection.getAddressLookupTable(lut))
      .value;
    if (!lookupTableAccount)
      if(Date.now() - start_t > 60 * 1000)
        throw new Error("Lookup table account not found!");
      else{
        await sleep(2000);
        return await getLookupTable(start_t);
      }
    return lookupTableAccount;
  };
  const lookupTableAccount = await getLookupTable(Date.now());

  //create ata
  let recentBlockhash = (await solanaConnection.getLatestBlockhash())
      .blockhash;
  
    const keypairChunks = Array.from(
      { length: Math.ceil(keypairs.length / numOfInstructions) },
      (v, i) => keypairs.slice(i * numOfInstructions, (i + 1) * numOfInstructions)
    );
  
    //create ata transactions
    
    const createAtaVtxns: VersionedTransaction[] = [];
    for (let i = 0; i < keypairChunks.length; i++) {
      const payerKeypairs = keypairChunks[i];
      const feePayer = payerKeypairs[0];
      const createAtaIxs: TransactionInstruction[] = [];
      for (let j = 0; j < payerKeypairs.length; j++) {
        const keypair = payerKeypairs[j];
        const splAta = spl.getAssociatedTokenAddressSync(
          mint,
          keypair.publicKey,
        );
        const solAta = spl.getAssociatedTokenAddressSync(
          spl.NATIVE_MINT,
          keypair.publicKey,
        );
        createAtaIxs.push(
          spl.createAssociatedTokenAccountIdempotentInstruction(
            keypair.publicKey,
            solAta,
            keypair.publicKey,
            spl.NATIVE_MINT
          ),
          spl.createAssociatedTokenAccountIdempotentInstruction(
            keypair.publicKey,
            splAta,
            keypair.publicKey,
            mint
          ),
        )
      }
  
      if(i === 0){
        // add jito fee instruction
        createAtaIxs.push(
          SystemProgram.transfer({
            fromPubkey: feePayer.publicKey,
            toPubkey: new PublicKey(JitoAccounts[0]),
            lamports: 0.00001 * LAMPORTS_PER_SOL,
          })
        )
      }
        
      const messageV0 = new TransactionMessage({
        payerKey: feePayer.publicKey,
        recentBlockhash,
        instructions: createAtaIxs,
      }).compileToV0Message([lookupTableAccount]);
      
      const vTxn = new VersionedTransaction(messageV0);
      console.log("create ata txn length:", vTxn.serialize().length);
      // const res = await solanaConnection.simulateTransaction(vTxn);
      // if (res.value.err) {
      //   console.log(res.value.logs);
      //   // return [];
      // }
      vTxn.sign(payerKeypairs);
      createAtaVtxns.push(vTxn);
    }
    const createAtaStxns = createAtaVtxns.map((vTxn) => vTxn.serialize());
    const createAtaBundleId = await jitoInstance.sendBundle(createAtaStxns);
    const createAtaRes = await solanaConnection.confirmTransaction(getSignature(createAtaVtxns[0]));
    if(createAtaRes.value.err)
      throw new Error("Creating ATA transaction failed");

    //end create ata
  return {
    lbPair,
    lookupTableAccount
  }
};


export const executeMeteBuySell = async (
  params: MeteVolumeParams
): Promise<string[]> => {
  const { keypairs, mint, amount, tip, data } = params;
  // const wallets = keypairs.map((kp) => kp.publicKey);
  // const payerKey = keypairs[0];
  const numOfInstructions = 4;
  const lbPair = data.lbPair;
  const lookupTableAccount = data.lookupTableAccount;

  //prepare to make a lookup table
  const inLamports = new BN(amount * LAMPORTS_PER_SOL);
  const slippage = new BN(100 * 100);
  const dlmmPool = await DLMM.create(solanaConnection, lbPair.publicKey);
  const swapY2X = spl.NATIVE_MINT.equals(lbPair.account.tokenYMint)
    ? true
    : false;
  const swapX2Y = !swapY2X;
  const [buyBinArrays, sellBinArrays] = await Promise.all([
    dlmmPool.getBinArrayForSwap(swapY2X),
    dlmmPool.getBinArrayForSwap(swapX2Y),
  ]);

  const buySwapQuote = dlmmPool.swapQuote(
    inLamports,
    swapX2Y,
    slippage,
    buyBinArrays
  );
  const buySwapQuoteOut = dlmmPool.swapQuoteExactOut(
    buySwapQuote.outAmount,
    swapX2Y,
    slippage,
    buyBinArrays
  );

  const sellSwapQuote = dlmmPool.swapQuote(
    buySwapQuoteOut.outAmount,
    swapY2X,
    slippage,
    sellBinArrays
  );
  const jitoInstance = new JitoBundleService();

  // create lookup table
  // const { vTxn: lutTxn, lut } = await createLut(payerKey.publicKey);
  // console.log("lookuptable: ", lut.toBase58());
  // lutTxn.sign([payerKey]);
  // const lutSignature = await jitoInstance.sendTransaction(lutTxn.serialize());
  // const lutTxnRes = await solanaConnection.confirmTransaction(lutSignature);
  // if(lutTxnRes.value.err)
  //   throw new Error("LUT creating transaction failed");

  // const lut = new PublicKey("A2YXFAokV5xqe7j6PRQsw4fUydKwj5q9E2Guve6Uff8f");
  // extend lookup table
  // const keys = [
    // lbPair.publicKey,
    // lbPair.account.tokenXMint,
    // lbPair.account.tokenYMint,
    // lbPair.account.baseKey,
    // lbPair.account.creator,
    // lbPair.account.feeOwner,
    // lbPair.account.lbPair,
    // lbPair.account.operator,
    // lbPair.account.oracle,
    // lbPair.account.owner,
    // lbPair.account.preActivationSwapAddress,
    // lbPair.account.reserveX,
    // lbPair.account.reserveY,
  // ]
  // const extendTxn = await extendLut(lut, mint, wallets);
  // console.log("1");
  // extendTxn.map(txn => txn.sign([payerKey]));
  // const extendSerializedTxn = extendTxn.map((txn) => txn.serialize());
  // const extendBundleId = await jitoInstance.sendBundle(extendSerializedTxn);
  // const result = await jitoInstance.getBundleStatus(extendBundleId);
  // if(!result)
  //   throw new Error("Extend bundle failed");
  // const lutExtendTxnRes = await solanaConnection.confirmTransaction(getSignature(extendTxn[0]));
  // if(lutExtendTxnRes.value.err)
  //   throw new Error("LUT extending transaction failed");
  //end of extend lookup table

  //fetch lookup table data
  // const lut = new PublicKey("6TUoQwe5V1L9nmqQFr1YqB8CA7PfasxAammWCXK96B5j");
  // const lut = new PublicKey("Ci361LB9EPmANRLMb36wDPmQR5wh3iWWBrnqs8RpGeCR");
  // const getLookupTable = async (start_t: number): Promise<AddressLookupTableAccount> => {
  //   const lookupTableAccount = (await solanaConnection.getAddressLookupTable(lut))
  //     .value;
  //   if (!lookupTableAccount)
  //     if(Date.now() - start_t > 60 * 1000)
  //       throw new Error("Lookup table account not found!");
  //     else{
  //       await sleep(2000);
  //       return await getLookupTable(start_t);
  //     }
  //   return lookupTableAccount;
  // };
  // const lookupTableAccount = await getLookupTable(Date.now());

  let recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;

  const keypairChunks = Array.from(
    { length: Math.ceil(keypairs.length / numOfInstructions) },
    (v, i) => keypairs.slice(i * numOfInstructions, (i + 1) * numOfInstructions)
  );
  
  // recentBlockhash = (await solanaConnection.getLatestBlockhash())
  //   .blockhash;
  const vTxns: VersionedTransaction[] = [];
  for (let i = 0; i < keypairChunks.length; i++) {
    const payerKeypairs = keypairChunks[i];
    const feePayer = payerKeypairs[0];
    let instructions: TransactionInstruction[] = [];
    const buyTxnPromises = payerKeypairs.map(async (keypair) => {
      const splAta = spl.getAssociatedTokenAddressSync(
        mint,
        keypair.publicKey,
        true
      );
    
      // Run both swap operations in parallel
      const [buyTxn, sellTxn] = await Promise.all([
        dlmmPool.swapExactOut({
          inToken: spl.NATIVE_MINT,
          binArraysPubkey: buySwapQuoteOut.binArraysPubkey,
          outAmount: buySwapQuoteOut.outAmount,
          lbPair: dlmmPool.pubkey,
          user: keypair.publicKey,
          maxInAmount: buySwapQuoteOut.maxInAmount,
          outToken: mint,
        }),
        dlmmPool.swap({
          inToken: mint,
          binArraysPubkey: sellSwapQuote.binArraysPubkey,
          inAmount: buySwapQuoteOut.outAmount,
          lbPair: dlmmPool.pubkey,
          user: keypair.publicKey,
          minOutAmount: sellSwapQuote.minOutAmount,
          outToken: spl.NATIVE_MINT,
        })
      ]);
    
      return [
        ...buyTxn.instructions.slice(1, -1),
        ...sellTxn.instructions.slice(1, -1),
        // spl.createCloseAccountInstruction(splAta, keypair.publicKey, keypair.publicKey),
      ];
    });

    const allInstructions = await Promise.all(buyTxnPromises);
    instructions.push(...allInstructions.flat());

    const jitoIxs = SystemProgram.transfer({
      fromPubkey: feePayer.publicKey,
      toPubkey: new PublicKey(JitoAccounts[0]),
      lamports: tip * LAMPORTS_PER_SOL,
    });
    if(i === 0)
      instructions.push(jitoIxs);

    const messageV0 = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash,
      instructions,
    }).compileToV0Message([lookupTableAccount]);
    // }).compileToV0Message();
    const vTxn = new VersionedTransaction(messageV0);
    vTxn.sign(payerKeypairs);

    // const res = await solanaConnection.simulateTransaction(vTxn);
    // if (res.value.err) {
    //   console.log(i, res.value.logs);
    //   throw new Error("Can't send transaction");
    // }

    console.log("bundle txn length:", vTxn.serialize().length);
    vTxns.push(vTxn);
  }

  const serializedTxns = vTxns.map(vTxn => vTxn.serialize());
  const signatures = vTxns.map(vTxn => getSignature(vTxn));
  // const jitoInstance = new JitoBundleService();
  const bundleid = await jitoInstance.sendBundle(serializedTxns);
  // await jitoInstance.getBundleStatus(bundleid);

  return signatures;
};
