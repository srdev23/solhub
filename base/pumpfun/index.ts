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
import {
  GLOBAL,
  FEE_RECIPIENT,
  SYSTEM_PROGRAM_ID,
  RENT,
  PUMP_FUN_ACCOUNT,
  PUMP_FUN_PROGRAM,
} from "./constants";

import { bufferFromUInt64, readBigUintLE } from "./utils";
import { solanaConnection } from "@/lib/utils";
import { JitoAccounts, JitoBundleService } from "../jito/jito";
import { getSignature, sleep } from "../utils";
import { createLut } from "../createLut";
import { extendLut } from "./extendLut";

type PumpData = {
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  virtualTokenReserves: number;
  virtualSolReserves: number;
};

type PumpBumpParams = {
  wallet: PublicKey;
  mint: PublicKey;
  data: PumpData;
  amount: number;
  tip?: number;
};

type PumpBundleParams = {
  keypairs: Keypair[];
  mint: PublicKey;
  amount: number;
  isBuy: boolean;
  tip: number;
};

export async function getPumpData(mint: PublicKey): Promise<PumpData> {
  const mint_account = mint.toBuffer();
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint_account],
    PUMP_FUN_PROGRAM
  );
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [bondingCurve.toBuffer(), spl.TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    spl.ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const PUMP_CURVE_STATE_OFFSETS = {
    VIRTUAL_TOKEN_RESERVES: 0x08,
    VIRTUAL_SOL_RESERVES: 0x10,
  };

  const response = await solanaConnection.getAccountInfo(bondingCurve);
  if (response === null) throw new Error("curve account not found");
  const virtualTokenReserves = readBigUintLE(
    response.data,
    PUMP_CURVE_STATE_OFFSETS.VIRTUAL_TOKEN_RESERVES,
    8
  );
  const virtualSolReserves = readBigUintLE(
    response.data,
    PUMP_CURVE_STATE_OFFSETS.VIRTUAL_SOL_RESERVES,
    8
  );

  if (virtualSolReserves === 0 || virtualTokenReserves === 0)
    throw new Error("curve account not found");

  return {
    bondingCurve,
    associatedBondingCurve,
    virtualTokenReserves,
    virtualSolReserves,
  };
}

function getPumpSwapInstruction(
  mint: PublicKey,
  splAta: PublicKey,
  wallet: PublicKey,
  amount: number,
  pumpData: PumpData,
  isBuy: boolean
) {
  const slippageValue = 100 / 100;
  const swapAmount = isBuy ? amount * LAMPORTS_PER_SOL : amount * 10 ** 6;
  const amountInLamports = Math.floor(swapAmount);
  const keys = [
    { pubkey: GLOBAL, isSigner: false, isWritable: false },
    { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    {
      pubkey: pumpData.bondingCurve,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: pumpData.associatedBondingCurve,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: splAta, isSigner: false, isWritable: true },
    { pubkey: wallet, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: isBuy ? spl.TOKEN_PROGRAM_ID : spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: isBuy ? RENT : spl.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
  ];

  let data: Buffer;
  let outAmount: number;
  if (isBuy) {
    const tokenOut = Math.floor(
      (amountInLamports * pumpData.virtualTokenReserves) /
        pumpData.virtualSolReserves
    );
    outAmount = tokenOut / 10 ** 6;
    const solInWithSlippage = amount * (1 + slippageValue);
    const maxSolCost = Math.floor(solInWithSlippage * LAMPORTS_PER_SOL);

    data = Buffer.concat([
      Uint8Array.from(bufferFromUInt64("16927863322537952870")),
      Uint8Array.from(bufferFromUInt64(tokenOut)),
      Uint8Array.from(bufferFromUInt64(maxSolCost)),
    ]);
  } else {
    const minSolOutput = Math.floor(
      (amountInLamports * (1 - slippageValue) * pumpData.virtualSolReserves) /
        pumpData.virtualTokenReserves
    );
    outAmount = minSolOutput / LAMPORTS_PER_SOL;
    // console.log("amountInLamports", amountInLamports);
    data = Buffer.concat([
      Uint8Array.from(bufferFromUInt64("12502976635542562355")),
      Uint8Array.from(bufferFromUInt64(amountInLamports)),
      Uint8Array.from(bufferFromUInt64(minSolOutput)),
    ]);
  }

  const instruction = new TransactionInstruction({
    keys,
    programId: PUMP_FUN_PROGRAM,
    data,
  });

  return {
    instruction,
    outAmount,
  };
}

// ------------------------------------------------ Pumpfun Bump Bot ------------------------------------------------ //


export const pumpfunBumpTxn = async (
  params: PumpBumpParams
): Promise<VersionedTransaction> => {
  const { wallet, mint, data: pumpData, amount, tip } = params;
  const splAta = spl.getAssociatedTokenAddressSync(mint, wallet, true);
  const solAta = spl.getAssociatedTokenAddressSync(
    spl.NATIVE_MINT,
    wallet,
    true
  );

  const { instruction: buyPumfunInstruction, outAmount: tokenOutAmount } =
    getPumpSwapInstruction(mint, splAta, wallet, amount, pumpData, true);

  const { instruction: sellPumfunInstruction } = getPumpSwapInstruction(
    mint,
    splAta,
    wallet,
    tokenOutAmount,
    pumpData,
    false
  );

  const buyInstructions = [
    spl.createAssociatedTokenAccountIdempotentInstruction(
      wallet,
      solAta,
      wallet,
      spl.NATIVE_MINT
    ),
    SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: solAta,
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    }),
    spl.createSyncNativeInstruction(solAta, spl.TOKEN_PROGRAM_ID),
    spl.createAssociatedTokenAccountIdempotentInstruction(
      wallet,
      splAta,
      wallet,
      mint
    ),
    buyPumfunInstruction,
    // spl.createCloseAccountInstruction(solAta, wallet, wallet),
  ];

  const sellInstructions = [
    sellPumfunInstruction,
    spl.createCloseAccountInstruction(solAta, wallet, wallet),
    spl.createCloseAccountInstruction(splAta, wallet, wallet)
  ];

  const instructions = [...buyInstructions, ...sellInstructions];

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
  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash,
    instructions,
  }).compileToV0Message();
  const vTxn = new VersionedTransaction(messageV0);
  // const res = await solanaConnection.simulateTransaction(vTxn);
  // if (res.value.err) {
  //   console.log(res.value.logs);
  //   // return null;
  // }
  return vTxn;
};

// ------------------------------------------------ Pumpfun Bundler Bot ------------------------------------------------ //


export const pumpfunBundler = async (
  params: PumpBundleParams
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
  const extendTxn = await extendLut(lut, mint, wallets);
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
  // const lut = new PublicKey("8r9RQQUyra1ewqhroGnYWkXS3jVjYwFdvTjc4mSw3AM1");
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

  const pumpData = await getPumpData(mint);
  let recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;
  const keypairChunks = Array.from(
    { length: Math.ceil(keypairs.length / numOfInstructions) },
    (v, i) => keypairs.slice(i * numOfInstructions, (i + 1) * numOfInstructions)
  );


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
          // SystemProgram.transfer({
          //   fromPubkey: keypair.publicKey,
          //   toPubkey: solAta,
          //   lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          // }),
          // spl.createSyncNativeInstruction(solAta, spl.TOKEN_PROGRAM_ID),
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

      const { instruction: buyPumfunInstruction } = getPumpSwapInstruction(
        mint,
        splAta,
        keypair.publicKey,
        amount,
        pumpData,
        true
      );

      let splBal = 0;
      if(!isBuy){
        if(!splBalances)
          throw new Error("Fetching spl balances failed");
        splBal =amount * Number(splBalances[i * numOfInstructions + j].value.uiAmount) / 100;
      }

      const { instruction: sellPumfunInstruction } = getPumpSwapInstruction(
        mint,
        splAta,
        keypair.publicKey,
        splBal,
        pumpData,
        false
      );

      const buyInstructions = [
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: solAta,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        }),
        spl.createSyncNativeInstruction(solAta, spl.TOKEN_PROGRAM_ID),
        buyPumfunInstruction,
      //   // spl.createCloseAccountInstruction(solAta, wallet, wallet),
      ];

      const sellInstructions = [
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: solAta,
          lamports: 1,
        }),
        spl.createSyncNativeInstruction(solAta, spl.TOKEN_PROGRAM_ID),
        sellPumfunInstruction,
      //   // spl.createCloseAccountInstruction(splAta, wallet, wallet)
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
    //   console.log(res.value.err);
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
