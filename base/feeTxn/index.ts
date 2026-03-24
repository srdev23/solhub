import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { JitoBundleService } from "../jito/jito";
import { solanaConnection } from "@/lib/utils";
import { BUMP_FEE, BUNDLER_FEE, FEE_WALLET, VOLUME_FEE } from "@/lib/constant";

export const payFeeTxn = async (
  feePayer: Keypair,
  feeType: "volume" | "bunlder" | "bump"
): Promise<boolean> => {
  try {
    let recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
    const feeAmount = feeType === "volume" ? VOLUME_FEE : feeType === "bunlder"? BUNDLER_FEE: BUMP_FEE;
    const instructions = [
        SystemProgram.transfer({
        fromPubkey: feePayer.publicKey,
        toPubkey: FEE_WALLET,
        lamports: feeAmount,
        }),
    ];

    const messageV0 = new TransactionMessage({
        payerKey: feePayer.publicKey,
        recentBlockhash,
        instructions,
    }).compileToV0Message();

    const vTxn = new VersionedTransaction(messageV0);
    console.log("create ata txn length:", vTxn.serialize().length);
    // const res = await solanaConnection.simulateTransaction(vTxn);
    // if (res.value.err) {
    //   console.log(res.value.err);
    //   return [];
    // }
    vTxn.sign([feePayer]);
    const jitoInstance = new JitoBundleService();
    const signature = await jitoInstance.sendTransaction(vTxn.serialize());
    const createAtaRes = await solanaConnection.confirmTransaction(signature);
    if (createAtaRes.value.err)
        throw new Error("Creating ATA transaction failed");
    return true;
  } catch (e: any) {
    console.log("Error while running fee payer transaction");
    return false;
  }
};
