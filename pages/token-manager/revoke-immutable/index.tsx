import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Button, Select, SelectItem, SelectedItems } from "@nextui-org/react";
import { makeImmutableToken } from "@/lib/txHandler";
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
  const [imToken, setIMToken] = useState("");
  const [imLoading, setIMLoading] = useState(false);
  const [tokenMeta, setTokenMeta] = useState<any>();
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

  const changeIMAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setTokenMeta(filtered[0]);
        setUpdateAuth(false);
        setIMToken(mintAddress);
      } else {
        setTokenMeta({});
        setIMToken("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }

  const makeIMToken = async () => {
    if (!wallet.publicKey) {
        toastError("Wallet not connected!");
        return;
    }

    if (imToken === "") {
        toastError("You don't have authority for this token!");
        return;
    }

    setIMLoading(true);

    try {
        // Attempt to make the token immutable
        const tx = await makeImmutableToken({
            mint: new PublicKey(imToken),
            tokenMeta,
            url: "mainnet",
            wallet: anchorWallet,
        });

        if (tx && anchorWallet) {
            try {
                const stx = (await anchorWallet.signTransaction(tx)).serialize();

                const options = {
                    commitment: "confirmed",
                    skipPreflight: true,
                };

                const txId = await solanaConnection.sendRawTransaction(stx, options);
                await solanaConnection.confirmTransaction(txId, "confirmed");

                setIMLoading(false);
                toastSuccess(`Made the token immutable!`);
                console.log("txId======>>", txId);

            } catch (error: any) {
                toastError(`${error.message}`);
                setIMLoading(false);
            }
        }
    } catch (error: any) {
        // Handle specific error when token is already immutable
        if (error.message.includes("This token is already immutable")) {
            toastError("This token is already immutable. No further action is needed.");
        } else {
            toastError(`Failed to make the token immutable: ${error.message}`);
        }
        setIMLoading(false);
    }
};

  const faqData = [
    {
      label: 'What does it mean to make a token immutable?',
      description: "Making a token immutable means revoking its update authority, which prevents any further changes to the token's metadata, such as its name, symbol, or other properties. Once a token is made immutable, its details are permanently fixed."
  },
  {
      label: 'Why should I make my token immutable?',
      description: "Making your token immutable is a crucial step in ensuring its security and stability. By revoking the update authority, you prevent any future alterations that could affect the token's integrity or confuse holders."
  },
  {
      label: 'How do I make a token immutable?',
      description: "To make a token immutable, simply select the token address from which you want to revoke the update authority and click 'Make Token Immutable.' This action is irreversible, so ensure you are ready to lock in the token's details permanently."
  },
  {
      label: 'What are the consequences of making a token immutable?',
      description: "Once a token is made immutable, no further changes can be made to its metadata. This locks the token's identity permanently, providing consistency and security for your project and its holders."
  },
  {
      label: 'Is it safe to make a token immutable?',
      description: "Yes, making a token immutable is safe and is processed through on-chain smart contracts, ensuring that your decision is securely implemented on the Solana blockchain."
  },
  
]

  return (
    <>
     <Head>
        <title>Make Token Immutable</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
    <main
      className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}
    >
      <Header />
      <div className=" w-full h-full flex gap-6">
        <ProSidebar />
        <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto    rounded-xl justify-start flex items-start flex-col">
          {/* <SimpleBar forceVisible="x" autoHide={true} className="w-full h-[700px] px-6"> */}
           
            <span className="text-center w-full text-[25px] flex justify-center font-bold "> Make Token Immutable</span>
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
                onChange={(e) => { changeIMAuth(e.target.value); }}
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
                <Button color="primary" isLoading={imLoading} fullWidth className=" text-[18px]" onClick={() => { makeIMToken() }}>
                  Make Token Immutable
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
            <Faqs faqData={faqData}/>
            <div>
            <h6 className="text-2xl pt-10">
    Make Token Immutable
</h6>
<p className="text-base1">
    Use our Make Token Immutable tool to revoke the update authority on your tokens, making them immutable on the Solana blockchain. Start by selecting the token address for which you want to revoke the update authority.
</p>
<p className="text-base1">
    The update authority allows modifications to the token's metadata, such as changing the token's name, symbol, or other properties. By making the token immutable, you prevent any future changes to its metadata, ensuring its details remain fixed.
</p>
<p className="text-base1">
    Once you've selected the token address, click "Make Token Immutable" to finalize the process securely. This action permanently locks the token's metadata, providing added security and consistency for your token's identity.
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
