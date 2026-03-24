import {
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import {
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { solanaConnection } from "@/lib/utils";
import { fetchPoolInfoByMint } from "./getPoolkeysByMint";
import { JitoAccounts, JitoBundleService } from "../jito/jito";
import { buildDexSwap } from "./buildDexSwap";
import { createLut } from "../createLut";
import { extendLut } from "./extendLut";
import { getSignature, sleep } from "../utils";
import { BN } from "bn.js";

const WSOL_TOKEN = new Token(spl.TOKEN_PROGRAM_ID, spl.NATIVE_MINT, 9, "WSOL", "WSOL");

type RayBumpParams = {
  data: LiquidityPoolKeys;
  wallet: PublicKey;
  mint: PublicKey;
  amount: number;
  tip?: number;
};

type RayBundleParams = {
  keypairs: Keypair[];
  mint: PublicKey;
  amount: number;
  isBuy: boolean;
  tip: number;
};

type RayVolumeParams = {
  data?: any;
  keypairs: Keypair[];
  mint: PublicKey;
  amount: number;
  tip: number;
};

export const getRaydiumPoolkeys = async (
  mint: PublicKey
): Promise<LiquidityPoolKeys> => {
  const targetPoolInfo = await fetchPoolInfoByMint(
    mint.toBase58(),
    spl.NATIVE_MINT.toBase58()
  );
  if (targetPoolInfo === null) throw new Error("Pool not found");
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;
  return poolKeys;
};

// ------------------------------------------------ Raydium Bump Bot ------------------------------------------------ //

export const raydiumBumpTxn = async (
  params: RayBumpParams
): Promise<VersionedTransaction> => {
  const { wallet, mint, data: poolKeys, amount, tip } = params;

  const slippage = new Percent(100, 100);
  const decimals = (await spl.getMint(solanaConnection, mint)).decimals;
  const MINT_TOKEN = new Token(spl.TOKEN_PROGRAM_ID, mint, decimals);
  const inLamports = Math.floor(amount * LAMPORTS_PER_SOL);
  const inputTokenAmount = new TokenAmount(WSOL_TOKEN, inLamports);

  const wsolATA = spl.getAssociatedTokenAddressSync(spl.NATIVE_MINT, wallet);
  const splATA = spl.getAssociatedTokenAddressSync(mint, wallet);
  const poolInfo = await Liquidity.fetchInfo({
    connection: solanaConnection,
    poolKeys,
  });

  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn: inputTokenAmount,
    currencyOut: MINT_TOKEN,
    slippage,
  });

  const { amountIn, maxAmountIn } = Liquidity.computeAmountIn({
    poolKeys,
    poolInfo,
    amountOut,
    currencyIn: WSOL_TOKEN,
    slippage,
  });

  const minWsolOutAmount = new TokenAmount(WSOL_TOKEN, 1);

  const { buyIxs } = buildDexSwap(true, poolKeys, wsolATA, splATA, wallet, inputTokenAmount.raw, minAmountOut.raw);
  const { sellIxs } = buildDexSwap(false, poolKeys, wsolATA, splATA, wallet, minAmountOut.raw, minWsolOutAmount.raw);

  const createWsolAtaIxs = spl.createAssociatedTokenAccountIdempotentInstruction(
    wallet,
    wsolATA,
    wallet,
    spl.NATIVE_MINT
  )
  const createSplAtaIxs = spl.createAssociatedTokenAccountIdempotentInstruction(
    wallet,
    splATA,
    wallet,
    mint
  )
  
  const instructions: TransactionInstruction[] = [
    createWsolAtaIxs,
    createSplAtaIxs,
    SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: wsolATA,
      lamports: inLamports,
    }),
    spl.createSyncNativeInstruction(wsolATA, spl.TOKEN_PROGRAM_ID),
    ...buyIxs,
    ...sellIxs,
    spl.createCloseAccountInstruction(wsolATA, wallet, wallet),
    spl.createCloseAccountInstruction(splATA, wallet, wallet)
  ];

  if (tip)
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet,
        toPubkey: new PublicKey(JitoAccounts[0]),
        lamports: tip * LAMPORTS_PER_SOL,
      })
    );
  const recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;
  const lookupTableAccount = (await solanaConnection.getAddressLookupTable(new PublicKey("FeiGa2zr9z5WLML7GEWxhVpdmXhKuGGMUCe6LcuDHDm")))
    .value;
  
  if(!lookupTableAccount){
    throw new Error("lookupTableAccount not found");
  }

  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash,
    instructions,
  }).compileToV0Message();
  // }).compileToV0Message([lookupTableAccount]);
  return new VersionedTransaction(messageV0);
};

// ------------------------------------------------ Raydium Bundler Bot ------------------------------------------------ //

export const raydiumBundler = async (
  params: RayBundleParams
): Promise<string[]> => {
  const { keypairs, mint, amount, isBuy, tip } = params;
  const wallets = keypairs.map((kp) => kp.publicKey);
  const payerKey = keypairs[0];
  const numOfInstructions = 5;

  // create lookup table
  const { vTxn: lutTxn, lut } = await createLut(payerKey.publicKey, "bunlder");
  console.log("lookuptable: ", lut.toBase58());
  lutTxn.sign([payerKey]);
  const jitoInstance = new JitoBundleService();
  const lutSignature = await jitoInstance.sendTransaction(lutTxn.serialize());
  const lutTxnRes = await solanaConnection.confirmTransaction(lutSignature);
  if(lutTxnRes.value.err)
    throw new Error("LUT creating transaction failed");

  // extend lookup table
  const poolKeys = await getRaydiumPoolkeys(mint);
  const extendTxn = await extendLut(lut, mint, wallets, poolKeys);
  extendTxn.map(txn => txn.sign([payerKey]));
  const extendSerializedTxn = extendTxn.map((txn) => txn.serialize());
  const extendBundleId = await jitoInstance.sendBundle(extendSerializedTxn);
  const result = await jitoInstance.getBundleStatus(extendBundleId);
  if(!result)
    throw new Error("Extend bundle failed");

  const lutExtendTxnRes = await solanaConnection.confirmTransaction(getSignature(extendTxn[0]));
  if(lutExtendTxnRes.value.err)
    throw new Error("LUT extending transaction failed");

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

  let recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;

  const keypairChunks = Array.from(
    { length: Math.ceil(keypairs.length / numOfInstructions) },
    (v, i) => keypairs.slice(i * numOfInstructions, (i + 1) * numOfInstructions)
  );

  //create ata transactions
  if(isBuy){
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

      if(i === 0)
        createAtaIxs.push(
          SystemProgram.transfer({
            fromPubkey: feePayer.publicKey,
            toPubkey: new PublicKey(JitoAccounts[0]),
            lamports: tip * LAMPORTS_PER_SOL,
          })
        )

      const messageV0 = new TransactionMessage({
        payerKey: feePayer.publicKey,
        recentBlockhash,
        instructions: createAtaIxs,
      }).compileToV0Message([lookupTableAccount]);
      
      // }).compileToV0Message();
      const vTxn = new VersionedTransaction(messageV0);
      console.log("create ata txn length:", vTxn.serialize().length);
      // const res = await solanaConnection.simulateTransaction(vTxn);
      // if (res.value.err) {
      //   console.log(res.value.err);
      //   return [];
      // }
      vTxn.sign(payerKeypairs);
      createAtaVtxns.push(vTxn);
    }
    const createAtaStxns = createAtaVtxns.map((vTxn) => vTxn.serialize());
    const createAtaBundleId = await jitoInstance.sendBundle(createAtaStxns);
    const createAtaRes = await solanaConnection.confirmTransaction(getSignature(createAtaVtxns[0]));
    if(createAtaRes.value.err)
      throw new Error("Creating ATA transaction failed");
  }

  //get spl balance when sell
  let splBalances;
  if(!isBuy){
    splBalances = await Promise.all(
      keypairs.map((keypair) =>
        solanaConnection.getTokenAccountBalance(
          spl.getAssociatedTokenAddressSync(mint, keypair.publicKey)
        )
      )
    );
  }

  const poolInfo = await Liquidity.fetchInfo({
    connection: solanaConnection,
    poolKeys,
  });

  const slippage = new Percent(100, 100);
  const decimals = (await spl.getMint(solanaConnection, mint)).decimals;
  const MINT_TOKEN = new Token(spl.TOKEN_PROGRAM_ID, mint, decimals);
  const solInLamports = Math.floor(amount * LAMPORTS_PER_SOL);
  const inputWsolAmount = new TokenAmount(WSOL_TOKEN, solInLamports);

  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn: inputWsolAmount,
    currencyOut: MINT_TOKEN,
    slippage,
  });

  const { amountIn, maxAmountIn } = Liquidity.computeAmountIn({
    poolKeys,
    poolInfo,
    amountOut,
    currencyIn: WSOL_TOKEN,
    slippage,
  });
  
  recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;
  const vTxns: VersionedTransaction[] = [];
  for (let i = 0; i < keypairChunks.length; i++) {
    const payerKeypairs = keypairChunks[i];
    const feePayer = payerKeypairs[0];
    let instructions: TransactionInstruction[] = [];
    for (let j = 0; j < payerKeypairs.length; j++) {
      const keypair = payerKeypairs[j];
      const splAta = spl.getAssociatedTokenAddressSync(
        mint,
        keypair.publicKey,
        true
      );
      const solAta = spl.getAssociatedTokenAddressSync(
        spl.NATIVE_MINT,
        keypair.publicKey,
        true
      );

      
      let splBal = 0;
      if(!isBuy){
        if(!splBalances)
          throw new Error("Fetching spl balances failed");
        splBal = amount * Number(splBalances[i * numOfInstructions + j].value.amount) / 100;
      }

      const { buyIxs } = buildDexSwap(true, poolKeys, solAta, splAta, keypair.publicKey, inputWsolAmount.raw, minAmountOut.raw);
      const { sellIxs } = buildDexSwap(false, poolKeys, solAta, splAta, keypair.publicKey, new BN(splBal), new BN(1));

      const buyInstructions = [
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: solAta,
          lamports: solInLamports,
        }),
        spl.createSyncNativeInstruction(solAta, spl.TOKEN_PROGRAM_ID),
        ...buyIxs,
      ];

      const sellInstructions = [
        ...sellIxs,
      ];      

      instructions.push(...(isBuy ? buyInstructions : sellInstructions));
    }

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

// ------------------------------------------------ Raydium Volume Bot ------------------------------------------------ //

export const prepareRaydiumBuySell = async (
  params: {
    keypairs: Keypair[],
    mint: PublicKey,
  }
): Promise<{poolKeys: LiquidityPoolKeys, lookupTableAccount: AddressLookupTableAccount}> => {
  const { keypairs, mint } = params;
  const wallets = keypairs.map((kp) => kp.publicKey);
  const payerKey = keypairs[0];
  const numOfInstructions = 4;

  const jitoInstance = new JitoBundleService();
  const poolKeys = await getRaydiumPoolkeys(mint);

  // create lookup table
  const { vTxn: lutTxn, lut } = await createLut(payerKey.publicKey, "volume");
  console.log("lookuptable: ", lut.toBase58());
  lutTxn.sign([payerKey]);
  const lutSignature = await jitoInstance.sendTransaction(lutTxn.serialize());
  const lutTxnRes = await solanaConnection.confirmTransaction(lutSignature);
  if(lutTxnRes.value.err)
    throw new Error("LUT creating transaction failed");

  // extend lookup table
  const extendTxn = await extendLut(lut, mint, wallets, poolKeys);
  extendTxn.map(txn => txn.sign([payerKey]));
  const extendSerializedTxn = extendTxn.map((txn) => txn.serialize());
  const extendBundleId = await jitoInstance.sendBundle(extendSerializedTxn);
  const extendTxnRes = await solanaConnection.confirmTransaction(getSignature(extendTxn[0]));
  if(!extendTxnRes)
    throw new Error("Extend bundle failed");

  const lutExtendTxnRes = await solanaConnection.confirmTransaction(getSignature(extendTxn[0]));
  if(lutExtendTxnRes.value.err)
    throw new Error("LUT extending transaction failed");

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

    if(i === 0)
      createAtaIxs.push(
        SystemProgram.transfer({
          fromPubkey: feePayer.publicKey,
          toPubkey: new PublicKey(JitoAccounts[0]),
          lamports: 0.00001 * LAMPORTS_PER_SOL,
        })
      )

    const messageV0 = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash,
      instructions: createAtaIxs,
    }).compileToV0Message([lookupTableAccount]);
    
    const vTxn = new VersionedTransaction(messageV0);
    console.log("create ata txn length:", vTxn.serialize().length);
    // const res = await solanaConnection.simulateTransaction(vTxn);
    // if (res.value.err) {
    //   console.log(res.value.err);
    //   return [];
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
  const result = {
    poolKeys,
    lookupTableAccount,
  }
  return result;
};

export const executeRaydiumBuySell = async (
  params: RayVolumeParams
): Promise<string[]> => {
  const { keypairs, mint, amount, tip, data } = params;
  const poolKeys = data.poolKeys;
  const lookupTableAccount = data.lookupTableAccount;
  const numOfInstructions = 4;

  const jitoInstance = new JitoBundleService();
  let recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;

  const keypairChunks = Array.from(
    { length: Math.ceil(keypairs.length / numOfInstructions) },
    (v, i) => keypairs.slice(i * numOfInstructions, (i + 1) * numOfInstructions)
  );

  const poolInfo = await Liquidity.fetchInfo({
    connection: solanaConnection,
    poolKeys,
  });

  const slippage = new Percent(100, 100);
  const decimals = (await spl.getMint(solanaConnection, mint)).decimals;
  const MINT_TOKEN = new Token(spl.TOKEN_PROGRAM_ID, mint, decimals);
  const solInLamports = Math.floor(amount * LAMPORTS_PER_SOL);
  console.log("solInLamports", solInLamports);
  const inputWsolAmount = new TokenAmount(WSOL_TOKEN, solInLamports);

  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn: inputWsolAmount,
    currencyOut: MINT_TOKEN,
    slippage,
  });

  const { amountIn, maxAmountIn } = Liquidity.computeAmountIn({
    poolKeys,
    poolInfo,
    amountOut,
    currencyIn: WSOL_TOKEN,
    slippage,
  });
  
  recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;
  const vTxns: VersionedTransaction[] = [];
  for (let i = 0; i < keypairChunks.length; i++) {
    const payerKeypairs = keypairChunks[i];
    const feePayer = payerKeypairs[0];
    let instructions: TransactionInstruction[] = [];
    for (let j = 0; j < payerKeypairs.length; j++) {
      const keypair = payerKeypairs[j];
      const splAta = spl.getAssociatedTokenAddressSync(
        mint,
        keypair.publicKey,
        true
      );
      const solAta = spl.getAssociatedTokenAddressSync(
        spl.NATIVE_MINT,
        keypair.publicKey,
        true
      );

      const { buyIxs } = buildDexSwap(true, poolKeys, solAta, splAta, keypair.publicKey, inputWsolAmount.raw, minAmountOut.raw);
      const { sellIxs } = buildDexSwap(false, poolKeys, solAta, splAta, keypair.publicKey, minAmountOut.raw, new BN(1));

      const buyInstructions = [
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: solAta,
          lamports: solInLamports,
        }),
        spl.createSyncNativeInstruction(solAta, spl.TOKEN_PROGRAM_ID),
        ...buyIxs,
      ];

      const sellInstructions = [
        ...sellIxs,
        // spl.createCloseAccountInstruction(splAta, keypair.publicKey, keypair.publicKey),
        // spl.createCloseAccountInstruction(solAta, keypair.publicKey, keypair.publicKey)
      ];      

      instructions.push(...buyInstructions, ...sellInstructions);
    }

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
