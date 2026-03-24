import { addLiquidity } from "@/base/meteora/liquidity";
import { ADD_LIQUIDITY_FEE, FEE_WALLET, METEORA_ADD_LIQUIDITY_FEE } from "@/lib/constant";
import { devConnection, solanaConnection } from "@/lib/utils";
import * as web3 from "@solana/web3.js";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method == "POST") {
    try {
      const { owner, poolId, amount, amountSide } = req.body.params;
      const url = "mainnet";
      const payer = new web3.PublicKey(owner);
      const connection = new web3.Connection(
        url == "mainnet"
          ? solanaConnection.rpcEndpoint
          : devConnection.rpcEndpoint,
        { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 }
      );
      const txn = await addLiquidity(
        connection,
        new web3.PublicKey(poolId),
        payer,
        amount,
        amountSide
      );
      const feeIx = web3.SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: FEE_WALLET,
        lamports: METEORA_ADD_LIQUIDITY_FEE,
      });
      const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const messsageV0 = new web3.TransactionMessage({
        payerKey: payer,
        instructions: [...txn.instructions, feeIx],
        recentBlockhash,
      }).compileToV0Message();
      const vTxn = new web3.VersionedTransaction(messsageV0);
      const simRes = (await connection.simulateTransaction(vTxn)).value;

      if (simRes.err) throw new Error("Transaction simulation error, please check Amm ID and Base/Quote token balances in your wallet");
      const result = {
        txn: Buffer.from(vTxn.serialize()).toString("base64"),
      };
      return res.status(200).json(result);
    } catch (error: any) {
    //   console.log(error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
