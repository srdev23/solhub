import { useState, useEffect } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  Input,
  Button,
  Select,
  SelectItem,
  SelectedItems,
} from "@nextui-org/react";
import { toast } from "react-toastify";
import {
  solanaConnection,
  getTokenList,
} from "@/lib/utils";
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { SelectorIcon } from "@/components/SelectorIcon";
import Faqs from "@/components/faqs";
import Head from "next/head";
import { CiCirclePlus } from "react-icons/ci";
import { NATIVE_MINT } from "@solana/spl-token";
import { WSOL_ADDRESS } from "@/lib/constant";

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
  const [loading, setLoading] = useState(false);
  const [tokenList, setTokenList] = useState<TokenData[]>([]);
  const [fetchFlag, setFetchFlag] = useState(false);

  const [baseMint, setBaseMint] = useState<string>("");
  const [quoteMint, setQuoteMint] = useState<string>("");
  const [quoteAmount, setQuoteAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
 
  const getNfts = async () => {
    if (!anchorWallet) return [];
    setFetchFlag(true);
    const list = await getTokenList(anchorWallet.publicKey);
    setFetchFlag(false);
    setTokenList(list);
  };

  useEffect(() => {
    (async () => {
      await getNfts();
    })();
  }, [anchorWallet]);

  const changeQuote = async (mintAddress: string) => {
    const filtered: any = tokenList.filter(
      (item: any) => item.mint == mintAddress
    );

    if (filtered.length > 0 && anchorWallet) {
        setQuoteMint(mintAddress);
      console.log("filter==>>", filtered);
    }
  };

  const changeBase = async (mintAddress: string) => {
    console.log("mintAddress==>>", mintAddress);
    const filtered: any = tokenList.filter(
      (item: any) => item.mint == mintAddress
    );

    if (filtered.length > 0 && anchorWallet) {
      // if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setBaseMint(mintAddress);
      // } else {
        // setBaseToken("");
      // }
      console.log("filter==>>", filtered);
    }
  };

  const createPoolTx = async () => {
    if (!wallet.publicKey) {
      toast.error("Please connect your wallet!");
      return;
    }

    if (baseMint == "") {
      toast.error("You shoule select base token!");
      return;
    }

    if (quoteMint == "") {
      toast.error("You shoule select quote token!");
      return;
    }

    if (baseMint === quoteMint) {
      toast.error("You shoule select two different tokens as base & quote token!");
      return;
    }

    if (baseAmount <= 0 || quoteAmount <= 0) {
      toast.error("Base and Quote token amounts should be larger than zero");
      return;
    }

    setLoading(true);
    // Example frontend call
    const response = await fetch('/api/meteora/createPool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        params: {
          owner: anchorWallet?.publicKey.toBase58(),
          baseMint,
          quoteMint,
          baseAmount,
          quoteAmount
        }
      })
    });
    const data = await response.json();
    if(response.status !== 200){
      setLoading(false);
      toast.error(data.error);
      return;
    }
    if (data) {
      if (anchorWallet) {
        try {
          const txnBuffer = Buffer.from(data.txn, "base64");
          //@ts-ignore
          const txn = VersionedTransaction.deserialize(txnBuffer);
          let serializedTxn = (await anchorWallet.signTransaction(txn)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const signature = await solanaConnection.sendRawTransaction(
            serializedTxn,
            options
          );
          const txnRes = await solanaConnection.confirmTransaction(signature, "confirmed");
          if(txnRes.value.err)
            toast.error("Transaction failed, please check your wallet token balances");
          else
            toast.success(`Pool ID: ${data.poolId} created successfully! `);
          console.log("transaction signature ======>>", signature);
          setLoading(false);
        } catch (error: any) {
          toast.error(`${error.message}`);
          setLoading(false);
        }
      }
    }
  };
  const faqData = [
    {
      label: "What is an Meteora Amm Pool on Solana?",
      description:
        "An Meteora Amm Pool on Solana is a decentralized marketplace where users can trade tokens directly. It uses an order book to match buyers and sellers, providing transparency and efficiency in trading.",
    },
    {
      label: "How do I select the Base and Quote Tokens?",
      description:
        "To create your market, simply choose the Base Token, which is the primary asset, and the Quote Token, which is the secondary asset used for trading. These tokens form the trading pair in your Meteora Amm Pool.",
    },
    {
      label: "What do the advanced options do?",
      description:
        "Advanced options allow you to customize your market by setting parameters like Event Queue Length, Request Queue Length, and Order Book Length. These settings control how your market processes and manages trades.",
    },

    {
      label: "Can I modify my market settings after creation?",
      description:
        "Once your Meteora Amm Pool is created, the settings like queue lengths and order book length are locked in. Make sure to review your options carefully before finalizing your market.",
    },
  ];

  return (
    <>
      <Head>
        <title>Create Meteora Amm Pool</title>
        <meta
          name="description"
          content="This is the home page of my awesome website."
        />
      </Head>
      <main
        className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}
      >
        <Header />
        <div className=" w-full h-full flex gap-6">
          <ProSidebar />
          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto    rounded-xl justify-start flex items-center flex-col">
            <span className="text-center w-full text-[25px] flex justify-center font-bold">
              Create Meteora Amm Pool
            </span>
            <div className=" w-full grid grid-cols-12 gap-6 pt-10">
              <Select
                isRequired
                label="Base Token"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList.filter(
                  (item: any) =>
                    item.mint !== WSOL_ADDRESS
                )}
                isLoading={fetchFlag}
                className="col-span-6 max-sm:col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => {
                  changeBase(e.target.value);
                }}
                renderValue={(items: SelectedItems<any>) => {
                  return items.map((item: any) => (
                    <div
                      key={item.data.mint}
                      className="flex items-center gap-2 w-full justify-between font-IT"
                    >
                      <img
                        src={
                          item.data.mint !==
                          WSOL_ADDRESS
                            ? item.data.image
                            : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
                        }
                        alt=""
                        className="w-[30px] h-[30px]"
                      />
                      <div className="flex flex-col items-center w-full">
                        <div className="truncate text-xs">
                          {item.data.tokenName || item.data.symbol}
                        </div>{" "}
                        {/* Smaller Token Name or Symbol */}
                        <div className="text-s text-gray-400 font-medium">{`${item.data.mint.slice(
                          0,
                          4
                        )}...${item.data.mint.slice(-4)}`}</div>{" "}
                        {/* Smaller Mint Address with lighter color */}
                      </div>
                    </div>
                  ));
                }}
              >
                {(item) => (
                  <SelectItem key={item.mint} textValue={item.updateAuthority}>
                    <div className="flex items-center gap-2 w-full font-IT">
                      <img
                        src={
                          item.mint !==
                          WSOL_ADDRESS
                            ? item.image
                            : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
                        }
                        alt=""
                        className="w-[30px] h-[30px]"
                      />
                      <div className="flex flex-col items-center w-full">
                        <div className="truncate text-s">
                          {item.tokenName || item.tokenSymbol}
                        </div>{" "}
                        {/* Smaller Token Name or Symbol */}
                        <div className="text-s text-gray-400 font-medium">{`${item.mint.slice(
                          0,
                          4
                        )}...${item.mint.slice(-4)}`}</div>{" "}
                        {/* Smaller Mint Address with lighter color */}
                      </div>
                    </div>
                  </SelectItem>
                )}
              </Select>

              <Select
                isRequired
                label="Quote Token"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList.filter(
                  (item: any) =>
                    item.mint !== baseMint
                )}
                isLoading={fetchFlag}
                className=" col-span-6 max-sm:col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => {
                  changeQuote(e.target.value);
                }}
                renderValue={(items: SelectedItems<any>) => {
                  return items.map((item: any) => (
                    <div
                      key={item.data.mint}
                      className="flex items-center gap-2 w-full justify-between font-IT"
                    >
                      <img
                        src={
                          item.data.mint !==
                          "So11111111111111111111111111111111111111112"
                            ? item.data.image
                            : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
                        }
                        alt=""
                        className="w-[30px] h-[30px]"
                      />
                      <div className="flex flex-col items-center w-full">
                        <div className="truncate text-xs">
                          {item.data.tokenName || item.data.symbol}
                        </div>{" "}
                        {/* Smaller Token Name or Symbol */}
                        <div className="text-s text-gray-400 font-medium">{`${item.data.mint.slice(
                          0,
                          4
                        )}...${item.data.mint.slice(-4)}`}</div>{" "}
                        {/* Smaller Mint Address with lighter color */}
                      </div>
                    </div>
                  ));
                }}
              >
                {(item) => (
                  <SelectItem key={item.mint} textValue={item.updateAuthority}>
                    <div className="flex items-center gap-2 w-full font-IT">
                      <img
                        src={
                          item.mint !==
                          NATIVE_MINT.toBase58()
                            ? item.image
                            : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
                        }
                        alt=""
                        className="w-[30px] h-[30px]"
                      />
                      <div className="flex flex-col items-center w-full">
                        <div className="truncate text-s">
                          {item.tokenName || item.tokenSymbol}
                        </div>{" "}
                        {/* Smaller Token Name or Symbol */}
                        <div className="text-s text-gray-400 font-medium">{`${item.mint.slice(
                          0,
                          4
                        )}...${item.mint.slice(-4)}`}</div>{" "}
                        {/* Smaller Mint Address with lighter color */}
                      </div>
                    </div>
                  </SelectItem>
                )}
              </Select>
              <div className=" col-span-12 grid grid-cols-11 max-sm:grid-cols-12 gap-5 ">
                              <Input
                                isRequired
                                type="number"
                                radius="sm"
                                label="Base Token Amount:"
                                labelPlacement={'outside'}
                                placeholder="Put the base token amount"
                                className=" h-[40px] col-span-5 max-sm:col-span-6 max-esm:col-span-12"
                                min={0}
                                value={baseAmount.toString()}
                                onChange={(e) => { setBaseAmount(Number(e.target.value)) }}
                                // endContent={
                                //   <div className=" flex gap-3 ">
                                  //   {/* <div className=" flex gap-2 text-[13px]">
                                  //   <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Max</span>
                                  //   <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Half</span>
                                  // </div> */}
                                    // {/* <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center h-fit" >
                                    //   {baseMint.tokenLogo ? <img src={baseMint.tokenLogo} alt="" className="h-[20px] w-[20px]" /> : <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>}
                                    //   {baseMint.tokenSymbol ? baseMint.tokenSymbol : "Base"}
                                    // </div> */}
              
                                  // </div>
                                // }
                              />
                              <div className=" col-span-1 items-center justify-center flex mt-6 max-sm:hidden">
                                <CiCirclePlus className=" text-[40px]" />
                              </div>
                              <Input
                                isRequired
                                type="number"
                                radius="sm"
                                label="Quote Token Amount:"
                                labelPlacement={'outside'}
                                placeholder="Put the quote token amount"
                                className=" h-[40px] col-span-5 max-sm:col-span-6 max-esm:col-span-12"
                                min={0}
                                value={quoteAmount.toString()}
                                onChange={(e) => { setQuoteAmount(Number(e.target.value)) }}
                                // endContent={
                                //   <div className=" flex gap-3">
                                //     {/* <div className=" flex gap-2 text-[13px]">
                                //     <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Max</span>
                                //     <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Half</span>
                                //   </div> */}
                                //     <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center w-fit h-fit" >
                                //       {quoteMint.tokenLogo ? <img src={quoteMint.tokenLogo} alt="" className="h-[20px] w-[20px]" /> : <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#4d5ffc]"></div>}
                                //       {quoteMint.tokenSymbol ? quoteMint.tokenSymbol : "Quote"}
                                //     </div>
                                //   </div>
                                // }
                              />
                            </div>
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button
                  color="primary"
                  isLoading={loading}
                  fullWidth
                  className=" text-[18px]"
                  onClick={() => {
                    createPoolTx();
                  }}
                >
                  Create Pool
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
                <h6 className="text-2xl pt-10">
                  Solana Meteora Amm Pool Creator
                </h6>
                <p className="text-base1">
                  To create an Meteora Amm Pool on the Solana blockchain, start
                  by selecting your base and quote tokens. Enter the desired
                  token amount and specify the amount of SOL required.
                </p>
                <p className="text-base1">
                  You can also access advanced options to customize your market.
                  This includes selecting a standard Meteora Amm Pool, setting
                  the event queue length, request queue length, and order book
                  length.
                </p>
                <p className="text-base1">
                  Once you've configured these settings, click "Create Market"
                  to launch your Meteora Amm Pool securely, with all transactions
                  protected by on-chain smart contracts.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
