import { useState, useEffect } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Input, useDisclosure, Switch, Button, Select, SelectItem, DatePicker, SelectedItems } from "@nextui-org/react";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { createMarket, createRaydiumAmmPool } from "@/lib/txHandler";
import { solanaConnection, devConnection, truncateText, getTokenList } from "@/lib/utils";
import { CiCirclePlus } from "react-icons/ci";
import { SelectorIcon } from "@/components/SelectorIcon";
import { DateValue, now, parseAbsoluteToLocal } from "@internationalized/date";
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

const standList = [
  { key: "0", label: "2.8 SOL" },
  { key: "1", label: "1.5 SOL" },
  { key: "2", label: "0.4 SOL" },
];

const lengthList = [
  { event: 2978, request: 63, order: 909 },
  { event: 1400, request: 63, order: 450 },
  { event: 128, request: 9, order: 201 }
];

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

  const [tokenAddress, setTokenAddress] = useState("");
  const [lpWallet, setLpWallet] = useState("");
  const [keypair, setKeypair] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [started, setStarted] = useState(false);
  const [stopFlag, setStopFlag] = useState(false);
  const [marketloading, setMarketLoading] = useState(false);
  const [lpLoading, setLpLoading] = useState(false);
  const [tokenList, setTokenList] = useState<TokenData[]>([]);

  // Open Book Market Section

  const [baseToken, setBaseToken] = useState("");
  const [quoteToken, setQuoteToken] = useState("");
  const [baseTokenMeta, setBaseTokenMeta] = useState<any>();
  const [quoteTokenMeta, setQuoteTokenMeta] = useState<any>();
  const [orderSize, setMinOrderSize] = useState(1);
  const [tickSize, setTickSize] = useState(0.0001);
  const [standard, setStandard] = useState(1);
  const [eventLength, setEventLength] = useState(2978);
  const [requestLength, setRequestLength] = useState(63);
  const [orderBookLength, setOrderBookLength] = useState(909);
  const [marketID, setMarketID] = useState("");

  // LP Section
  const [baseTokenAmount, setBaseTokenAmount] = useState(0);
  const [quoteTokenAmount, setQuoteTokenAmount] = useState(0);

  // Sell Token

  const [isSelected, setIsSelected] = useState(true);
  const [isTimeSelected, setIsTimeSelected] = useState(true);
  const [fetchFlag, setFetchFlag] = useState(false);

  const currentDate = new Date();
  let [date, setDate] = useState<DateValue>(parseAbsoluteToLocal(currentDate.toISOString()));

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

  const changeBase = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      setBaseToken(mintAddress);
      setBaseTokenMeta(filtered[0]);
    } else {
      setBaseToken("");
      setBaseTokenMeta({});
    }
  }

  const changeStandard = async (value: string) => {
    setEventLength(lengthList[Number(value)].event);
    setRequestLength(lengthList[Number(value)].request);
    setOrderBookLength(lengthList[Number(value)].order);
  }

  const changeQuote = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      setQuoteToken(mintAddress);
      setQuoteTokenMeta(filtered[0]);
    } else {
      setQuoteToken("");
      setQuoteTokenMeta({});
    }
  }

  const createMarketTx = async () => {
    if (!wallet.publicKey) {
        toastError("Wallet not connected!");
        return;
    }

    if (baseToken === "") {
        toastError("You should select a base token!");
        return;
    }

    if (!anchorWallet) {
        toastError("Wallet not connected!");
        return;
    }

    if (quoteToken === "") {
        toastError("You should select a quote token!");
        return;
    }

    try {
        setMarketLoading(true);

        let baseMint = new PublicKey(baseToken);
        let quoteMint: PublicKey;

        // Use the native SOL public key for the quote token
        if (quoteToken === "Native SOL") {
            quoteMint = new PublicKey("So11111111111111111111111111111111111111112"); // The mint address for native SOL
        } else {
            quoteMint = new PublicKey(quoteToken);  // Use the selected quote token
        }

        const res = await createMarket({
            baseMint,
            quoteMint,
            url: "mainnet",
            orderSize,
            priceTick: tickSize,
            wallet: anchorWallet,
            eventLength,
            requestLength,
            orderBookLength,
        });

        if (res) {
            try {
                setMarketID(res.marketId);

                // Handle transaction 1
                let stx1 = (await anchorWallet.signTransaction(res.tx1)).serialize();
                const options = { commitment: "confirmed", skipPreflight: true };
                const txId1 = await solanaConnection.sendRawTransaction(stx1, options);
                await solanaConnection.confirmTransaction(txId1, "confirmed");
                console.log("txId1======>>", txId1);

                // Handle transaction 2
                let stx2 = (await anchorWallet.signTransaction(res.tx2)).serialize();
                const txId2 = await solanaConnection.sendRawTransaction(stx2, options);
                await solanaConnection.confirmTransaction(txId2, "confirmed");
                console.log("txId2======>>", txId2);

                // Handle transaction 3
                let stx3 = (await anchorWallet.signTransaction(res.tx3)).serialize();
                const txId3 = await solanaConnection.sendRawTransaction(stx3, options);
                await solanaConnection.confirmTransaction(txId3, "confirmed");
                console.log("txId3======>>", txId3);

                toastSuccess(`MarketID: ${res.marketId} created successfully!`);

                setMarketLoading(false);
                setLpLoading(true);

                // Creating the Liquidity Pool
                const res1 = await createRaydiumAmmPool({
                    marketId: new PublicKey(res.marketId),
                    baseMintAmount: baseTokenAmount,
                    url: "mainnet",
                    quoteMintAmount: quoteTokenAmount,
                    wallet: anchorWallet,
                    launchTime: date,
                });

                if (res1) {
                    try {
                        let stx = (await anchorWallet.signTransaction(res1.tx)).serialize();
                        const txId = await solanaConnection.sendRawTransaction(stx, options);
                        await solanaConnection.confirmTransaction(txId, "confirmed");
                        console.log("txId======>>", txId);
                        toastSuccess(`PoolID: ${res1.poolId} created successfully!`);
                    } catch (error: any) {
                        toastError(`${error.message}`);
                        setMarketID("");
                    } finally {
                        setLpLoading(false);
                    }
                }
            } catch (error: any) {
                toastError(`${error.message}`);
                setMarketID("");
            } finally {
                setMarketLoading(false);
            }
        }
    } catch (error: any) {
        toastError(`${error.message}`);
        setMarketID("");
        setMarketLoading(false);
    }
};


  const validator = async () => {
    if (baseToken == "") {
      toastError("Select the base token!")
      return false;
    }
    if (quoteToken == "") {
      toastError("Select the quote token!")
      return false;
    }
    if (orderSize <= 0) {
      toastError("Please enter the correct order size");
      return false;
    }
    if (tickSize <= 0) {
      toastError("Please enter the correct ticker size");
      return false;
    }
    if (baseTokenAmount <= 0) {
      toastError("Please enter the correct base token amount");
      return false;
    }
    if (quoteTokenAmount <= 0) {
      toastError("Please enter the correct quote token amount");
      return false;
    }
    if (baseToken == quoteToken) {
      toastError("Base token is same with quote token!")
      return false;
    }
    
    return true;
  }

  const createLP = async () => {

    const validationFlag = await validator();
    if (validationFlag == false) {
      return;
    }
    await createMarketTx();
  }
  const faqData = [
    { label: 'What is a Liquidity Pool and Why is it Important?', description: "A liquidity pool is a collection of tokens locked in a smart contract that facilitates trading on decentralized exchanges (DEXs) like those on the Solana blockchain. Liquidity pools are crucial because they provide the necessary liquidity for seamless token trading, ensuring efficient and cost-effective transactions." },

    { label: 'What are Base and Quote Tokens?', description: "In a liquidity pool, the base token is the primary token in a trading pair, while the quote token is the secondary token that is traded against it. Both tokens are required in equal values to enable trading within the pool." },
    
    { label: 'How Does a Liquidity Pool Work?', description: "Liquidity pools allow users, known as liquidity providers, to deposit equal amounts of base and quote tokens. These tokens are used to facilitate trades, and in return, liquidity providers earn a share of the trading fees generated by the pool." },
    
    { label: 'What are the Benefits and Risks of Providing Liquidity?', description: "Providing liquidity allows you to earn a portion of trading fees and supports the DeFi ecosystem. However, it also carries risks, such as impermanent loss, which occurs when the price of tokens in the pool changes relative to each other." },
    
    { label: 'What are Liquidity Provider (LP) Tokens?', description: "When you add liquidity to a pool, you receive LP tokens, which represent your share of the pool. These tokens can be used to withdraw your original assets, plus any earned fees, from the pool." },
    
    
]

  return (
    <>
     <Head>
        <title>Create Liquidity Pool</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
    <main
      className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}
    >
      <Header />
      <div className=" w-full h-full flex gap-6">
        <ProSidebar />
        <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto    rounded-xl justify-start flex items-center flex-col">
          <span className="text-center w-full text-[25px] flex justify-center font-bold">Create Liquidity Pool</span>
          <div className=" w-full flex justify-start text-[18px] pt-10">
            Create OpenBook Market
          </div>
          <div className=" w-full grid grid-cols-12 gap-6 pt-5">
          <Select
          isRequired
  label="Base Token"
  placeholder="Select the Token"
  labelPlacement="outside"
  items={tokenList.filter((item: any) => item.mint !== "So11111111111111111111111111111111111111112")}
  isLoading={fetchFlag}
  className="col-span-6 max-sm:col-span-12"
  disableSelectorIconRotation
  selectorIcon={<SelectorIcon />}
  onChange={(e) => { changeBase(e.target.value); }}
  renderValue={(items: SelectedItems<any>) => {
    return items.map((item: any) => (
      <div key={item.data.mint} className="flex items-center gap-2 w-full justify-between font-IT">
        <img
          src={
            item.data.mint !== "So11111111111111111111111111111111111111112"
              ? item.data.image
              : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
          }
          alt=""
          className="w-[30px] h-[30px]"
        />
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
        <img
          src={
            item.mint !== "So11111111111111111111111111111111111111112"
              ? item.image
              : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
          }
          alt=""
          className="w-[30px] h-[30px]"
        />
        <div className="flex flex-col items-center w-full">
          <div className="truncate text-s">{item.tokenName || item.tokenSymbol}</div> {/* Smaller Token Name or Symbol */}
          <div className="text-s text-gray-400 font-medium">{`${item.mint.slice(0, 4)}...${item.mint.slice(-4)}`}</div> {/* Smaller Mint Address with lighter color */}
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
              items={tokenList}
              isLoading={fetchFlag}
              className=" col-span-6 max-sm:col-span-12"
              disableSelectorIconRotation
              selectorIcon={<SelectorIcon />}
              onChange={(e) => { changeQuote(e.target.value); }}
              renderValue={(items: SelectedItems<any>) => {
                return items.map((item: any) => (
                  <div key={item.data.mint} className="flex items-center gap-2 w-full justify-between font-IT">
                  <img
          src={
            item.data.mint !== "So11111111111111111111111111111111111111112"
              ? item.data.image
              : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
          }
          alt=""
          className="w-[30px] h-[30px]"
        />
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
                <img
                  src={
                    item.mint !== "So11111111111111111111111111111111111111112"
                      ? item.image
                      : "https://statics.solscan.io/cdn/imgs/s60?ref=68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f736f6c616e612d6c6162732f746f6b656e2d6c6973742f6d61696e2f6173736574732f6d61696e6e65742f536f31313131313131313131313131313131313131313131313131313131313131313131313131313131322f6c6f676f2e706e67"
                  }
                  alt=""
                  className="w-[30px] h-[30px]"
                />
                <div className="flex flex-col items-center w-full">
                  <div className="truncate text-s">{item.tokenName || item.tokenSymbol}</div> {/* Smaller Token Name or Symbol */}
                  <div className="text-s text-gray-400 font-medium">{`${item.mint.slice(0, 4)}...${item.mint.slice(-4)}`}</div> {/* Smaller Mint Address with lighter color */}
                </div>
              </div>
            </SelectItem>
              )}
            </Select>
             <div className="col-span-12 grid grid-cols-12 gap-5">
          <div className="col-span-6 max-sm:col-span-12 rounded-xl pt-1"> {/* Added padding */}
            <div className="flex flex-col"> {/* Use flex column for title and input */}
              <div className=" text-[14px] sm:text-[11px] md:text-[15px] font-medium mb-1 ml-1"> {/* Title styling */}
              Min Order Size (Minimum Buy):
              </div>
                <div className=" flex gap-4 justify-center items-center leading-none w-full px-2 max-sm:flex-wrap pt-3">
                  <span className=" text-[17px]"> Token</span>
                  <Input
                    type="number"
                    radius="sm"
                    defaultValue="1.00"
                    min="0"
                    step={1}
                    className=" h-[40px] col-span-3 max-w-[400px] w-full"
                    onChange={(e) => { setMinOrderSize(Number(e.target.value)); }}
                  />
                </div>
                {/* <CiSquareMinus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(0, 1); }} /> */}
              </div>
              </div>
              

              <div className="col-span-6 max-sm:col-span-12 rounded-xl pt-1"> {/* Added padding */}
            <div className="flex flex-col"> {/* Use flex column for title and input */}
            <div className="text-[14px] sm:text-[11px] md:text-[15px] font-medium mb-1 ml-1">
            Tick Size (Minimum Price Change):
            </div>
                {/* <CiSquarePlus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(1, 0); }} /> */}
                <div className=" flex gap-4 justify-center items-center leading-none w-full px-2 max-sm:flex-wrap pt-3">
                  <span className=" text-[17px]"> SOL</span>
                  <Input
                    type="number"
                    radius="sm"
                    defaultValue="0.0001000000"
                    step={0.0001}
                    min="0"
                    className=" h-[40px] col-span-3 max-w-[400px] w-full"
                    onChange={(e) => { setTickSize(Number(e.target.value)); }}
                  />
                </div>
                {/* <CiSquareMinus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(1, 1); }} /> */}
              </div>
            </div>
            </div>

            <div className=" col-span-12">
              <Switch defaultSelected isSelected={isSelected} onValueChange={setIsSelected} size="sm">
                <span className=" text-[14px]">Advanced Options</span>
              </Switch>
            </div>
            {isSelected ? <div className=" col-span-12 grid grid-cols-12 gap-4">
              <Select
                isRequired
                defaultSelectedKeys="0"
                label="Select a standard OpenBook Market"
                labelPlacement="outside"
                className=" col-span-3 max-xl:col-span-4 max-lg:col-span-6 max-sm:col-span-12"
                placeholder="Select the standard"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeStandard(e.target.value) }}
              >
                {standList.map((stand) => (
                  <SelectItem key={stand.key}>
                    {stand.label}
                  </SelectItem>
                ))}
              </Select>
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Event Queue Length:"
                labelPlacement={'outside'}
                defaultValue="128"
                className=" h-[40px] col-span-3 max-xl:col-span-4 max-lg:col-span-6 max-sm:col-span-12"
                value={eventLength.toString()}
                onChange={(e) => { setEventLength(Number(e.target.value)); }}
              />
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Request Queue Length:"
                labelPlacement={'outside'}
                defaultValue="63"
                className=" h-[40px] col-span-3 max-xl:col-span-4 max-lg:col-span-6 max-sm:col-span-12"
                value={requestLength.toString()}
                onChange={(e) => { setRequestLength(Number(e.target.value)); }}
              />
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Orderbook Length:"
                labelPlacement={'outside'}
                defaultValue="909"
                className=" h-[40px] col-span-3 max-xl:col-span-4 max-lg:col-span-6 max-sm:col-span-12"
                value={orderBookLength.toString()}
                onChange={(e) => { setOrderBookLength(Number(e.target.value)); }}
              />
            </div> : null}
          </div>
          <div className=" w-full flex justify-start text-[18px] pt-5">
            Add
          </div>
          <div className=" w-full grid grid-cols-12 gap-6 pt-2">
            <div className=" col-span-12 grid grid-cols-11 max-md:grid-cols-12 gap-5 ">
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Base Token Amount:"
                labelPlacement={'outside'}
                placeholder="Put the base token amount"
                className=" h-[40px] col-span-5 max-md:col-span-6 max-sm:col-span-12"
                min={0}
                value={baseTokenAmount.toString()}
                onChange={(e) => { setBaseTokenAmount(Number(e.target.value)); }}
                endContent={
                  <div className=" flex gap-3 ">
                    <div className=" flex gap-2 text-[13px]">
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]" onClick={() => { if (baseTokenMeta) { setBaseTokenAmount(Number(baseTokenMeta.amount)) } }}> Max</span>
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]" onClick={() => { if (baseTokenMeta) { setBaseTokenAmount(Number(baseTokenMeta.amount / 2)) } }}> Half</span>
                    </div>
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center" >
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>
                      Base
                    </div>
                  </div>
                }
              />
              <div className=" col-span-1 items-center justify-center flex mt-6 max-md:hidden">
                <CiCirclePlus className=" text-[40px]" />
              </div>
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Quote Token Amount:"
                labelPlacement={'outside'}
                placeholder="Put the quote token amount"
                className=" h-[40px] col-span-5 max-md:col-span-6 max-sm:col-span-12"
                min={0}
                value={quoteTokenAmount.toString()}
                onChange={(e) => { setQuoteTokenAmount(Number(e.target.value)); }}
                endContent={
                  <div className=" flex gap-3 ">
                    <div className=" flex gap-2 text-[13px]">
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]" onClick={() => { if (quoteTokenMeta) { setQuoteTokenAmount(Number(quoteTokenMeta.amount)) } }}> Max</span>
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#27272a]" onClick={() => { if (quoteTokenMeta) { setQuoteTokenAmount(Number(quoteTokenMeta.amount / 2)) } }}> Half</span>
                    </div>
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center" >
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#4d5ffc]"></div>
                      Quote
                    </div>

                  </div>
                }
              />
            </div>
            <div className=" flex w-full justify-center col-span-12 pt-5">
              <Button color="primary" isLoading={marketloading || lpLoading} fullWidth className=" text-[18px]" onClick={() => { createLP() }}>
                {marketloading ? "Creating Market" : lpLoading ? "Creating Liquidity Pool" : "Create Liquidity Pool"}
              </Button>
            </div>
          </div>
          <div className=" w-full pt-5 flex items-center max-sm:flex-wrap gap-5">
            <div className="">
              <Switch defaultSelected isSelected={isTimeSelected} onValueChange={setIsTimeSelected} size="sm">
                <span className=" text-[14px]">Set Launch Date</span>
              </Switch>
            </div>
            {isTimeSelected ?
              <DatePicker
                className="w-[300px]"
                granularity="second"
                value={date}
                onChange={setDate}
              /> : null}
          </div>
          <section className="max-w-[750px] w-full mx-auto mt-10">
            <Faqs faqData={faqData}/>
            <div>
            <h6 className="text-2xl pt-10">
    Solana Liquidity Pool Creator
</h6>
<p className="text-base1">
    Easily create and manage liquidity pools on the Solana blockchain with our user-friendly platform. Select your base and quote tokens, set the desired amounts, and customize advanced options like market event queue length and order book length.
</p>
<p className="text-base1">
    No blockchain expertise is required—our platform simplifies the process so anyone can create and manage pools effortlessly. All transactions and pool data are secured with our on-chain smart contracts, ensuring the safety of your assets.
</p>
<p className="text-base1">
    Set up your liquidity pool in minutes, tailored to your project’s specific needs. Our goal is to provide a seamless and efficient experience for all users.
</p>

            </div> 
          </section>
        </div>
      </div>
    </main>
    </>
  );
}
