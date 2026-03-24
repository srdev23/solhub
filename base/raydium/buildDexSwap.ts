import { LiquidityPoolKeys, MAINNET_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

export function buildDexSwap(
    isBuy: boolean,
    poolKeys: LiquidityPoolKeys,
    wSolATA: PublicKey,
    TokenATA: PublicKey,
    payer: PublicKey,
    inAmount: BN,
    outAmount: BN
  ) {
    const account1 = TOKEN_PROGRAM_ID; // token program
    const account2 = poolKeys.id; // amm id  writable
    const account3 = poolKeys.authority; // amm authority
    const account4 = poolKeys.openOrders; // amm open orders  writable
    const account5 = poolKeys.targetOrders; // amm target orders  writable
    const account6 = poolKeys.baseVault; // pool coin token account  writable  AKA baseVault
    const account7 = poolKeys.quoteVault; // pool pc token account  writable   AKA quoteVault
    const account8 = poolKeys.marketProgramId; // serum program id
    const account9 = poolKeys.marketId; //   serum market  writable
    const account10 = poolKeys.marketBids; // serum bids  writable
    const account11 = poolKeys.marketAsks; // serum asks  writable
    const account12 = poolKeys.marketEventQueue; // serum event queue  writable
    const account13 = poolKeys.marketBaseVault; // serum coin vault  writable     AKA marketBaseVault
    const account14 = poolKeys.marketQuoteVault; //   serum pc vault  writable    AKA marketQuoteVault
    const account15 = poolKeys.marketAuthority; // serum vault signer       AKA marketAuthority
    let account16 = TokenATA; // user source token account  writable
    let account17 = wSolATA; // user dest token account   writable
    const account18 = payer; // user owner (signer)  writable
    if (isBuy) {
      account16 = wSolATA;
      account17 = TokenATA;
    }
  
    const buyArgs = {
      maxAmountIn: inAmount,
      amountOut: outAmount,
    };
  
    const sellArgs = {
      amountIn: inAmount,
      minimumAmountOut: outAmount,
    };
  
    let prefix;
    const buffer = Buffer.alloc(16);
    if (isBuy) {
      buyArgs.maxAmountIn.toArrayLike(Buffer, "le", 8).copy(buffer, 0);
      buyArgs.amountOut.toArrayLike(Buffer, "le", 8).copy(buffer, 8);
      prefix = Buffer.from([0xb]);
    } else {
      sellArgs.amountIn.toArrayLike(Buffer, "le", 8).copy(buffer, 0);
      sellArgs.minimumAmountOut.toArrayLike(Buffer, "le", 8).copy(buffer, 8);
      prefix = Buffer.from([0x09]);
    }
    const instructionData = Buffer.concat([prefix, buffer]);
  
    // console.log({ instructionData })
    const accountMetas = [
      { pubkey: account1, isSigner: false, isWritable: false },
      { pubkey: account2, isSigner: false, isWritable: true },
      { pubkey: account3, isSigner: false, isWritable: false },
      { pubkey: account4, isSigner: false, isWritable: true },
      { pubkey: account5, isSigner: false, isWritable: true },
      { pubkey: account6, isSigner: false, isWritable: true },
      { pubkey: account7, isSigner: false, isWritable: true },
      { pubkey: account8, isSigner: false, isWritable: false },
      { pubkey: account9, isSigner: false, isWritable: true },
      { pubkey: account10, isSigner: false, isWritable: true },
      { pubkey: account11, isSigner: false, isWritable: true },
      { pubkey: account12, isSigner: false, isWritable: true },
      { pubkey: account13, isSigner: false, isWritable: true },
      { pubkey: account14, isSigner: false, isWritable: true },
      { pubkey: account15, isSigner: false, isWritable: false },
      { pubkey: account16, isSigner: false, isWritable: true },
      { pubkey: account17, isSigner: false, isWritable: true },
      { pubkey: account18, isSigner: true, isWritable: true },
    ];
  
    const swap = new TransactionInstruction({
      keys: accountMetas,
      programId: MAINNET_PROGRAM_ID.AmmV4,
      data: instructionData,
    });
  
    let buyIxs: TransactionInstruction[] = [];
    let sellIxs: TransactionInstruction[] = [];
  
    if (isBuy) buyIxs.push(swap);
    else sellIxs.push(swap);
    return { buyIxs, sellIxs };
  }