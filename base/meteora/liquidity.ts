import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";
import {
  PublicKey,
  Connection,
} from "@solana/web3.js";
import { BN } from "@project-serum/anchor";

export const getMeteoraAmmInfo = async (
  connection: Connection,
  poolid: PublicKey
) => {
  const stablePool = await AmmImpl.create(connection, poolid);
  if (!stablePool) throw new Error("Can't find Amm pool");
  return {
    baseMint: stablePool.tokenAMint.address,
    quoteMint: stablePool.tokenBMint.address,
    lpMint: stablePool.getPoolTokenMint(),
    vPrice: stablePool.poolInfo.virtualPrice,
  };
};

export const addLiquidity = async (
  connection: Connection,
  poolid: PublicKey,
  owner: PublicKey,
  amount: number,
  amountSide: "base" | "quote"
) => {
  const stablePool = await AmmImpl.create(connection, poolid);
  if (!stablePool) throw new Error("Can't find pool");
  let tokenAamount = new BN(amount * 10 ** stablePool.tokenAMint.decimals);
  let tokenBamount = new BN(amount * 10 ** stablePool.tokenBMint.decimals);
  if(amountSide == "base") {
    tokenBamount = new BN(0);
  }else if(amountSide == "quote") {
    tokenAamount = new BN(0);
  }
  const {
    tokenAInAmount,
    tokenBInAmount,
    poolTokenAmountOut,
    minPoolTokenAmountOut,
  } = stablePool.getDepositQuote(
    tokenAamount,
    tokenBamount,
    true,
    100
  );
  console.log("tokenAInAmount", tokenAInAmount.toNumber());
  console.log("tokenBInAmount", tokenBInAmount.toNumber());

  const txn = await stablePool.deposit(
    owner,
    tokenAInAmount,
    tokenBInAmount,
    minPoolTokenAmountOut
  );
  return txn;
};


export const removeLiquidity = async (
  connection: Connection,
  poolid: PublicKey,
  owner: PublicKey,
  amount: number,
) => {
  const stablePool = await AmmImpl.create(connection, poolid);
  if (!stablePool) throw new Error("Can't find AMM pool");
  let lpTokenAmount = new BN(amount * 10 ** 9);

  const {
    tokenAOutAmount,
    tokenBOutAmount,
    minTokenAOutAmount,
    minTokenBOutAmount,
    poolTokenAmountIn
  } = stablePool.getWithdrawQuote(
    lpTokenAmount,
    100
  );
  // console.log("poolTokenAmountIn", poolTokenAmountIn.toNumber());
  // console.log("minTokenAOutAmount", minTokenAOutAmount.toNumber());
  // console.log("minTokenBOutAmount", minTokenBOutAmount.toNumber());

  const txn = await stablePool.withdraw(
    owner,
    poolTokenAmountIn,
    tokenAOutAmount,
    tokenBOutAmount
  );
  return txn;
};
