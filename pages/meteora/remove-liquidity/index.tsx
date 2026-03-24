import { useState } from "react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Input, Button } from "@nextui-org/react";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { getRayPoolKeyInfo, removeLiquidity } from "@/lib/txHandler";
import { solanaConnection } from "@/lib/utils";
import { toast } from "react-toastify";
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import Faqs from "@/components/faqs";
import Head from "next/head";

export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const [removeLpLoading, setRemoveLpLoading] = useState(false);

  // Mint Section
  const [poolId, setPoolId] = useState("");
  // const [baseSymbol, setBaseSymbol] = useState("Base");
  // const [quoteSymbol, setQuoteSymbol] = useState("Quote");
  const [lpAmount, setLpAmount] = useState(0);
  const [orginalAmount, setOrginalAmount] = useState(0);

  const getRemovePoolInfo = async () => {
    try {
      const response = await fetch(
        `/api/meteora/fetchPoolInfo/?poolId=${poolId}`
      );
      const data = await response.json();
      if (response.status !== 200) {
        toast.error(data.error);
        return;
      }
      
      if (anchorWallet) {
        const tokenAccount = getAssociatedTokenAddressSync(
          new PublicKey(data.lpMint),
          anchorWallet.publicKey
        );
        const tokenAccountInfo = await solanaConnection.getParsedAccountInfo(
          tokenAccount
        );

        if (tokenAccountInfo) {
          // @ts-ignore
          const lpAmount = Number(tokenAccountInfo.value?.data.parsed.info.tokenAmount.uiAmount||0);
          console.log('lpamount', lpAmount);
          setLpAmount(lpAmount);
          setOrginalAmount(lpAmount);
        }else{
          toast.error("Can't find token account!");
          return;
        }
      }else{
        toast.error("Wallet not connected!");
        return;
      }
    } catch (error: any) {
      toast.error(error.message);
      console.log(error);
      return;
    }
  };

  const withdrawLP = async () => {

    if (!wallet.publicKey) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!poolId) {
      toast.error("Please insert Amm pool id!");
      return;
    }

    if (lpAmount == 0) {
      toast.error("LP amount must be greater than 0!");
      return;
    }

    setRemoveLpLoading(true);
    
    if (anchorWallet) {
      try {
        const response = await fetch("/api/meteora/removeLiquidity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            params: {
              owner: anchorWallet?.publicKey.toBase58(),
              poolId: poolId,
              amount: lpAmount,
            },
          }),
        });
        const data = await response.json();
        if (response.status !== 200) {
          setRemoveLpLoading(false);
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
            toast.error(`Transaction is failed, please check your wallet token balanaces`);
          else
            toast.error(`Liquidity is removed successfully from Pool: ${data.poolId}`);
          console.log("transaction signature ======>>", signature);
          setRemoveLpLoading(false);
        }
      } catch (error: any) {
        toast.error(`${error.message}`);
        setRemoveLpLoading(false);
      }
    }
  };
  const faqData = [
    {
      label: "What is the Liquidity Address (AMM ID) and why do I need it?",
      description:
        "The Liquidity Address, or AMM ID, is the unique identifier of the pool from which you want to remove liquidity. Entering this ensures that you're withdrawing from the correct pool.",
    },
    {
      label: "What are LP Tokens and how do they work?",
      description:
        "LP Tokens represent your share in the liquidity pool. When you add liquidity, you receive LP Tokens, which you can later redeem to withdraw your share of the pool, including any earned fees.",
    },
    {
      label: "How do I specify the amount of liquidity to remove?",
      description:
        "You can specify the amount of liquidity to remove by adjusting the LP Token Amount. You have the option to withdraw the maximum amount, half, or a custom amount based on your needs.",
    },
    {
      label: "Is it safe to withdraw liquidity?",
      description:
        "Yes, withdrawing liquidity on our platform is secure. The process is managed by on-chain smart contracts, ensuring that your assets are safely returned to you during the withdrawal.",
    },
  ];

  return (
    <>
      <Head>
        <title>Remove Meteora Amm Liquidity</title>
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
          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border custom-scrollbar h-[84vh] overflow-y-auto  rounded-xl ">
            <span className="text-center w-full text-[25px] flex justify-center font-bold ">
              {" "}
              Remove Meteora Amm Liquidity
            </span>
            <div className=" w-full grid grid-cols-12 gap-6 pt-10">
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Enter Liquidity Address (AMM ID):"
                labelPlacement={"outside"}
                placeholder="Put the Liquidity Address"
                className=" h-[40px] col-span-6 max-md:col-span-12"
                value={poolId}
                onChange={(e) => {
                  setPoolId(e.target.value);
                }}
                endContent={
                  <div
                    className=" flex gap-3 cursor-pointer"
                    onClick={() => {
                      getRemovePoolInfo();
                    }}
                  >
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center hover:bg-white">
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[rgb(252,220,77)] "></div>
                      Info
                    </div>
                  </div>
                }
              />
              <Input
                isRequired
                fullWidth
                type="number"
                radius="sm"
                label="LP Token Amount:"
                labelPlacement={"outside"}
                // placeholder="Put the Liquidity Address"
                className=" h-[40px] col-span-6 max-md:col-span-12"
                min={0}
                value={lpAmount.toString()}
                onChange={(e) => {
                  setLpAmount(Number(e.target.value));
                }}
                startContent={
                  <div className="flex gap-3">
                    {/* <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center">
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>
                      Base/Quote
                    </div> */}
                    <div className=" flex gap-2 text-[13px]">
                      <span
                        className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:gradient-1"
                        onClick={() => {
                          setLpAmount(orginalAmount);
                        }}
                      >
                        {" "}
                        Max
                      </span>
                      <span
                        className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:gradient-1"
                        onClick={() => {
                          setLpAmount(orginalAmount / 2);
                        }}
                      >
                        {" "}
                        Half
                      </span>
                    </div>
                  </div>
                }
              />
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button
                  color="primary"
                  isLoading={removeLpLoading}
                  fullWidth
                  className=" text-[18px]"
                  onClick={() => {
                    withdrawLP();
                  }}
                >
                  Withdraw Liquidity
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
                <h6 className="text-2xl pt-10">Remove Meteora Amm Liquidity</h6>
                <p className="text-base1">
                  Easily withdraw your liquidity from a Solana liquidity pool
                  using our Remove Meteora Amm Liquidity. Start by entering the
                  Liquidity Address (AMM ID) of the pool you wish to remove
                  liquidity from.
                </p>
                <p className="text-base1">
                  Next, specify the amount of LP tokens you want to withdraw.
                  You can choose to remove the maximum amount, half, or a custom
                  amount, which will be withdrawn as base and quote tokens.
                </p>
                <p className="text-base1">
                  Once you’ve entered the necessary details, click "Withdraw
                  Liquidity" to securely remove your assets from the pool. Our
                  platform ensures a safe and seamless withdrawal process,
                  allowing you to manage your liquidity with ease.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
