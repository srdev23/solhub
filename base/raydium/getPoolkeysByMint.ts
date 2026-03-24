import { solanaConnection } from "@/lib/utils";
import {
  ApiPoolInfoV4,
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  MARKET_STATE_LAYOUT_V3,
  Market,
  SPL_MINT_LAYOUT,
  MAINNET_PROGRAM_ID,
} from "@raydium-io/raydium-sdk";
import { PublicKey } from "@solana/web3.js";

// Function to fetch pool info using a mint address
export async function fetchPoolInfoByMint(
  baseToken: string, quoteToken: string = ""
): Promise<ApiPoolInfoV4|null> {
  try {
    const filters = [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span }, // Ensure the correct data size for liquidity pool state
      {
        memcmp: {
          // Memory comparison to match base mint
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
          bytes: baseToken,
        },
      }
    ];
    
    if(quoteToken !== ""){
      filters.push({
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
          bytes: quoteToken,
        },
      })
    }

    // Fetch program accounts for Raydium's AMM program (AmmV4)
    const accounts = await solanaConnection.getProgramAccounts(
      MAINNET_PROGRAM_ID.AmmV4, // Raydium AMM V4 Program ID
      {
        filters
      }
    );

    if (accounts.length === 0) {

      const filters = [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span }, // Ensure the correct data size for liquidity pool state
        {
          memcmp: {
            // Memory comparison to match base mint
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
            bytes: baseToken,
          },
        }
      ];
      
      if(quoteToken !== ""){
        filters.push({
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
            bytes: quoteToken,
          },
        })
      }
      // If no account was found with mint as baseMint, try matching it as quoteMint
      const quoteAccounts = await solanaConnection.getProgramAccounts(
        MAINNET_PROGRAM_ID.AmmV4, // Raydium AMM V4 Program ID
        {
          filters
        }
      );

      if (quoteAccounts.length === 0) {
        // throw new Error(`No pool found for mint: ${mint}`);
        console.log(`No pool found for mint: ${baseToken}`);
        return null;
      }

      // Use the first account found where mint is quoteMint
      const poolAccount = quoteAccounts[0];
      return await decodePoolAndMarketInfo(poolAccount, baseToken);
    }

    // Use the first account found where mint is baseMint
    const poolAccount = accounts[0];
    return await decodePoolAndMarketInfo(poolAccount, baseToken);
  } catch (error) {
    throw error;
  }
}
// Helper function to decode pool and market info
async function decodePoolAndMarketInfo(
  poolAccount: any,
  mint: any
): Promise<ApiPoolInfoV4> {
  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.account.data);
  console.log(
    `- Raydium AMM: Pool account found for Mint: ${mint}, \n- Raydium AMM Pool ID: ${poolAccount.pubkey.toString()}`
  );

  // Fetch the market account using the decoded marketId
  const marketAccount = await solanaConnection.getAccountInfo(poolState.marketId);
  if (!marketAccount) {
    throw new Error("Market account not found");
  }

  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);

  // Fetch LP mint information
  const lpMintAccount = await solanaConnection.getAccountInfo(poolState.lpMint);
  if (!lpMintAccount) {
    throw new Error("LP mint account not found");
  }

  const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);

  // // Calculate the market authority
  // const marketAuthority = PublicKey.createProgramAddressSync(
  //   [
  //     marketInfo.ownAddress.toBuffer(),
  //     marketInfo.vaultSignerNonce.toArrayLike(Buffer, "le", 8),
  //   ],
  //   MAINNET_PROGRAM_ID.OPENBOOK_MARKET
  // );

  // Log and return the full set of pool data
  const poolData: ApiPoolInfoV4 = {
    id: poolAccount.pubkey.toString(), // Pool ID
    baseMint: poolState.baseMint.toString(),
    quoteMint: poolState.quoteMint.toString(),
    lpMint: poolState.lpMint.toString(),
    baseDecimals: poolState.baseDecimal.toNumber(),
    quoteDecimals: poolState.quoteDecimal.toNumber(),
    lpDecimals: lpMintInfo.decimals,
    version: 4, // Set version as the number literal 4 (not a string)
    programId: poolAccount.account.owner.toString(),
    authority: Liquidity.getAssociatedAuthority({
      programId: poolAccount.account.owner,
    }).publicKey.toString(),
    openOrders: poolState.openOrders.toString(),
    targetOrders: poolState.targetOrders.toString(),
    baseVault: poolState.baseVault.toString(),
    quoteVault: poolState.quoteVault.toString(),
    withdrawQueue: poolState.withdrawQueue.toString(),
    lpVault: poolState.lpVault.toString(),
    marketVersion: 3,
    marketProgramId: poolState.marketProgramId.toString(),
    marketId: poolState.marketId.toString(),
    marketAuthority: Market.getAssociatedAuthority({
      programId: poolState.marketProgramId,
      marketId: poolState.marketId,
    }).publicKey.toString(),
    marketBaseVault: marketInfo.baseVault.toString(),
    marketQuoteVault: marketInfo.quoteVault.toString(),
    marketBids: marketInfo.bids.toString(),
    marketAsks: marketInfo.asks.toString(),
    marketEventQueue: marketInfo.eventQueue.toString(),
    lookupTableAccount: PublicKey.default.toString(),
  };

  // console.log("- Full pool data:", poolData);

  return poolData;
}
