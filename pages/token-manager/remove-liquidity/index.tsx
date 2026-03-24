import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
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

const toastError = (str: string) => {
  toast.error(str, {
    position: "top-center",
  });
};

const toastSuccess = (str: string) => {
  toast.success(str, {
    position: "top-center",
  });
};

export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const [removeLpLoading, setRemoveLpLoading] = useState(false);

  // Mint Section
  const [removelpAddress, setRemoveLpAddress] = useState("");
  const [lpAmount, setLpAmount] = useState(0);
  const [orginalAmount, setOrginalAmount] = useState(0);

  const getRemovePoolInfo = async () => {
    try {
      const res = await getRayPoolKeyInfo(
        new PublicKey(removelpAddress),
        "mainnet"
      );
      if (res && anchorWallet) {
        const tokenAccount = getAssociatedTokenAddressSync(
          res.lpMint,
          anchorWallet.publicKey
        );
        const tokenAccountInfo = await solanaConnection.getParsedAccountInfo(
          tokenAccount
        );

        if (tokenAccountInfo) {
          // @ts-ignore
          const tokenAmount = Number(tokenAccountInfo.value?.data.parsed.info.tokenAmount.uiAmount);
          setLpAmount(tokenAmount);
          setOrginalAmount(tokenAmount);
        }
      }
    } catch (error: any) {
      toastError(error.message);
      console.log(error);
      return;
    }
  };

  const withdrawLP = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!");
      return;
    }

    if (lpAmount == 0) {
      toastError("LP amount must be greater than 0!");
      return;
    }

    setRemoveLpLoading(true);
    const res = await removeLiquidity({
      poolId: new PublicKey(removelpAddress),
      amount: lpAmount,
      url: "mainnet",
      wallet: anchorWallet,
    });
    if (res && anchorWallet) {
      try {
        let stx1 = (await anchorWallet.signTransaction(res)).serialize();

        const options = {
          commitment: "confirmed",
          skipPreflight: true,
        };

        const txId1 = await solanaConnection.sendRawTransaction(stx1, options);
        await solanaConnection.confirmTransaction(txId1, "confirmed");
        console.log("txId1======>>", txId1);
        toastSuccess(`LP Amount: ${lpAmount} has removed successfully!`);
        setRemoveLpLoading(false);
      } catch (error: any) {
        toastError(`${error.message}`);
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
        <title>Solana Liquidity Remover</title>
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
              Solana Liquidity Remover
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
                value={removelpAddress}
                onChange={(e) => {
                  setRemoveLpAddress(e.target.value);
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
                  <div className=" flex gap-3 ">
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center">
                      <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>
                      Base/Quote
                    </div>
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
                <h6 className="text-2xl pt-10">Solana Liquidity Remover</h6>
                <p className="text-base1">
                  Easily withdraw your liquidity from a Solana liquidity pool
                  using our Solana Liquidity Remover. Start by entering the
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
