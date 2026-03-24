import { useState, useEffect } from "react";
import axios from "axios";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem } from "@nextui-org/react";
import { AiOutlineLoading } from "react-icons/ai";
import { FaUpload } from "react-icons/fa6";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PINATA_API_KEY } from "@/lib/constant";
import ImageUploading from 'react-images-uploading';
import SimpleBar from 'simplebar-react';
import { createTaxToken } from "@/lib/txHandler";
import { solanaConnection } from "@/lib/utils";
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

export default function Home() {

  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();


  const [loading, setLoading] = useState(false);
  const [uploadingStatus, setUploadLoading] = useState(false);

  // Mint Section
  const [mintTokenName, setMintTokenName] = useState("");
  const [mintTokenSymbol, setTokenSymbol] = useState("");
  const [mintTokenDesc, setMintTokenDesc] = useState("");
  const [mintTokenSupply, setMintTokenSupply] = useState(1);
  const [mintTokenDecimal, setMintTokenDecimal] = useState(6);
  const [txFee, setTxFee] = useState(0);
  const [maxFee, setMaxFee] = useState(0);
  const [authWallet, setAuthWallet] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [bearingRate, setBearingRate] = useState(0);
  const [metaDataURL, setMetaDataURL] = useState("");

  const [images, setImages] = useState([]);
  const [isSelected, setIsSelected] = useState(false);
  const [isTranserSelected, setIsTransferSelected] = useState(false);

  const maxNumber = 1;

  const onChange = (imageList: any, addUpdateIndex: any) => {
    // data for submit
    console.log(imageList, addUpdateIndex);
    setImages(imageList);
  };

  const pinataPublicURL = "https://gateway.pinata.cloud/ipfs/";

  const handleSetMetaData = async () => {
    setUploadLoading(true);
    // @ts-ignore
    const data = images.length > 0 ? images[0].file : null
    const imgData = new FormData();
    imgData.append("file", data);

    const imgRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_API_KEY}`,
        },
        body: imgData,
      }
    );

    const imgJsonData = await imgRes.json()

    setMetaDataURL(pinataPublicURL + imgJsonData.IpfsHash)
    setUploadLoading(false);
    // setLoading(true);
    return pinataPublicURL + imgJsonData.IpfsHash;
  }

  const uploadJsonToPinata = async (jsonData: any) => {
    try {
      const response = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            // Replace YOUR_PINATA_JWT with your actual JWT token
            Authorization: `Bearer ${PINATA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pinataContent: jsonData,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Uploaded JSON hash:", data.IpfsHash);
      return data.IpfsHash;
    } catch (error) {
      console.error("Error uploading JSON to Pinata:", error);
      throw error;
    }
  };

  const validator = async () => {
    if (!mintTokenName) {
      toastError("Please enter the token name");
      return false;
    }
    if (!mintTokenSymbol) {
      toastError("Please enter the token symbol");
      return false;
    }
    if (mintTokenDecimal <= 0) {
      toastError("Please enter a valid token decimal");
      return false;
    }
    if (mintTokenSupply <= 0) {
      toastError("Please enter a valid token supply");
      return false;
    }
    if (images.length === 0) {
      toastError("Please upload the token logo");
      return false;
    }
    if (!mintTokenDesc) {
      toastError("Please enter the token description");
      return false;
    }
    if (txFee < 0 || txFee >= 100) {
      toastError("Please select correct fee rate.");
      return false;
    }
    return true;
  }

  const createToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }
    const validationFlag = await validator();
    if (validationFlag == false) {
      return;
    }


    const imgURL = await handleSetMetaData();
    const uploadedJsonUrl = await uploadJsonToPinata({
      name: mintTokenName,
      symbol: mintTokenSymbol,
      description: mintTokenDesc,
      image: imgURL
    });

    setLoading(true);

    let permanentWallet: any;
    if (isSelected) {
      permanentWallet = new PublicKey(permanentAddress);
    } else {
      permanentWallet = "";
    }

    const res = await createTaxToken({
      name: mintTokenName, symbol: mintTokenSymbol, decimals: mintTokenDecimal, url: "mainnet", metaUri: pinataPublicURL + uploadedJsonUrl, initialMintingAmount: mintTokenSupply, feeRate: txFee, maxFee, authWallet: new PublicKey(authWallet), withdrawWallet: new PublicKey(withdrawWallet), useExtenstion: isSelected, permanentWallet, defaultAccountState: 1, bearingRate, transferable: isTranserSelected, wallet: anchorWallet
    });
    if (res) {
      if (anchorWallet) {
        try {
          let stx = (await anchorWallet.signTransaction(res.mintTransaction)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId = await solanaConnection.sendRawTransaction(stx, options);
          await solanaConnection.confirmTransaction(txId, "confirmed");
          setLoading(false);
          toastSuccess(`${res.mint.toBase58()} token created successfully!`);
          console.log("txId======>>", txId);

        } catch (error: any) {
          toastError(`${error.message}`);
          setLoading(false);
        }

      }
    }
  }
  const faqData = [
    {
      label: 'What is a Tax Token?',
      description: "A Tax Token is a type of cryptocurrency that includes built-in transaction fees. These fees can be used for various purposes, such as funding development, rewarding holders, or supporting a community project."
  },
  {
      label: 'How do I set the transaction fee for my Tax Token?',
      description: "To set the transaction fee, simply enter the desired percentage in the 'Fee %' field. This percentage will be applied to every transaction involving your token, generating revenue or rewards as defined by your project's goals."
  },
  {
      label: 'What is the Max Fee and why is it important?',
      description: "The Max Fee is the maximum fee that can be charged per transaction in your Tax Token. Setting this helps prevent excessive fees on large transactions, ensuring your token remains user-friendly and fair."
  },
  {
      label: 'What is the role of the Withdraw Authority?',
      description: "The Withdraw Authority is the wallet address authorized to withdraw the accumulated transaction fees. Make sure to specify a secure wallet that will manage these funds appropriately."
  },
  {
      label: 'Can I customize the token further after creation?',
      description: "Once your Tax Token is created, some aspects can be updated if you’ve retained update authority. However, key features like the transaction fee percentage and max fee are fixed at creation."
  },
  
  ]

  return (
    <>
      <Head>
        <title>Tax Token Creator</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
      <main
        className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}>
        <Header />
        <div className=" w-full h-full flex gap-6">
          <ProSidebar />
          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border custom-scrollbar h-[84vh] overflow-y-auto  rounded-xl ">
            <span className="text-center w-full text-[25px] flex justify-center font-bold"> Tax Token Creator</span>
            <div className=" w-full grid grid-cols-12 gap-6 pt-10">
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Name:"
                labelPlacement={'outside'}
                placeholder="Put the name of your token"
                className=" h-[40px] col-span-6 max-md:col-span-12"
                onChange={(e) => { setMintTokenName(e.target.value); }}
              />
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Symbol:"
                labelPlacement={'outside'}
                className=" h-[40px]  col-span-6 max-md:col-span-12"
                placeholder="Put the symbol of your token"
                onChange={(e) => { setTokenSymbol(e.target.value); }}
              />
              <Input
                isReadOnly
                type="number"
                radius="sm"
                defaultValue="6"
                label="Decimals:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6 max-md:col-span-12"
                onChange={(e) => { setMintTokenDecimal(Math.floor(Number(e.target.value))); }}
              />
              <Input
                isRequired
                type="number"
                radius="sm"
                defaultValue="1"
                label="Supply:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6 max-md:col-span-12"
                onChange={(e) => { setMintTokenSupply(Math.floor(Number(e.target.value))); }}
              />
              <div className="flex flex-col gap-[6px] font-normal text-[14px] col-span-6 max-md:col-span-12 h-[225px]">
                <span>Image:</span>
                <ImageUploading
                  multiple
                  value={images}
                  onChange={onChange}
                  maxNumber={maxNumber}
                  dataURLKey="data_url"
                >
                  {({
                    imageList,
                    onImageUpload,
                    onImageRemoveAll,
                    onImageUpdate,
                    onImageRemove,
                    isDragging,
                    dragProps,
                  }) => (
                    // write your building UI
                    <div className="upload__image-wrapper w-full h-full">
                      {/* <button onClick={onImageRemoveAll}>Remove all images</button> */}
                      {imageList.length > 0 ? imageList.map((image, index) => (
                        <div key={index} className="image-item w-full justify-center items-center flex flex-col">
                          <img src={image['data_url']} alt="" className=" w-[150px] h-[150px] rounded-xl object-center" />
                          <div className="image-item__btn-wrapper w-full justify-center gap-[60px] flex">
                            <button onClick={() => onImageUpdate(index)} className=" hover:text-[#5680ce]">Update</button>
                            <button onClick={() => onImageRemove(index)} className=" hover:text-[#5680ce]">Remove</button>
                          </div>
                        </div>
                      )) : <button
                        style={isDragging ? { color: 'red' } : undefined}
                        onClick={onImageUpload}
                        className="bg-[#27272a] w-full h-full flex justify-center items-center gap-3 flex-col rounded-xl"
                        {...dragProps}
                      >
                        <FaUpload fontSize={25} />
                        Click or Drop here
                      </button>}
                    </div>
                  )}
                </ImageUploading>
                <span className=" text-[12px]">Most meme coin use a squared 1000x1000 logo</span>
              </div>
              <div className=" w-full h-[200px] col-span-6 max-md:col-span-12">
                <Textarea
                  isRequired
                  fullWidth
                  classNames={{
                    innerWrapper: "h-[157px]"
                  }}
                  maxRows={8}
                  label="Description"
                  labelPlacement="outside"
                  placeholder="Enter your description"
                  onChange={(e) => { setMintTokenDesc(e.target.value); }}
                />
              </div>
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Fee %: (10 = 10% per transaction):"
                placeholder="Put fee"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6 max-md:col-span-12"
                min={0}
                max={99.9}
                defaultValue="0"
                onChange={(e) => { setTxFee(Number(e.target.value)); }}

              />
              <Input
                isRequired
                type="number"
                radius="sm"
                defaultValue="0 "
                label="Max Fee: (the maximum fee an user can pay in tokens):"
                placeholder="Put fee"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6 max-md:col-span-12"
                onChange={(e) => { setMaxFee(Number(e.target.value)); }}
              />
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Authority Wallet:"
                placeholder="Wallet Address"
                labelPlacement={'outside'}
                className=" h-[40px]  col-span-6 max-md:col-span-12"
                onChange={(e) => { setAuthWallet(e.target.value); }}
              />
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Withdraw Authority: (wallet to withdraw fees):"
                placeholder="Wallet Address"
                labelPlacement={'outside'}
                className=" h-[40px]  col-span-6 max-md:col-span-12"
                onChange={(e) => { setWithdrawWallet(e.target.value); }}
              />
              <div className=" col-span-12">
                <Switch defaultSelected isSelected={isSelected} onValueChange={setIsSelected} size="sm">
                  <span className=" text-[14px]">Use Extensions</span>
                </Switch>
              </div>
              {isSelected ? <div className=" col-span-12 grid grid-cols-12 gap-4">
                <Input
                  type="text"
                  radius="sm"
                  label="Permanent Delegate:"
                  labelPlacement={'outside'}
                  placeholder="Permanent address"
                  className=" h-[40px] col-span-4 max-sm:col-span-12 max-xl:col-span-6"
                  onChange={(e) => { setPermanentAddress(e.target.value); }}
                />
                <Input
                  type="text"
                  radius="sm"
                  label="Default Account State:"
                  labelPlacement={'outside'}
                  placeholder="initialized"
                  className=" h-[40px] col-span-2 max-xl:col-span-4 max-sm:col-span-12"
                  isReadOnly
                />
                <Input
                  type="number"
                  radius="sm"
                  label="Interest Bearing Rate:"
                  labelPlacement={'outside'}
                  defaultValue="0"
                  placeholder="Put the rate"
                  className=" h-[40px] col-span-4 max-sm:col-span-12 max-xl:col-span-6"
                  onChange={(e) => { setBearingRate(Number(e.target.value)); }}
                />
                <div className=" col-span-2 max-xl:col-span-4 max-sm:col-span-12 items-end h-full flex  pb-1">
                  <Switch defaultSelected isSelected={isTranserSelected} onValueChange={setIsTransferSelected} size="sm">
                    <span className=" text-[14px]">Non-Transferable</span>
                  </Switch>
                </div>
              </div> : null}
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" fullWidth className=" text-[18px]" onClick={() => { createToken() }} isLoading={uploadingStatus || loading}>
                  {uploadingStatus ? "Uploading Metadata" : loading ? "Creating Tax Token" : "Create Tax Token"}
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
              <h6 className="text-2xl pt-10">
    Tax Token Creator
</h6>
<p className="text-base1">
    Create your own tax token on the Solana blockchain with our Tax Token Creator. Start by entering the name and symbol for your token, along with the initial supply and the number of decimals to define its precision. You can also upload a custom image to represent your token, ensuring it aligns with your brand or project.
</p>
<p className="text-base1">
    Set the transaction fee percentage that users will pay when transferring your token. Additionally, you can define the maximum fee that can be charged per transaction. Enter the Authority Wallet address, which will hold the minting and management authority for your token.
</p>
<p className="text-base1">
    You also have the option to specify a Withdraw Authority wallet address, allowing fees to be withdrawn securely. Once all fields are completed, click "Create Tax Token" to finalize your token creation, with all details securely processed on-chain.
</p>

              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
