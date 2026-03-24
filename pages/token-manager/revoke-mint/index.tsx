import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Button, Select, SelectItem, SelectedItems } from "@nextui-org/react";
import { removeMintAuth } from "@/lib/txHandler";
import { solanaConnection, getTokenList } from "@/lib/utils";
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
  tokenName?: string; // Optional since it might not always be available
  tokenSymbol?: string; // Optional since it might not always be available
  tokenLogo?: string; // Optional since it might not always be available
  updateAuthority?: string; // Optional since it might not always be available
  image?: string; // Optional since it might not always be available
}


export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [tokenList, setTokenList] = useState<TokenData[]>([]);
  const [updateAuth, setUpdateAuth] = useState(true);
  const [rmToken, setRMToken] = useState("");
  const [rmLoading, setRMLoading] = useState(false);
  const [fetchFlag, setFetchFlag] = useState(false);

  // Mint Section
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

  const changeRMAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setUpdateAuth(false);
        setRMToken(mintAddress);
      } else {
        setRMToken("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }


  const removeMintToken = async () => {
    if (!wallet.publicKey) {
        toastError("Wallet not connected!");
        return;
    }
  
    if (rmToken === "") {
        toastError("You don't have authority for this token!");
        return;
    }
  
    setRMLoading(true);
  
    try {
        console.log("Attempting to remove mint authority for token:", rmToken);
  
        // Call removeMintAuth, which returns the signed transaction
        const signedTx = await removeMintAuth({
            mint: new PublicKey(rmToken),
            url: "mainnet",
            wallet: anchorWallet,
        });
  
        if (signedTx) {
            console.log("Transaction created and signed. Attempting to send it.");
  
            // Send and confirm the signed transaction
            const options = {
                commitment: "confirmed",
                skipPreflight: true,
            };
  
            const txId = await solanaConnection.sendRawTransaction(signedTx.serialize(), options);
            await solanaConnection.confirmTransaction(txId, "confirmed");
  
            console.log("Transaction sent and confirmed with txId:", txId);
  
            toastSuccess("Revoked mint authority successfully!");
        }
    } catch (error: any) {
      if (error.message.includes("already revoked")) {
          toastError("Mint authority is already revoked.");
      } else {
          toastError(`Failed to revoke mint authority: ${error.message}`);
      }
    } finally {
        setRMLoading(false);
    }
  };
  
  



  const faqData = [
    {
      label: 'What is Mint Authority?',
      description: "Mint Authority is the permission that allows an account to create new tokens. This authority can be used to increase the total supply of a token by minting additional tokens."
  },
  {
      label: 'Why should I revoke Mint Authority?',
      description: "Revoking Mint Authority ensures that no additional tokens can be minted, protecting the total supply from further changes. This is especially important for maintaining the value and scarcity of your token."
  },
  {
      label: 'How do I revoke Mint Authority?',
      description: "To revoke Mint Authority, simply select the token address for which you want to remove minting permissions and click 'Revoke Mint.' This action is permanent, so be certain of your decision."
  },
  {
      label: 'What are the consequences of revoking Mint Authority?',
      description: "Once Mint Authority is revoked, no more tokens can be created for that specific token. This makes the total supply of the token fixed and unchangeable."
  },
  {
      label: 'Is it safe to revoke Mint Authority?',
      description: "Yes, revoking Mint Authority is safe and is processed through on-chain smart contracts, ensuring that your decision is securely executed on the Solana blockchain."
  },
  
]

  return (
    <>
     <Head>
        <title>Revoke Mint Authority</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
    <main
      className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}>
      <Header />
      <div className=" w-full h-full flex gap-6">
        <ProSidebar />
        <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto    rounded-xl justify-start flex items-start flex-col">
          {/* <SimpleBar forceVisible="x" autoHide={true} className="w-full h-[700px] px-6"> */}
            <span className="text-center w-full text-[25px] flex justify-center font-bold"> Revoke Mint Authority</span>
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
                onChange={(e) => { changeRMAuth(e.target.value); }}
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
                <Button color="primary" isLoading={rmLoading} fullWidth className=" text-[18px]" onClick={() => { removeMintToken() }}>
                  Revoke Mint
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
            <Faqs faqData={faqData}/>
            <div>
            <h6 className="text-2xl pt-10">
    Revoke Mint Authority
</h6>
<p className="text-base1">
    Use our Revoke Mint Authority tool to remove the minting authority from your tokens on the Solana blockchain. Start by selecting the token address from which you want to revoke the mint authority.
</p>
<p className="text-base1">
    The mint authority is a permission that allows an account to create new tokens. By revoking this authority, you ensure that no additional tokens can be minted, protecting the total supply from further changes.
</p>
<p className="text-base1">
    Once you’ve selected the token address, click "Revoke Mint" to securely complete the process. Our platform provides a safe and efficient way to manage your token permissions.
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
