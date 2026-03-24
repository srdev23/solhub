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


const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "elephant", label: "Elephant" },
  { key: "lion", label: "Lion" },
  { key: "tiger", label: "Tiger" },
  { key: "giraffe", label: "Giraffe" },
  { key: "dolphin", label: "Dolphin" },
  { key: "penguin", label: "Penguin" },
  { key: "zebra", label: "Zebra" },
  { key: "shark", label: "Shark" },
  { key: "whale", label: "Whale" },
  { key: "otter", label: "Otter" },
  { key: "crocodile", label: "Crocodile" }
];

export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [tokenAddress, setTokenAddress] = useState("");
  const [lpWallet, setLpWallet] = useState("");
  const [keypair, setKeypair] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [started, setStarted] = useState(false);
  const [stopFlag, setStopFlag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenList, setTokenList] = useState<TokenData[]>([]);
  const [mintLoading, setMintLoading] = useState(false);
  const [updateAuth, setUpdateAuth] = useState(true);
  const [updateTokenMint, setUpdateTokenMint] = useState("");
  const [rfToken, setRFToken] = useState("");
  const [rmToken, setRMToken] = useState("");
  const [imToken, setIMToken] = useState("");
  const [rfLoading, setRFLoading] = useState(false);
  const [rmLoading, setRMLoading] = useState(false);
  const [imLoading, setIMLoading] = useState(false);
  const [tokenMeta, setTokenMeta] = useState<any>();
  const [fetchFlag, setFetchFlag] = useState(false);

  // Mint Section

  const [mintTokenSupply, setMintTokenSupply] = useState(100000);

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

  const changeUpadeteAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setUpdateAuth(false);
        setUpdateTokenMint(mintAddress);
      } else {
        setUpdateTokenMint("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }


  


  const addToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!");
      return;
    }
  
    if (updateTokenMint == "") {
      toastError("You don't have authority for this token!");
      return;
    }
  
    setMintLoading(true);
  
    try {
      const tx = await mintToken({
        mint: new PublicKey(updateTokenMint),
        url: "mainnet",
        mintingAmount: mintTokenSupply,
        wallet: anchorWallet,
      });
  
      if (tx) {
        if (anchorWallet) {
          try {
            let stx = (await anchorWallet.signTransaction(tx)).serialize();
  
            const options = {
              commitment: "confirmed",
              skipPreflight: true,
            };
  
            const txId = await solanaConnection.sendRawTransaction(stx, options);
            await solanaConnection.confirmTransaction(txId, "confirmed");
            toastSuccess(`${mintTokenSupply} token minted successfully!`);
            console.log("txId======>>", txId);
          } catch (error: any) {
            toastError(`${error.message}`);
          }
        }
      }
    } catch (error: any) {
      toastError(`Error in minting process: ${error.message}`);
    } finally {
      setMintLoading(false); // Ensure the loading state is reset
    }
  };
  

 



  const faqData = [
    { label: 'What is Token Minting?', description: "Token minting is the process of creating new tokens on a blockchain, in this case, the Solana blockchain. These tokens can represent various assets or utilities and can be customized to suit your project’s needs." },
    { label: 'How do I mint tokens on Solana?', description: "To mint tokens on Solana using our platform, simply select the token you want to create, enter the desired amount, and click 'Mint.' Our user-friendly interface guides you through the process without requiring technical expertise." },
    { label: 'Is it secure to mint tokens?', description: "Yes, minting tokens on our platform is secure. All transactions and token data are safeguarded by our on-chain smart contract, ensuring your assets are protected throughout the minting process." },
    
  ]

  return (
    <>
      <Head>
        <title>Token Mint</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
      <main
        className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}
      >
        <Header />
        <div className=" w-full h-full flex gap-6">
          <ProSidebar />
          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border custom-scrollbar h-[84vh] overflow-y-auto  rounded-xl ">
            {/* <SimpleBar forceVisible="x" autoHide={true} className="w-full h-[700px] px-6"> */}
            <span className="text-center w-full text-[25px] flex justify-center font-bold "> Token Mint</span>
            <div className=" w-full grid grid-cols-12 gap-4 pt-10" >
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
                onChange={(e) => { changeUpadeteAuth(e.target.value); }}
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
              <Input
                isRequired
                type="number"
                radius="sm"
                defaultValue="100000"
                label="How much supply you want to mint:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-12"
                onChange={(e) => { setMintTokenSupply(Number(e.target.value)); }}
              />
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" isLoading={mintLoading} fullWidth className=" text-[18px]" onClick={() => { addToken() }}>
                  Mint Token
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
              <h6 className="text-2xl pt-10">
    Token Mint
</h6>
<p className="text-base1">
    Mint new tokens effortlessly on the Solana blockchain using our Token Mint tool. Start by selecting the token address you want to mint tokens for.
</p>
<p className="text-base1">
    Next, enter the amount of token supply you wish to generate. This will define the total number of tokens that will be added to the specified token address.
</p>
<p className="text-base1">
    Once you’ve entered the required information, click "Mint Token" to securely create your new tokens. Our platform ensures a smooth and secure minting process, making token creation quick and easy.
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
