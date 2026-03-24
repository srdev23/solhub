import {
  AddressLookupTableProgram,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as pump from "./constants";
import { solanaConnection } from "@/lib/utils";
import { JitoAccounts } from "../jito/jito";

export async function extendLut(
  lut: PublicKey,
  mint: PublicKey,
  wallets: PublicKey[]
) {
  if (wallets.length > 40)
    throw new Error("Too many wallets, try with maximum 40 wallets!");
  const accounts: PublicKey[] = []; // Array with all new keys to push to the new LUT
  accounts.push(
    lut,
    mint,
    pump.RENT,
    pump.GLOBAL,
    pump.FEE_RECIPIENT,
    pump.MINT_AUTHORITY,
    pump.PUMP_FUN_ACCOUNT,
    pump.PUMP_FUN_PROGRAM,
    spl.NATIVE_MINT,
    spl.TOKEN_PROGRAM_ID, // token program
    spl.ASSOCIATED_TOKEN_PROGRAM_ID,
    SystemProgram.programId
  );

  // Loop through each keypair and push its pubkey and ATAs to the accounts array
  for (const wallet of wallets) {
    const splAta = spl.getAssociatedTokenAddressSync(
      new PublicKey(mint),
      wallet
    );
    const wsolAta = spl.getAssociatedTokenAddressSync(spl.NATIVE_MINT, wallet);
    accounts.push(wallet, splAta, wsolAta);
  }

  const vTxns: VersionedTransaction[] = [];
  const accountChunks = Array.from(
    { length: Math.ceil(accounts.length / 30) },
    (v, i) => accounts.slice(i * 30, (i + 1) * 30)
  );

  const jitoIxs = SystemProgram.transfer({
    fromPubkey: wallets[0],
    toPubkey: new PublicKey(JitoAccounts[0]),
    lamports: 0.00001 * LAMPORTS_PER_SOL,
  });
  for (let i = 0; i < accountChunks.length; i++) {
    const chunk = accountChunks[i];
    const extendLUTixs: TransactionInstruction[] = [];
    const extendIx = AddressLookupTableProgram.extendLookupTable({
      lookupTable: lut,
      authority: wallets[0],
      payer: wallets[0],
      addresses: chunk,
    });

    extendLUTixs.push(extendIx);
    if (i === accountChunks.length - 1) {
      extendLUTixs.push(jitoIxs);
    }

    const recentBlockhash = (await solanaConnection.getLatestBlockhash())
      .blockhash;
    const messageV0 = new TransactionMessage({
      payerKey: wallets[0],
      recentBlockhash,
      instructions: extendLUTixs,
    }).compileToV0Message();

    vTxns.push(new VersionedTransaction(messageV0));
  }
  // Send bundle
  return vTxns;
}
