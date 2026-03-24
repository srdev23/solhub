import AmmImpl, {
  AmmIdl,
  PROGRAM_ID,
} from "@mercurial-finance/dynamic-amm-sdk";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { AnchorProvider, BN, Program } from "@project-serum/anchor";
import { solanaConnection } from "@/lib/utils";

export type MeteoraAmmParam = {
  stabelPool: AmmImpl;
  inLamports: BN;
  minOutLamports: BN;
  outLamports: BN;
}

export const meteoraAmmCheck = async (swapParam: any): Promise<MeteoraAmmParam|null> => {
  try {
    const { mint, amount, slippage, is_buy } = swapParam;
    const inputMint = is_buy ? spl.NATIVE_MINT : mint;
    const inLamports = is_buy
    ? new BN(amount * LAMPORTS_PER_SOL)
    : new BN(amount * 10 ** (await spl.getMint(solanaConnection, mint)).decimals);

  const pool = await getMeteoraAmmPool(mint);
  const stabelPool = await AmmImpl.create(solanaConnection, pool.publicKey);
  if(!stabelPool)
    throw new Error("Invalid pool");

  const { minSwapOutAmount, swapOutAmount } = stabelPool.getSwapQuote(
    inputMint,
    inLamports,
    slippage
  );
    return {
      stabelPool,
      inLamports,
      minOutLamports: minSwapOutAmount, 
      outLamports: swapOutAmount,
    }
  } catch (error) {
    return null;
  }
}

async function getAmmPool(mint: PublicKey) {
  const provider = new AnchorProvider(
    solanaConnection,
    {} as any,
    AnchorProvider.defaultOptions()
  );
  const program = new Program(AmmIdl, PROGRAM_ID, provider);

  const [poolsForTokenAMint, poolsForTokenBMint] = await Promise.all([
    program.account.pool.all([
      {
        memcmp: {
          offset: 40,
          bytes: mint.toBase58(),
        },
      },
      {
        memcmp: {
          offset: 72,
          bytes: spl.NATIVE_MINT.toBase58(),
        },
      },
    ]),
    program.account.pool.all([
      {
        memcmp: {
          offset: 40,
          bytes: spl.NATIVE_MINT.toBase58(),
        },
      },
      {
        memcmp: {
          offset: 72,
          bytes: mint.toBase58(),
        },
      },
    ]),
  ]);

  return [...poolsForTokenAMint, ...poolsForTokenBMint];
}

export const getMeteoraAmmPool = async (mint: PublicKey) => {
  const ammPools = await getAmmPool(mint);
  if(ammPools.length === 0)
    throw new Error("No Meteora AMM pool found");
  const tokenAmounts = await Promise.all(
    ammPools.map((pool) =>
      solanaConnection.getTokenAccountBalance(
        pool.account.tokenAMint.toBase58() === spl.NATIVE_MINT.toBase58()
          ? pool.account.aVaultLp
          : pool.account.bVaultLp
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
  console.log("- Meteora AMM:", ammPools[maxIndex].publicKey.toBase58());

  return ammPools[maxIndex];
};

export const meteoraAmmSwapTxn = async (swapParam: any, meteoraAmmParam?: MeteoraAmmParam) => {
  const { wallet, mint, type, tip, is_buy } = swapParam;
  const inputMint = is_buy ? spl.NATIVE_MINT : mint;
  
  let params: MeteoraAmmParam;
    if (meteoraAmmParam) {
      params = meteoraAmmParam;
    } else {
      const checkResult = await meteoraAmmCheck(swapParam);
      if (!checkResult)
        throw new Error("Failed to get Meteora AMM quote");
      params = checkResult;
    }
  
  const { stabelPool, inLamports, minOutLamports } = params;
  stabelPool.swap
  const swapTx = await stabelPool.swap(
    wallet,
    inputMint,
    inLamports,
    minOutLamports
  );

  const recentBlockhash = (await solanaConnection.getLatestBlockhash())
  .blockhash;

  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash,
    instructions: swapTx.instructions,
  }).compileToV0Message();
  return new VersionedTransaction(messageV0);
};
