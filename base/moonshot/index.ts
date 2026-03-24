import { Moonshot, Environment, Token } from "@wen-moon-ser/moonshot-sdk";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { solanaConnection } from "@/lib/utils";
import { JitoAccounts } from "../jito/jito";
import { createCloseAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";

type MoonBumpParams = {
    data: any;
    wallet: PublicKey;
    mint: PublicKey;
    amount: number;
    tip?: number;
  };
export const moonshotBumpTxn = async (params: MoonBumpParams) => {
  const { wallet, amount, mint, tip } = params;
  
  const RPC_URL = "https://api.mainnet-beta.solana.com";
  const moonshot = new Moonshot({
    rpcUrl: solanaConnection.rpcEndpoint,
    authToken: "YOUR_AUTH_TOKEN",
    environment: Environment.MAINNET,
  });

  const token = moonshot.Token({
    mintAddress: mint.toBase58(),
  });
  const curvePos = await token.getCurvePosition();
  const collateralPrice = await token.getCollateralPrice({
    tokenAmount: BigInt(1e9), // 1 token in minimal units
    curvePosition: curvePos,
  });
  const singleTokenPriceSol = Number(collateralPrice) / 1e9; // Convert lamports to SOL
  // Specify the amount in SOL you want to spend
  const tokensToBuy = Math.floor(amount / singleTokenPriceSol);
  const splAmount = BigInt(tokensToBuy) * BigInt(1e9); // Convert to minimal units

  const [ buyCollateralAmount, sellCollateralAmount ] = await Promise.all([
    token.getCollateralAmountByTokens({
        tokenAmount: splAmount,
        tradeDirection: "BUY",
      }),
    token.getCollateralAmountByTokens({
    tokenAmount: splAmount,
    tradeDirection: "SELL",
    })
  ])

  const [ buyInstructions, sellInstructions ] = await Promise.all([
    token.prepareIxs({
      slippageBps: 100,
      creatorPK: wallet.toBase58(),
      tokenAmount: splAmount,
      collateralAmount: buyCollateralAmount,
      tradeDirection: "BUY",
    }),
    token.prepareIxs({
      slippageBps: 100,
      creatorPK: wallet.toBase58(),
      tokenAmount: splAmount,
      collateralAmount: sellCollateralAmount,
      tradeDirection: "SELL",
    }),
  ]);

  const splAta = getAssociatedTokenAddressSync(mint, wallet, true);
  const instructions: TransactionInstruction[] = [
      ...buyInstructions.ixs,
      ...sellInstructions.ixs,
      createCloseAccountInstruction(splAta, wallet, wallet)
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
  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
};
