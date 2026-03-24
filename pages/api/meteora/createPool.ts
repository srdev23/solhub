import { ActivationTypeConfig, MeteoraConfig } from "@/base/meteora/config";
import { createPermissionlessDynamicPool } from "@/base/meteora/create_pool_utils";
import { CREATE_POOL_FEE, FEE_WALLET, METEORA_CREATE_POOL_FEE } from "@/lib/constant";
import { CreateMeteoraPoolInput } from "@/lib/types";
import { devConnection, solanaConnection } from "@/lib/utils";
import { DYNAMIC_AMM_PROGRAM_ID } from "@meteora-ag/alpha-vault";
import * as web3 from "@solana/web3.js";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method == "POST") {
    try {
      const {
        owner,
        baseMint: baseTokenCA,
        quoteMint: quoteTokenCA,
        baseAmount,
        quoteAmount,
      } = req.body.params;
      const result = await createMeteoraAmmPool({
        owner: new web3.PublicKey(owner),
        baseMint: new web3.PublicKey(baseTokenCA),
        quoteMint: new web3.PublicKey(quoteTokenCA),
        baseAmount,
        quoteAmount,
        url: "mainnet",
      });
      if (!result)
        return res.status(500).json({ error: "Something went wrong" });
      return res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

export async function createMeteoraAmmPool(input: CreateMeteoraPoolInput) {
  const { owner, baseMint, quoteMint, baseAmount, quoteAmount, url } = input;

  const connection = new web3.Connection(
    url == "mainnet" ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint,
    { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 }
  );

  const config: MeteoraConfig = {
    computeUnitPriceMicroLamports: 100000,
    dynamicAmm: {
      baseAmount,
      quoteAmount,
      tradeFeeNumerator: 2500,
      activationType: ActivationTypeConfig.Timestamp,
      activationPoint: null,
      hasAlphaVault: false,
    },
    dlmm: null,
  };
  const res = await createPermissionlessDynamicPool(
    connection,
    config,
    owner,
    baseMint,
    quoteMint,
    {
      cluster: "mainnet-beta",
      programId: DYNAMIC_AMM_PROGRAM_ID,
    }
  );

  const feeIx = web3.SystemProgram.transfer({
    fromPubkey: owner,
    toPubkey: FEE_WALLET,
    lamports: METEORA_CREATE_POOL_FEE,
  });
  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const messsageV0 = new web3.TransactionMessage({
    payerKey: owner,
    instructions: [...res.initPoolTx.instructions, feeIx],
    recentBlockhash,
  }).compileToV0Message();
  const vTxn = new web3.VersionedTransaction(messsageV0);
  const simRes = (await connection.simulateTransaction(vTxn)).value;
  if (simRes.err) throw new Error("Transaction simulation error, please check Base/Quote tokens and its balances");
  return {
    poolId: res.poolKey.toBase58(),
    txn: Buffer.from(vTxn.serialize()).toString("base64"),
  };
}
