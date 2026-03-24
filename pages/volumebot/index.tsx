import { useEffect, useRef, useState } from "react";
import { Input, Button } from "@nextui-org/react";
import { toast } from "react-toastify";
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { fetchTokenMetadata, solanaConnection } from "@/lib/utils";
import Faqs from "@/components/faqs";
import Head from "next/head";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getPumpData, pumpfunBumpTxn } from "@/base/pumpfun";
import base58 from "bs58";
import { JitoBundleService } from "@/base/jito/jito";
import { getSignature, sleep } from "@/base/utils";
import { executeRaydiumBuySell, getRaydiumPoolkeys, prepareRaydiumBuySell, raydiumBumpTxn } from "@/base/raydium";
import { moonshotBumpTxn } from "@/base/moonshot";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { getMeteoraDlmmPool, executeMeteBuySell, prepareMeteBuySell } from "@/base/meteora/dlmmSwap";

const DEX_OPTIONS = [
  { id: "raydium", name: "Raydium" },
  { id: "meteora", name: "Meteora" },
];

export default function Home() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [metadata, setMetadata] = useState<any>({
    tokenName: "",
    tokenSymbol: "",
    tokenLogo: "",
  });
  const isBotRunnig = useRef(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [botIsOn, setBotIsOn] = useState(false);
  const [txnHashes, setTxnHashes] = useState<string[]>([]);
  const [selectedDex, setSelectedDex] = useState(DEX_OPTIONS[0].id);
  const [privateKeys, setPrivateKeys] = useState<string[]>([]);

  const [minTxnAmount, setMinTxnAmount] = useState(0);
  const [maxTxnAmount, setMaxTxnAmount] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [txnRate, setTxnRate] = useState(0);

const formatTime = (milliseconds: number) => {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  return `${minutes}m : ${seconds}s`;
};


  useEffect(() => {
    isBotRunnig.current = botIsOn;
    setTimeLeft('');
  }, [botIsOn]);

  const getTokenInfo = async () => {
    try {
      const metadata = await fetchTokenMetadata(tokenAddress);
      console.log(metadata);
      setMetadata(metadata);
    } catch (error: any) {
      setMetadata({
        tokenName: "",
        tokenSymbol: "",
        tokenLogo: "",
      });
      toast.error(error.message);
    }
  };

  const validator = () => {
    if (tokenAddress == "") {
      toast.error("Select the token address!");
      return false;
    }
    if (minTxnAmount <= 0) {
      toast.error("Please enter the correct txn sol amount");
      return false;
    }
    if (maxTxnAmount <= 0) {
      toast.error("Please enter the correct txn sol amount");
      return false;
    }
    if (totalTime <= 0) {
      toast.error("Please enter the correct total time");
      return false;
    }
    if (txnRate <= 0) {
      toast.error("Please enter the correct txn rate");
      return false;
    }
    if (privateKeys.length <= 0 || privateKeys.includes("")) {
      toast.error("Please enter the correct private keys");
      return false;
    }
    return true;
  };

  const getRandomAmount = (min: number, max: number): number => {
    const n = Math.random() * (max - min) + min;
    console.log('random amount', n);
    return n;
  }

  const runVolumebot = async () => {
    try {
      const validationFlag = validator();
      if (validationFlag) {
        setBotIsOn(true);
        setTxnHashes([]);
        const mint = new PublicKey(tokenAddress);
        const _t = privateKeys.length >= 5? 5: 1
        const intervalTime = (1000 * 60 * _t) / txnRate;
        const keypairs = privateKeys.map((pk) =>
          Keypair.fromSecretKey(Uint8Array.from(base58.decode(pk)))
        );

        await sleep(100);
        toast.success("Started the bot...");

        let data: any;
        if(selectedDex === "meteora") {
          data = await prepareMeteBuySell({
            keypairs,
            mint
          });
        }else if (selectedDex === "raydium") {
          data = await prepareRaydiumBuySell({
            keypairs,
            mint,
          });
        }

        const start_t = Date.now();
        const end_t = start_t + (totalTime * 1000 * 60);

        const executeBotLogic = async () => {
          try{
            console.log("running...", Date.now());
            const remaining = end_t - Date.now();

            if (isBotRunnig.current === false || remaining <= 0) {
                if(remaining <= 0)
                    if(isBotRunnig.current)
                        toast.warn("Stopped the bot...");
              setBotIsOn(false);
              clearInterval(intervalId);
              return;
            }
            setTimeLeft(formatTime(remaining));
            // if(selectedDex === "pumpfun"){
            //   volumeData = await getPumpData(mint);
            // }


            const randomTxnAmount = getRandomAmount(minTxnAmount, maxTxnAmount);
            const volumeParams = {
                data,
                mint,
                keypairs,
                amount: randomTxnAmount,
                tip: tipAmount,
            };
            const signatures = selectedDex === "raydium"? 
                await executeRaydiumBuySell(volumeParams)
                : await executeMeteBuySell(volumeParams);
                    // : selectedDex === "meteora"? await raydiumBumpTxn(volumeParams)
                    // : await moonshotBumpTxn(volumeParams);
                 
            // const serializedTxns = vTxns.map((vtxn) => vtxn.serialize());
            // const signatures = vTxns.map((vtxn) => getSignature(vtxn));
            // const jitoInstance = new JitoBundleService();
            // const res = await solanaConnection.simulateTransaction(vTxns[0]);
            // if(res.value.err){
            //   console.log(res.value.err, res.value.logs);
            // }
            // const bundleId = await jitoInstance.sendBundle(serializedTxns);
            // const isSucceed = await jitoInstance.getBundleStatus(bundleId);
            // if (isSucceed) {
              setTxnHashes(prevIds => {
                const newIds = [...prevIds, ...signatures];
                return newIds.slice(-20); // Keep only last 20 elements
              });
              // console.log(`volume ${amount} ${ca} success!`, `BundleId: ${bundleId}`);
            // }
          }catch (e: any){
            setBotIsOn(false);
            clearInterval(intervalId);
            toast.error(e.message);
          }
        }
        let intervalId: any;
        executeBotLogic();
        intervalId = setInterval(executeBotLogic, intervalTime);
      }
    } catch (error: any) {
      setBotIsOn(false);
      toast.error(error.message);
    } 
  };
  const faqData = [
    {
      label: "What is a Liquidity Pool and Why is it Important?",
      description:
        "A liquidity pool is a collection of tokens locked in a smart contract that facilitates trading on decentralized exchanges (DEXs) like those on the Solana blockchain. Liquidity pools are crucial because they provide the necessary liquidity for seamless token trading, ensuring efficient and cost-effective transactions.",
    },

    {
      label: "What are Base and Quote Tokens?",
      description:
        "In a liquidity pool, the base token is the primary token in a trading pair, while the quote token is the secondary token that is traded against it. Both tokens are required in equal values to enable trading within the pool.",
    },

    {
      label: "How Does a Liquidity Pool Work?",
      description:
        "Liquidity pools allow users, known as liquidity providers, to deposit equal amounts of base and quote tokens. These tokens are used to facilitate trades, and in return, liquidity providers earn a share of the trading fees generated by the pool.",
    },

    {
      label: "What are the Benefits and Risks of Providing Liquidity?",
      description:
        "Providing liquidity allows you to earn a portion of trading fees and supports the DeFi ecosystem. However, it also carries risks, such as impermanent loss, which occurs when the price of tokens in the pool changes relative to each other.",
    },

    {
      label: "What are Liquidity Provider (LP) Tokens?",
      description:
        "When you add liquidity to a pool, you receive LP tokens, which represent your share of the pool. These tokens can be used to withdraw your original assets, plus any earned fees, from the pool.",
    },
  ];

  return (
    <>
      <Head>
        <title>Volume Bot</title>
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
              Volume Bot ( Raydium / Meteora )
            </span>

            <div className=" w-full grid grid-cols-12 gap-6 pt-5">
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Enter Token Address:"
                labelPlacement={"outside"}
                placeholder="Put the Token Mint Address"
                value={tokenAddress}
                onChange={(e) => {
                  setTokenAddress(e.target.value);
                }}
                endContent={
                  <div
                    className=" flex gap-3 cursor-pointer items-center"
                    onClick={() => {
                      getTokenInfo();
                    }}
                  >
                    {metadata.tokenSymbol}
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center hover:bg-white">
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[rgb(252,220,77)] "></div>
                      Info
                    </div>
                  </div>
                }
                className=" h-[40px] col-span-12"
              />

              {/* set user setting */}
              <div className="col-span-12 flex gap-3 items-center">
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Min Txn Amount (SOL):"
                  labelPlacement={"outside"}
                  placeholder="Min txn amount"
                  className="h-[40px] w-1/2"
                  min={0}
                  value={minTxnAmount.toString()}
                  onChange={(e) => {
                    setMinTxnAmount(Number(e.target.value));
                  }}
                  endContent={
                    <div className="flex gap-2 text-[13px]">
                      <span
                        className="p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                        onClick={() => setMinTxnAmount(0.00001)}
                      >
                        0.00001
                      </span>
                    </div>
                  }
                />
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Max Txn Amount (SOL):"
                  labelPlacement={"outside"}
                  placeholder="Max txn amount" 
                  className="h-[40px] w-1/2"
                  min={0}
                  value={maxTxnAmount.toString()}
                  onChange={(e) => {
                    setMaxTxnAmount(Number(e.target.value));
                  }}
                  endContent={
                    <div className="flex gap-2 text-[13px]">
                      <span
                        className="p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                        onClick={() => setMaxTxnAmount(0.0001)}
                      >
                        0.0001
                      </span>
                    </div>
                  }
                />
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Jito Tip Amount"
                  labelPlacement={"outside"}
                  placeholder="Put the Txn rate"
                  className=" h-[40px] col-span-5 max-md:col-span-6 max-sm:col-span-12"
                  min={0}
                  value={tipAmount.toString()}
                  onChange={(e) => {
                    setTipAmount(Number(e.target.value));
                  }}
                  endContent={
                    <div className=" flex gap-3 ">
                      <div className=" flex gap-2 text-[13px]">
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTipAmount(0.0001)}
                        >
                          0.0001
                        </span>
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTipAmount(0.00001)}
                        >
                          0.00001
                        </span>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="col-span-12 flex gap-3 items-center">
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Total time (min):"
                  labelPlacement={"outside"}
                  placeholder="Put the total time"
                  className=" h-[40px] col-span-5 max-md:col-span-6 max-sm:col-span-12"
                  min={0}
                  value={totalTime.toString()}
                  onChange={(e) => {
                    setTotalTime(Number(e.target.value));
                  }}
                  endContent={
                    <div className=" flex gap-3 ">
                      <div className=" flex gap-2 text-[13px]">
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTotalTime(60)}
                        >
                          60m
                        </span>
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTotalTime(30)}
                        >
                          30m
                        </span>
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTotalTime(15)}
                        >
                          15m
                        </span>
                      </div>
                    </div>
                  }
                />
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Rate (Txns/min):"
                  labelPlacement={"outside"}
                  placeholder="Put the Txn rate"
                  className=" h-[40px] col-span-5 max-md:col-span-6 max-sm:col-span-12"
                  min={0}
                  value={txnRate.toString()}
                  onChange={(e) => {
                    setTxnRate(Number(e.target.value));
                  }}
                  endContent={
                    <div className=" flex gap-3 ">
                      <div className=" flex gap-2 text-[13px]">
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTxnRate(1000)}
                        >
                          1000
                        </span>
                        <span
                          className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]"
                          onClick={() => setTxnRate(100)}
                        >
                          100
                        </span>
                      </div>
                    </div>
                  }
                />
              </div>

              {/* input user private key */}
             <div className="col-span-12 rounded-xl pt-1">
               <div className="flex flex-col">
                 <div className="text-[14px] sm:text-[11px] md:text-[15px] font-medium mb-1 ml-1">
                   Wallet Private Keys ({privateKeys.length}/20):
                 </div>
                 <div className="flex flex-col gap-3 w-full px-2 pt-3">
                   {/* Add bulk input option */}
                   <Button
                     color="primary"
                     variant="flat"
                     className="text-gray-400 hover:text-white"
                     onClick={() => {
                       const input = document.createElement('input');
                       input.type = 'file';
                       input.accept = '.json,.txt';
                       input.onchange = (e: any) => {
                         const file = e.target.files[0];
                         const reader = new FileReader();
                         reader.onload = (e) => {
                           const text = e.target?.result as string;
                           const keys = text.split(/[\n,]/).map(key => key.trim()).filter(key => key);
                           setPrivateKeys(keys.slice(0, 20));
                         };
                         reader.readAsText(file);
                       };
                       input.click();
                     }}
                   >
                     Import Private Keys
                   </Button>
             
                   {/* Existing individual input fields */}
                   {privateKeys.map((key, index) => (
               <div key={index} className="flex flex-col gap-1">
                 <div className="flex gap-2 items-center">
                   <Input
                     type="password"
                     radius="sm"
                     placeholder="Enter private key"
                     className="h-[40px] flex-grow"
                     value={key}
                     onChange={(e) => {
                       const newKeys = [...privateKeys];
                       newKeys[index] = e.target.value;
                       setPrivateKeys(newKeys);
                     }}
                   />
                   <Button
                     color="danger"
                     variant="light"
                     onClick={() => {
                       setPrivateKeys(privateKeys.filter((_, i) => i !== index));
                     }}
                   >
                     Remove
                   </Button>
                 </div>
                 {key && (
                   <div className="text-xs text-gray-400 ml-2">
                     Public Key: {Keypair.fromSecretKey(Uint8Array.from(bs58.decode(key))).publicKey.toBase58()}
                   </div>
                 )}
               </div>
             ))}
                 </div>
               </div>
             </div>

              {/* set dex */}

              <div className="col-span-12">
                <div className="text-[14px] sm:text-[11px] md:text-[15px] font-medium mb-1 ml-1">
                  Select DEX:
                </div>
                <div className="flex justify-start items-center w-full px-2 pt-3">
                  {DEX_OPTIONS.map((dex, index) => (
                    <button
                      key={dex.id}
                      onClick={() => setSelectedDex(dex.id)}
                      className={`px-4 py-2 transition-colors ${
                        selectedDex === dex.id
                          ? "bg-blue-700 text-white hover:bg-blue-600"
                          : "bg-[#2a3447] text-gray-300 hover:bg-blue-600"
                      } ${index === 0 ? "rounded-l-lg" : ""} ${
                        index === DEX_OPTIONS.length - 1 ? "rounded-r-lg" : ""
                      }`}
                    >
                      {dex.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-12 flex flex-col gap-3">
              {botIsOn && (
                  <div className="flex items-center justify-center gap-2 text-green-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Bot Running
                  </div>
                )}
                <Button
                  color="primary"
                  fullWidth
                  className=" text-[18px]"
                  onClick={() => {
                    if(botIsOn)
                      toast.warn("Stopped the bot...");
                    botIsOn ? setBotIsOn(false): runVolumebot();
                  }}
                >
                  {botIsOn ? `Stop Bot (${timeLeft})` : "Run Bot"}
                </Button>
                {txnHashes.length > 0 && (
                  <div className="flex flex-col items-start gap-4 mt-4 w-full p-4 bg-[#1a1f2e] rounded-xl">
                    <div className="text-sm font-semibold text-gray-300">{txnHashes.length} Recent transaction links:</div>
                    <div className="flex flex-col gap-2 w-full">
                    {txnHashes.map((signature, index) => (
                          <div key={index} className="flex items-center gap-2 w-full">
                            <span className="text-gray-400 text-sm min-w-[24px]">{index}.</span>
                            <a 
                              href={`https://solscan.io/tx/${signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-[#2a3447] hover:bg-[#3a4457] rounded-lg text-sm font-mono w-full 
                              text-blue-400 hover:text-blue-300 transition-colors truncate"
                            >
                              {window.innerWidth < 768 ? `${signature.slice(0,16)}...${signature.slice(-8)}` : signature}
                            </a>
                          </div>
                        ))}

                    </div>
                  </div>
                )}
              </div>
            </div>

            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
                <h6 className="text-2xl pt-10">
                  Solana Liquidity Pool Creator
                </h6>
                <p className="text-base1">
                  Easily create and manage liquidity pools on the Solana
                  blockchain with our user-friendly platform. Select your base
                  and quote tokens, set the desired amounts, and customize
                  advanced options like market event queue length and order book
                  length.
                </p>
                <p className="text-base1">
                  No blockchain expertise is required—our platform simplifies
                  the process so anyone can create and manage pools
                  effortlessly. All transactions and pool data are secured with
                  our on-chain smart contracts, ensuring the safety of your
                  assets.
                </p>
                <p className="text-base1">
                  Set up your liquidity pool in minutes, tailored to your
                  project’s specific needs. Our goal is to provide a seamless
                  and efficient experience for all users.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
