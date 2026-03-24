import { useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { Input, Button } from "@nextui-org/react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { fetchTokenMetadata, solanaConnection } from "@/lib/utils";
import { toast } from "react-toastify";
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { CiCirclePlus } from "react-icons/ci";
import Faqs from "@/components/faqs";
import Head from "next/head";

export default function Home() {
  const anchorWallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);

  // Mint Section
  const [poolId, setPoolId] = useState("");
  const [baseToken, setBaseToken] = useState<any>({
    tokenName: "",
    tokenSymbol: "",
    tokenLogo: "",
  });
  const [quoteToken, setQuoteToken] = useState<any>({
    tokenName: "",
    tokenSymbol: "",
    tokenLogo: "",
  });
  const [quoteAmount, setQuoteAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);

  const getPoolInfo = async () => {

    try {
      const response = await fetch(
        `/api/meteora/fetchPoolInfo/?poolId=${poolId}`
      );
      const data = await response.json();
      if (response.status !== 200) {
        toast.error(data.error);
        return;
      }
      if (data) {
        console.log("base=>>>", data.vPrice);
        const base = await fetchTokenMetadata(data.baseMint);
        console.log("base=>>>", base);

        setBaseToken(base);
        const quote = await fetchTokenMetadata(data.quoteMint);
        setQuoteToken(quote);
      }
    } catch (error: any) {
      toast.error(error.message);
      console.log(error);
    }
  };

  const addLP = async () => {
    if (!anchorWallet) {
      toast.error("Please connect your wallet");
      return;
    };

    if (!poolId) {
      toast.error("Please insert Amm pool id");
      return;
    };

    const processTransaction = async (
      amount: number,
      amountSide: "base" | "quote"
    ) => {
      setLoading(true);

      try {
        const response = await fetch("/api/meteora/addLiquidity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            params: {
              owner: anchorWallet?.publicKey.toBase58(),
              poolId: poolId,
              amount,
              amountSide,
            },
          }),
        });
        const data = await response.json();
        if (response.status !== 200) {
          setLoading(false);
          toast.error(data.error);
          return;
        }
        if (data) {
          const txnBuffer = Buffer.from(data.txn, "base64");
          //@ts-ignore
          const txn = VersionedTransaction.deserialize(txnBuffer);
          // const simRes = (await solanaConnection.simulateTransaction(txn))
          //   .value;

          // if (simRes.err) console.log("sumRes===>>>", simRes.logs);
          // console.log("wallet===>>>", anchorWallet.publicKey.toBase58());
          let serializedTxn = (
            await anchorWallet.signTransaction(txn)
          ).serialize();

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
            toast.success(`Liquidity is added successfully to Pool: ${data.poolId}`);
          console.log("transaction signature ======>>", signature);
          setLoading(false);
        }
      } catch (error: any) {
        console.error("error====>>>", error);
        toast.error(`${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (baseAmount > 0) {
      await processTransaction(baseAmount, "base");
    } else if (quoteAmount > 0) {
      await processTransaction(quoteAmount, "quote");
    } else {
      toast.error("Please enter valid Base/Quote token amounts");
    }
  };
  const faqData = [
    {
      label: "What is a Liquidity Address (AMM ID)?",
      description:
        "The Liquidity Address, also known as the AMM ID, is the unique identifier of the Automated Market Maker (AMM) pool where you want to add liquidity. Entering this address correctly ensures your tokens are added to the right pool.",
    },
    {
      label: "How do I determine the Base and Quote Token amounts?",
      description:
        "The Base Token and Quote Token amounts represent the quantities of each token you want to add to the liquidity pool. Ensure that you provide equal values of both tokens to maintain a balanced pool.",
    },

    {
      label: "Is it safe to add liquidity?",
      description:
        "Yes, adding liquidity on our platform is secure. Your transactions are protected by on-chain smart contracts, ensuring that your assets are safely managed throughout the process.",
    },
  ];

  return (
    <>
      <Head>
        <title>Meteora Amm Liquidity Adder | Easy & Cheap | SolHub</title>
        <meta
          name="description"
          content="Easily add liquidity to your Solana tokens with SolHub's fast and secure liquidity pool adder. Simplify token management with our user-friendly platform designed for seamless Solana operations."
        />
      </Head>
      <main
        className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}
      >
        <Header />
        <div className=" w-full h-full flex gap-6">
          <ProSidebar />
          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border  custom-scrollbar h-[84vh] overflow-y-auto   rounded-xl justify-start flex items-center flex-col">
            <span className="text-center w-full text-[25px] flex justify-center font-bold">
              {" "}
              Add Meteora Amm Liquidity
            </span>
            <div className=" w-full grid grid-cols-12 gap-6 pt-10">
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Enter Liquidity Address (AMM ID):"
                labelPlacement={"outside"}
                placeholder="Put the Liquidity Address"
                value={poolId}
                onChange={(e) => {
                  setPoolId(e.target.value);
                }}
                endContent={
                  <div
                    className=" flex gap-3 cursor-pointer"
                    onClick={() => {
                      getPoolInfo();
                    }}
                  >
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center hover:bg-white">
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[rgb(252,220,77)] "></div>
                      Info
                    </div>
                  </div>
                }
                className=" h-[40px] col-span-12"
              />
              <div className=" col-span-12 grid grid-cols-11 max-sm:grid-cols-12 gap-5 ">
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Base Token Amount:"
                  labelPlacement={"outside"}
                  placeholder="Put the base token amount"
                  className=" h-[40px] col-span-5 max-sm:col-span-6 max-esm:col-span-12"
                  min={0}
                  value={baseAmount.toString()}
                  onChange={(e) => {
                    setBaseAmount(Number(e.target.value));
                  }}
                  endContent={
                    <div className=" flex gap-3 ">
                      {/* <div className=" flex gap-2 text-[13px]">
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Max</span>
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Half</span>
                    </div> */}
                      <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center h-fit">
                        {baseToken.tokenLogo ? (
                          <img
                            src={baseToken.tokenLogo}
                            alt=""
                            className="h-[20px] w-[20px]"
                          />
                        ) : (
                          <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>
                        )}
                        {baseToken.tokenSymbol ? baseToken.tokenSymbol : "Base"}
                      </div>
                    </div>
                  }
                />
                <div className=" col-span-1 items-center justify-center flex mt-6 max-sm:hidden">
                  <CiCirclePlus className=" text-[40px]" />
                </div>
                <Input
                  isRequired
                  type="number"
                  radius="sm"
                  label="Quote Token Amount:"
                  labelPlacement={"outside"}
                  placeholder="Put the quote token amount"
                  className=" h-[40px] col-span-5 max-sm:col-span-6 max-esm:col-span-12"
                  min={0}
                  value={quoteAmount.toString()}
                  onChange={(e) => {
                    setQuoteAmount(Number(e.target.value));
                  }}
                  endContent={
                    <div className=" flex gap-3">
                      {/* <div className=" flex gap-2 text-[13px]">
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Max</span>
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-transparent"> Half</span>
                    </div> */}
                      <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center w-fit h-fit">
                        {quoteToken.tokenLogo ? (
                          <img
                            src={quoteToken.tokenLogo}
                            alt=""
                            className="h-[20px] w-[20px]"
                          />
                        ) : (
                          <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#4d5ffc]"></div>
                        )}
                        {quoteToken.tokenSymbol
                          ? quoteToken.tokenSymbol
                          : "Quote"}
                      </div>
                    </div>
                  }
                />
              </div>
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button
                  color="primary"
                  fullWidth
                  isLoading={loading}
                  className=" text-[18px]"
                  onClick={() => {
                    addLP();
                  }}
                >
                  Add Liquidity
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
                <h6 className="text-2xl pt-10">Add Meteora Amm Liquidity</h6>
                <p className="text-base1">
                  Easily add liquidity to your Solana liquidity pool using our
                  Add Meteora Amm Liquidity. Begin by entering the Liquidity
                  Address (AMM ID) to specify the pool where you want to
                  contribute your tokens.
                </p>
                <p className="text-base1">
                  Next, input the amounts for both the base token and the quote
                  token that you wish to add. These token amounts will directly
                  enhance the liquidity available for trading within the pool,
                  facilitating smoother transactions.
                </p>
                <p className="text-base1">
                  Once you've entered the necessary details, click "Add
                  Liquidity" to contribute your tokens securely. Our platform
                  ensures that your assets are protected throughout the process,
                  making it simple to support the Solana ecosystem.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
