import { getMeteoraAmmInfo } from "@/base/meteora/liquidity";
import { devConnection, solanaConnection } from "@/lib/utils";
import { getMint } from "@solana/spl-token";
import * as web3 from "@solana/web3.js";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method == "GET") {
    try {
      const poolId = req.query.poolId as string;
      const url = "mainnet";
      const connection = new web3.Connection(
        url == "mainnet"
          ? solanaConnection.rpcEndpoint
          : devConnection.rpcEndpoint,
        { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 }
      );
      const stablePool = await getMeteoraAmmInfo(
        connection,
        new web3.PublicKey(poolId)
      );

      // const [ baseSymbol, quoteSymbol, lpSymbol ] = await Promise.all([
      //   getMint(connection, stablePool.baseMint),
      //   getMint(connection, stablePool.quoteMint),
      //   getMint(connection, stablePool.lpMint),
      // ])
      const result = {
        baseMint: stablePool.baseMint.toBase58(),
        quoteMint: stablePool.quoteMint.toBase58(),
        lpMint: stablePool.lpMint.toBase58(),
        vPrice: stablePool.vPrice,
      };
      return res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
