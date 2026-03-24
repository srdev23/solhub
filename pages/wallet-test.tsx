import { useEffect } from "react";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import { solanaConnection, devConnection, truncateText, getTokenList,fetchTokenMetadata } from "@/lib/utils";
import { DEV_RPC, MAIN_RPC } from "@/lib/constant"
const MinimalTokenFetch = () => {
  const publicKey = new PublicKey("4GncHD15kn3eYK4tzYvhVeP95qpYPggf7jcpHjPiDfdJ"); // Replace with the actual public key
  const connection = new Connection(MAIN_RPC);
   const solanaConnection = new Connection(MAIN_RPC);
  const devConnection = new Connection(MAIN_RPC); // All connections use MAIN_RPC now
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        console.log(`Fetching tokens for public key: ${publicKey.toBase58()}`);
        const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        console.log("Token Accounts Fetched: ", tokenAccounts);

        if (tokenAccounts.value.length === 0) {
          console.log("No token accounts found.");
        } else {
          for (const accountInfo of tokenAccounts.value) {
            const accountData = AccountLayout.decode( Uint8Array.from(accountInfo.account.data));
            const mintAddress = new PublicKey(accountData.mint).toBase58();

            console.log("Token Account Info:", {
              mint: mintAddress,
              owner: new PublicKey(accountData.owner).toBase58(),
              amount: accountData.amount,
            });

            // Fetch metadata for the mint address
            const metadata = await fetchTokenMetadata(mintAddress);
            console.log("Token Metadata:", metadata);
          }
        }
      } catch (error) {
        console.error("Error fetching token accounts: ", error);
      }
    };

    fetchTokens();
  }, [publicKey, connection]);

  return <div>Check console for token fetch details.</div>;
};

export default MinimalTokenFetch;
