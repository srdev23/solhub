import { useState, useEffect } from "react";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem, Divider, SelectedItems } from "@nextui-org/react";
import { mintToken, removeFreezeAuth, removeMintAuth, makeImmutableToken } from "@/lib/txHandler";
import { solanaConnection, devConnection, truncateText, getTokenList } from "@/lib/utils";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { SelectorIcon } from "@/components/SelectorIcon";
import SimpleBar from "simplebar-react";
import Faqs from "@/components/faqs";
import Head from "next/head";

const toastError = (str: string) => {
  toast.error(str, {
    position: "top-center"
  });
}

const toastSuccess = (str: string) => {
  toast.success(str, {
    position: "top-center",
    autoClose: false
  });
}

interface TokenData {
  mint: string;
  amount: number;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string;
  updateAuthority?: string; // Assuming these might not be present for all tokens
  image?: string; // Image URL if available
}


export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [tokenList, setTokenList] = useState<TokenData[]>([]);
  const [updateAuth, setUpdateAuth] = useState(true);
  const [updateTokenMint, setUpdateTokenMint] = useState("");
  const [rfToken, setRFToken] = useState("");
  const [rfLoading, setRFLoading] = useState(false);
  const [fetchFlag, setFetchFlag] = useState(false);

  const getNfts = async () => {
    if (!anchorWallet) return [];
    setFetchFlag(true);
    const list = await getTokenList(anchorWallet.publicKey);
    setFetchFlag(false);
    setTokenList(list);
  };

  useEffect(() => {
    (async () => {
      await getNfts()
    })()
  }, [anchorWallet]);

  const changeRFAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setUpdateAuth(false);
        setRFToken(mintAddress);
      } else {
        setRFToken("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }

  const removeFreezeToken = async () => {
    if (!wallet.publicKey) {
        toastError("Wallet not connected!");
        return;
    }

    if (rfToken === "") {
        toastError("You don't have authority for this token!");
        return;
    }

    setRFLoading(true);

    try {
        console.log("Attempting to remove freeze authority for token:", rfToken);

        // Call removeFreezeAuth, which handles the transaction creation and signing
        const signedTx = await removeFreezeAuth({ 
            mint: new PublicKey(rfToken), 
            url: "mainnet", 
            wallet: anchorWallet 
        });

        if (signedTx) {
            console.log("Transaction created and signed. Attempting to send it.");

            const options = {
                commitment: "confirmed",
                skipPreflight: true,
            };

            // Send and confirm the signed transaction
            const txId = await solanaConnection.sendRawTransaction(signedTx.serialize(), options);
            await solanaConnection.confirmTransaction(txId, "confirmed");

            console.log("Transaction sent and confirmed with txId:", txId);

            toastSuccess("Revoked freeze authority successfully!");
        }
    } catch (error: any) {
        console.error("Error in removeFreezeToken:", error);
        if (error.message.includes("already revoked")) {
            toastError("Freeze authority is already revoked.");
        } else {
            toastError(`Failed to revoke freeze authority: ${error.message}`);
        }
    } finally {
        setRFLoading(false);
    }
};

  const faqData = [
    {
      label: 'What is Freeze Authority?',
      description: "Freeze Authority is a permission that allows an account to freeze or unfreeze token transfers. This can be used to prevent transactions for security or compliance reasons."
  },
  {
      label: 'Why would I want to revoke Freeze Authority?',
      description: "Revoking Freeze Authority ensures that no account can freeze or unfreeze token transfers in the future, making your tokens fully decentralized and preventing any potential misuse of this power."
  },
  {
      label: 'How do I revoke Freeze Authority?',
      description: "To revoke Freeze Authority, simply select the token address from which you want to remove the freeze permissions and click 'Revoke Freeze.' This action cannot be undone, so make sure it's what you want."
  },
  {
      label: 'What happens after Freeze Authority is revoked?',
      description: "Once Freeze Authority is revoked, no account, including yours, will be able to freeze or unfreeze token transfers. Your tokens will remain freely transferable forever."
  },
  {
      label: 'Is it safe to revoke Freeze Authority?',
      description: "Yes, the process of revoking Freeze Authority is safe and managed by on-chain smart contracts, ensuring that your decision is securely implemented on the Solana blockchain."
  },
  
]

  return (
    <>
     <Head>
        <title>Revoke Freeze Authority</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
    <main
      className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}>
      <Header />
      <div className=" w-full h-full flex gap-6">
        <ProSidebar />
        <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto    rounded-xl justify-start flex items-start flex-col">
          {/* <SimpleBar forceVisible="x" autoHide={true} className="w-full h-[700px] px-6"> */}
            
            <span className="text-center w-full text-[25px] flex justify-center font-bold"> Revoke Freeze Authority</span>
            <div className=" w-full grid grid-cols-12 gap-4 pt-10">
              <Select
                isRequired
                label="Token Address"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList.filter((item: any) => item.mint !== "So11111111111111111111111111111111111111112")} // Exclude Native Solana
                isLoading={fetchFlag}
                className=" col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeRFAuth(e.target.value); }}
                renderValue={(items: SelectedItems<any>) => {
                  return items.map((item: any) => (
                    <div key={item.data.mint} className="flex items-center gap-2 w-full justify-between font-IT">
                 <img src={item.data.image} alt="" className="w-[30px] h-[30px]" />
          <div className="flex flex-col items-center w-full">
            <div className="truncate text-xs">{item.data.tokenName || item.data.symbol}</div> {/* Smaller Token Name or Symbol */}
            <div className="text-s text-gray-400 font-medium">{`${item.data.mint.slice(0, 4)}...${item.data.mint.slice(-4)}`}</div> {/* Smaller Mint Address with lighter color */}
          </div>
        </div>
                  ));
                }}
              >
                {(item) => (
                  <SelectItem key={item.mint} textValue={item.updateAuthority}>
                    <div className="flex items-center gap-2 w-full font-IT">
                 <img src={item.image} alt="" className="w-[30px] h-[30px]" />
                <div className="flex flex-col items-center w-full">
                  <div className="truncate text-s">{item.tokenName || item.tokenSymbol}</div> {/* Smaller Token Name or Symbol */}
                  <div className="text-s text-gray-400 font-medium">{`${item.mint.slice(0, 4)}...${item.mint.slice(-4)}`}</div> {/* Smaller Mint Address with lighter color */}
                </div>
              </div>
                  </SelectItem>
                )}
              </Select>
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" isLoading={rfLoading} onClick={() => { removeFreezeToken() }} fullWidth className=" text-[18px]" >
                  Revoke Freeze
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
            <Faqs faqData={faqData}/>
            <div>
            <h6 className="text-2xl pt-10">
    Revoke Freeze Authority
</h6>
<p className="text-base1">
    Use our Revoke Freeze Authority tool to remove the freeze authority from your tokens on the Solana blockchain. Start by selecting the token address from which you want to revoke the freeze authority.
</p>
<p className="text-base1">
    The freeze authority is a permission that allows an account to freeze or unfreeze token transfers. By revoking this authority, you ensure that the token can no longer be frozen by any account.
</p>
<p className="text-base1">
    Once you’ve selected the token address, click "Revoke Freeze" to complete the process securely. Our platform guarantees a safe and straightforward experience when managing your token permissions.
</p>

            </div>
          </section>
          {/* </SimpleBar> */}
        </div>
      </div>
    </main>
    </>
  );
}
