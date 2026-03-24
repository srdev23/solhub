import { useState, useEffect } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem, SelectedItems, Divider } from "@nextui-org/react";
import { toast } from 'react-toastify';
import { createMarket } from "@/lib/txHandler";
import { solanaConnection, devConnection, truncateText, getTokenList } from "@/lib/utils";
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { SelectorIcon } from "@/components/SelectorIcon";
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
  const [ltAddress, setLtAddress] = useState("FPtmoHC8vs7XuS67PqtxYBFnnERaEjQwv4H4UgBCsYRn");
  const [tokenList, setTokenList] = useState<TokenData[]>([]);
  const [fetchFlag, setFetchFlag] = useState(false);

  // Mint Section
  const [baseToken, setBaseToken] = useState("");
  const [quoteToken, setQuoteToken] = useState("");
  const [orderSize, setMinOrderSize] = useState(1);
  const [tickSize, setTickSize] = useState(0.0001);
  const [standard, setStandard] = useState(1);
  const [eventLength, setEventLength] = useState(2978);
  const [requestLength, setRequestLength] = useState(63);
  const [orderBookLength, setOrderBookLength] = useState(909);

  // Launch Section
  const [launchTokenAmount, setLaunchTokenAmount] = useState(0);
  const [launchSolAmount, setLaunchSolAmount] = useState(0);
  const [launchPoolAccount, setLaunchPoolAccount] = useState("");
  const [launchFlag, setLaunchFlag] = useState(false);

  // Remove LP
  const [removeLPFlag, setRemoveLPFlag] = useState(false);

  // Sell Token
  const [sellAllFlag, setSellAllFlag] = useState(false);
  const [sellTokenAmount, setSellTokenAmount] = useState(0);
  const [sellAmountFlag, setSellAmountFlag] = useState(false);
  const [images, setImages] = useState([]);
  const [isSelected, setIsSelected] = useState(true);
  const [tokenAmount, setTokenAmount] = useState(1.00);
  const [solAmount, setSolAmount] = useState(0.0001000000);

  const changeAmount = async (type: number, direct: number) => {
    if (type == 0) {
      if (direct == 0) {
        setTokenAmount(tokenAmount + 1);
      } else setTokenAmount(tokenAmount - 1);
    } else {
      if (direct == 0) {
        setSolAmount(solAmount + 0.001);
      } else setSolAmount(solAmount - 0.001);
    }
  }

  const maxNumber = 1;

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

  const changeQuote = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setQuoteToken(mintAddress);
      } else {
        setQuoteToken("");
      }
      console.log("filter==>>", filtered);
    }
  }

  const changeBase = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setBaseToken(mintAddress);
      } else {
        setBaseToken("");
      }
      console.log("filter==>>", filtered);
    }
  }

  const changeStandard = async (value: string) => {
    setEventLength(lengthList[Number(value)].event);
    setRequestLength(lengthList[Number(value)].request);
    setOrderBookLength(lengthList[Number(value)].order);
  }

  const createMarketTx = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (baseToken == "") {
      toastError("You shoule select base token!")
      return;
    }

    if (quoteToken == "") {
      toastError("You shoule select quote token!")
      return;
    }

    // setLoading(true);
    const res = await createMarket({ baseMint: new PublicKey(baseToken), quoteMint: new PublicKey(quoteToken), url: "mainnet", orderSize: orderSize, priceTick: tickSize, wallet: anchorWallet, eventLength, requestLength, orderBookLength });

    if (res) {
      if (anchorWallet) {
        try {
          let stx1 = (await anchorWallet.signTransaction(res.tx1)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId1 = await solanaConnection.sendRawTransaction(stx1, options);
          await solanaConnection.confirmTransaction(txId1, "confirmed");
          console.log("txId1======>>", txId1);

          let stx2 = (await anchorWallet.signTransaction(res.tx2)).serialize();

          const txId2 = await solanaConnection.sendRawTransaction(stx2, options);
          await solanaConnection.confirmTransaction(txId2, "confirmed");
          console.log("txId2======>>", txId2);


          let stx3 = (await anchorWallet.signTransaction(res.tx3)).serialize();

          const txId3 = await solanaConnection.sendRawTransaction(stx3, options);
          await solanaConnection.confirmTransaction(txId3, "confirmed");
          console.log("txId3======>>", txId3);

          toastSuccess(`MarketID: ${res.marketId} created successfully!`);

          setLoading(false);
        } catch (error: any) {
          toastError(`${error.message}`);
          setLoading(false);
        }
      }
    }
  }
  const faqData = [
    {
      label: 'What is an OpenBook Market on Solana?',
      description: "An OpenBook Market on Solana is a decentralized marketplace where users can trade tokens directly. It uses an order book to match buyers and sellers, providing transparency and efficiency in trading."
  },
  {
      label: 'How do I select the Base and Quote Tokens?',
      description: "To create your market, simply choose the Base Token, which is the primary asset, and the Quote Token, which is the secondary asset used for trading. These tokens form the trading pair in your OpenBook Market."
  },
  {
      label: 'What do the advanced options do?',
      description: "Advanced options allow you to customize your market by setting parameters like Event Queue Length, Request Queue Length, and Order Book Length. These settings control how your market processes and manages trades."
  },
 
  {
      label: 'Can I modify my market settings after creation?',
      description: "Once your OpenBook Market is created, the settings like queue lengths and order book length are locked in. Make sure to review your options carefully before finalizing your market."
  },
  
]

  return (
    <>
     <Head>
        <title>Create OpenBook Market</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
    <main
      className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}>
      <Header />
      <div className=" w-full h-full flex gap-6">
        <ProSidebar />
        <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto    rounded-xl justify-start flex items-center flex-col">
          <span className="text-center w-full text-[25px] flex justify-center font-bold">Create OpenBook Market</span>
          <div className=" w-full grid grid-cols-12 gap-6 pt-10">
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
                {/* <CiSquarePlus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(0, 0); }} /> */}
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
            <div className=" flex w-full justify-center col-span-12 pt-5">
              <Button color="primary" isLoading={loading} fullWidth className=" text-[18px]" onClick={() => { createMarketTx() }}>
                Create Martket
              </Button>
            </div>
          </div>
          <section className="max-w-[750px] w-full mx-auto mt-10">
            <Faqs faqData={faqData}/>
            <div>
              <h6 className="text-2xl pt-10">
              Solana OpenBook Market Creator
              </h6>
              <p className="text-base1">
    To create an OpenBook market on the Solana blockchain, start by selecting your base and quote tokens. Enter the desired token amount and specify the amount of SOL required. 
</p>
<p className="text-base1">
    You can also access advanced options to customize your market. This includes selecting a standard OpenBook market, setting the event queue length, request queue length, and order book length.
</p>
<p className="text-base1">
    Once you've configured these settings, click "Create Market" to launch your OpenBook market securely, with all transactions protected by on-chain smart contracts.
</p>

            </div>
          </section>
        </div>
      </div>
    </main>
    </>
  );
}
