import {
  AddressLookupTableProgram,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { solanaConnection } from "@/lib/utils";
import { JitoAccounts } from "../jito/jito";
import { BUNDLER_FEE, FEE_WALLET } from "@/lib/constant";

// createLUT();
// extendLUT();

export async function createLut(wallet: PublicKey, feeType: "volume"|"bunlder") {
  const createLUTixs: TransactionInstruction[] = [];
  const [createTi, lut] = AddressLookupTableProgram.createLookupTable({
    authority: wallet,
    payer: wallet,
    recentSlot: await solanaConnection.getSlot("finalized"),
  });

  const jitoIxs = SystemProgram.transfer({
        fromPubkey: wallet,
        toPubkey: new PublicKey(JitoAccounts[0]),
        lamports: 0.00001 * LAMPORTS_PER_SOL,
    });

  const feeIxs = SystemProgram.transfer({
    fromPubkey: wallet,
    toPubkey: FEE_WALLET,
    lamports: BUNDLER_FEE,
  });
  createLUTixs.push(createTi, jitoIxs, feeIxs);
  const recentBlockhash = (await solanaConnection.getLatestBlockhash())
    .blockhash;
  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash,
    instructions: createLUTixs,
  }).compileToV0Message();
  const vTxn = new VersionedTransaction(messageV0);
  return {
    vTxn,
    lut
  }
}
