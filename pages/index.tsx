import { useState, useEffect,createContext,useContext } from "react";
import axios from "axios";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { Input, useDisclosure, Textarea, Switch, Button } from "@nextui-org/react";
import { AiOutlineLoading } from "react-icons/ai";
import { FaUpload } from "react-icons/fa6";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import ImageUploading from 'react-images-uploading';
import { createToken } from "@/lib/txHandler";
import { PINATA_API_KEY } from "@/lib/constant";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { solanaConnection, devConnection } from "@/lib/utils";
import { getRevokeFee, setRevokeFee,  } from "../lib/constant";
import Faqs from "@/components/faqs";
import Head from "next/head";

const toastError = (str: string) => {
  toast.error(str, {
    position: "top-center"
  });
}

const toastSuccess = (str: string) => {
  toast.success(str, {
    position: "top-center"
  });
}


const pinataPublicURL = "https://gateway.pinata.cloud/ipfs/";

export default function Home() {

  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [loading, setLoading] = useState(false);
  const [uploadingStatus, setUploadLoading] = useState(false);
  const [metaDataURL, setMetaDataURL] = useState("");

  // Mint Section
  const [mintTokenName, setMintTokenName] = useState("");
  const [totalSOLFee, setTotalSOLFee] = useState(0.4);
  const [mintTokenSymbol, setTokenSymbol] = useState("");
  const [mintTokenDesc, setMintTokenDesc] = useState("");
  const [mintTokenSupply, setMintTokenSupply] = useState(1);
  const [mintTokenDecimal, setMintTokenDecimal] = useState(6);
  const [socialState, setSocialState] = useState({
    website: '',
    twitter: '',
    telegram: '',
    discord: ''
  });

  const updateState = (key: string, value: string) => {
    setSocialState((prevState: any) => ({
      ...prevState,
      [key]: value
    }));
  };



  const [images, setImages] = useState<any>([]);
  const [isSelected, setIsSelected] = useState(true);

  const [isIMSelected, setIsIMSelected] = useState(true);
  const [isRFSelected, setIsRFSelected] = useState(true);
  const [isRMSelected, setIsRMSelected] = useState(true);

  const maxNumber = 1;
  const baserevokefee = parseFloat(process.env.NEXT_PUBLIC_REVOKE_FEE!);

  const initialAdditionalFee = baserevokefee + 0.1 * (isIMSelected ? 1 : 0) +
  0.1 * (isRFSelected ? 1 : 0) +
  0.1 * (isRMSelected ? 1 : 0);

const [additionalFee, setAdditionalFee] = useState(initialAdditionalFee);

  const onChange = (imageList: any, addUpdateIndex: any) => {
    // data for submit
    setImages(imageList);
  };

  useEffect(() => {
    setRevokeFee(initialAdditionalFee * 10 ** 9); // Sync the initial REVOKE_FEE in constant.ts
  }, [initialAdditionalFee]);

  const handleSetMetaData = async () => {
    setUploadLoading(true);
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

  const tokenCreate = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }
    const validationFlag = await validator();
    if (validationFlag == false) {
      return;
    }

    setLoading(true);

    const imgURL = await handleSetMetaData();
    const uploadedJsonUrl = await uploadJsonToPinata({
      name: mintTokenName,
      symbol: mintTokenSymbol,
      description: mintTokenDesc,
      image: imgURL,
      social_links: socialState
    });

    const tx = await createToken({
      name: mintTokenName, symbol: mintTokenSymbol, decimals: mintTokenDecimal, url: "devnet", metaUri: pinataPublicURL + uploadedJsonUrl, initialMintingAmount: mintTokenSupply, mintRevokeAuthorities: isRMSelected, freezeRevokeAuthorities: isRFSelected, mutable: isIMSelected, wallet: anchorWallet
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
          setLoading(false);
          toastSuccess(`${mintTokenName} token created successfully!`);

        } catch (error: any) {
          toastError(`${error.message}`);
          setLoading(false);
        }

      }
    }
  }

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
    return true;
  }
  const faqData = [
    { 
      label: 'How can I create my own Solana SPL token?', 
      description: "Creating your own Solana SPL token is easy with our platform. Simply follow our guided steps, customize your token with a name, symbol, and supply, and mint it directly on the Solana blockchain without needing any coding skills." 
    },
    { 
      label: 'What do I need to start creating a Solana token?', 
      description: "All you need to start creating a Solana token is a Solana wallet and a small amount of SOL for transaction fees. Our platform walks you through the entire process, making it easy even if you're new to blockchain technology." 
    },
   
    { 
      label: 'How much does it cost to create a Solana token?', 
      description: "The cost to create a Solana SPL token on our platform is just 0.1 SOL, provided you do not select any other revoke options. This covers the entire token creation process, making it an affordable choice for any project." 
    },
    { 
      label: 'Is it safe to create and manage my tokens on your platform?', 
      description: "Yes, security is our top priority. Our platform uses on-chain smart contracts to ensure that all transactions and token data are secure. Your assets are protected throughout the creation and management process." 
    }
  ]



  
  
  const roundToTwo = (num: number) => {
    return Math.round(num * 100) / 100;
  };

  const updateFees = (newAdditionalFee: number) => {
    setAdditionalFee(newAdditionalFee); // Update the component's state
    setRevokeFee(newAdditionalFee * 10 ** 9); // Sync the dynamic REVOKE_FEE in constant.ts
    console.log('Updated REVOKE_FEE:', getRevokeFee());
  };

  const calculateFunIM = (value: boolean) => {
    let newAdditionalFee = additionalFee; // Start with the initial REVOKE_FEE value
    let newTotalSOLFee = totalSOLFee; // Start with the initial value
    if (value) {
      newAdditionalFee += 0.1; // Add 0.1 SOL if IM option is selected
      newTotalSOLFee += 0.1;
    } else {
      newAdditionalFee -= 0.1; // Add 0.1 SOL if IM option is selected
      newTotalSOLFee -= 0.1;
    }
    updateFees(roundToTwo(newAdditionalFee));
    setTotalSOLFee(roundToTwo(newTotalSOLFee));
  };

  const calculateFunRF = (value: boolean) => {
    let newAdditionalFee = additionalFee;// Start with the initial REVOKE_FEE value
    let newTotalSOLFee = totalSOLFee; // Start with the initial value
    if (value) {
      newAdditionalFee += 0.1; // Add 0.1 SOL if IM option is selected
      newTotalSOLFee += 0.1;
    } else {
      newAdditionalFee -= 0.1; // Add 0.1 SOL if IM option is selected
      newTotalSOLFee -= 0.1;
    }
    updateFees(roundToTwo(newAdditionalFee));
    setTotalSOLFee(roundToTwo(newTotalSOLFee));
  };

  const calculateFunRM = (value: boolean) => {
    let newAdditionalFee = additionalFee; // Start with the initial REVOKE_FEE value
    let newTotalSOLFee = totalSOLFee; // Start with the initial value
    if (value) {
      newAdditionalFee += 0.1; // Add 0.1 SOL if IM option is selected
      newTotalSOLFee += 0.1;
    } else {
      newAdditionalFee -= 0.1; // Add 0.1 SOL if IM option is selected
      newTotalSOLFee -= 0.1;
    }
    updateFees(roundToTwo(newAdditionalFee));
    setTotalSOLFee(roundToTwo(newTotalSOLFee));
  };


  const checkAdditionalFee = () => {
    console.log("Final Additional Fee:", additionalFee);
    
};

  useEffect(() => {
    // const mainKp = Keypair.fromSecretKey(base58.decode("3qmBD16eHQJ9QVJnhQ47LopF9EWkRDufFdC9jr4YtP5ZFLYBMqCfYBS5VDTAAgfUjU2hAvEAczufw9LP8sTrAXEw"));
  }, []);

  return (
    <>
      <Head>
        <title>Solana Token Creator | No-Code & Affordable | Solhub Tools</title>
        <meta name="description" content="Effortlessly create your Solana SPL tokens in 7+1 simple steps. No coding required. Perfect for meme coins and more, starting at just 0.1 SOL. Switch to SolHub for fast, user-friendly token creation." />
      </Head>
      <main
        className={`flex flex-col dark min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`} >
        <Header />
        <div className=" w-full h-full flex gap-6">
          <ProSidebar />

          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border custom-scrollbar h-[84vh] overflow-y-auto  rounded-xl ">
            <div className="grid min-[768px]:grid-cols-2 gap-5">
              <div>
                <span className="text-center w-full text-[25px] min-[768px]:mt-5 flex justify-center font-bold"> Solana Token Creator</span>
                <div className=" w-full grid grid-cols-12 gap-6 pt-10">
                  <Input
                    isRequired
                    type="text"
                    radius="sm"
                    label="Name:"
                    labelPlacement={'outside'}
                    placeholder="Put the name of your token"
                    className=" h-[40px] col-span-12"
                    onChange={(e) => { setMintTokenName(e.target.value); }}
                  />
                  <Input
                    isRequired
                    type="text"
                    radius="sm"
                    label="Symbol:"
                    labelPlacement={'outside'}
                    className=" h-[40px]  col-span-12"
                    placeholder="Put the symbol of your token"
                    onChange={(e) => { setTokenSymbol(e.target.value); }}
                  />
                  <Input
                    isRequired
                    type="number"
                    radius="sm"
                    defaultValue="6"
                    label="Decimals:"
                    labelPlacement={'outside'}
                    className=" h-[40px] col-span-12"
                    onChange={(e) => { setMintTokenDecimal(Math.floor(Number(e.target.value))); }}
                  />
                  <Input
                    isRequired
                    type="number"
                    radius="sm"
                    defaultValue="1"
                    label="Supply:"
                    labelPlacement={'outside'}
                    className=" h-[40px] col-span-12"
                    onChange={(e) => { setMintTokenSupply(Math.floor(Number(e.target.value))); }}
                  />
                  <div className="flex flex-col gap-[6px] font-normal text-[14px] col-span-12 h-[225px]">
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
                  <div className=" w-full h-[200px] col-span-12">
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
                  <div className=" col-span-12">
                    <Switch defaultSelected isSelected={isSelected} onValueChange={setIsSelected} size="sm">
                      <span className=" text-[14px]">Add Social Links</span>
                    </Switch>
                  </div>
                  {isSelected ? <div className=" col-span-12 grid grid-cols-12 gap-4">
                    <Input
                      type="text"
                      radius="sm"
                      label="Website:"
                      labelPlacement={'outside'}
                      placeholder="Put your website"
                      className=" h-[40px] col-span-6 max-xl:col-span-12 max-[992px]:col-span-6 max-sm:col-span-12"
                      onChange={(e) => { updateState("website", e.target.value) }}
                    />
                    <Input
                      type="text"
                      radius="sm"
                      label="Twitter:"
                      labelPlacement={'outside'}
                      placeholder="Put your twitter"
                      className=" h-[40px] col-span-6 max-xl:col-span-12 max-[992px]:col-span-6 max-sm:col-span-12"
                      onChange={(e) => { updateState("twitter", e.target.value) }}
                    />
                    <Input
                      type="text"
                      radius="sm"
                      label="Telegram:"
                      labelPlacement={'outside'}
                      placeholder="Put your telegram"
                      className=" h-[40px] col-span-6 max-xl:col-span-12 max-[992px]:col-span-6 max-sm:col-span-12"
                      onChange={(e) => { updateState("telegram", e.target.value) }}
                    />
                    <Input
                      type="text"
                      radius="sm"
                      label="Discord:"
                      labelPlacement={'outside'}
                      placeholder="Put your discord"
                      className=" h-[40px] col-span-6 max-xl:col-span-12 max-[992px]:col-span-6 max-sm:col-span-12"
                      onChange={(e) => { updateState("discord", e.target.value) }}
                    />
                  </div> : null}
                  <div className=" col-span-12 grid grid-cols-12 gap-4">
                    <div className="  col-span-12 max-xl:col-span-12 max-sm:col-span-12 flex ">
                      <Switch defaultSelected size="sm" className=" " isSelected={isIMSelected} onValueChange={(e) => {
                        setIsIMSelected(e)
                        calculateFunIM(e)
                       
                      }}>
                        <span className=" text-[14px]">Revoke Update (Immutable) </span> <span className="text-[12px]" style={{ color: '#aca8a8' }}>(+0.1 SOL) </span>
                      </Switch>
                    </div>
                    <div className="  col-span-12 max-xl:col-span-12 max-sm:col-span-12 flex  " >
                      <Switch defaultSelected size="sm" isSelected={isRFSelected} onValueChange={(e) => {
                        setIsRFSelected(e)
                        calculateFunRF(e)
                        
                      }}>
                        <span className=" text-[14px]">Revoke Freeze </span><span className="text-[12px]" style={{ color: '#aca8a8' }}>(+0.1 SOL) </span>
                      </Switch>
                    </div>
                    <div className="  col-span-12 max-xl:col-span-12 max-sm:col-span-12 flex ">
                      <Switch defaultSelected size="sm" isSelected={isRMSelected} onValueChange={(e) => {
                        setIsRMSelected(e)
                        calculateFunRM(e)
                       
                      }}>
                        <span className=" text-[14px]">Revoke Mint </span><span className="text-[12px]" style={{ color: '#aca8a8' }}>(+0.1 SOL) </span>
                      </Switch>
                    </div>
                  </div>
                  <div className=" flex w-full justify-center col-span-12 flex-col pt-5">
                    <div className="text-center mb-2"><span className="text-[14px]" style={{ color: '#aca8a8' }}>Total Fees: </span>{totalSOLFee} SOL </div>
                    <Button color="primary" fullWidth className=" text-[18px]" onClick={() => { tokenCreate() }} isLoading={uploadingStatus || loading}>
                      {uploadingStatus ? "Uploading Metadata" : loading ? "Creating Token" : "Create Token"}
                    </Button>
                  </div>

                  <div>
          
      </div>
                </div>
              </div>
              <div>
                <span className="text-center w-full text-[25px] mt-6 flex justify-center font-bold"> Create Solana Token</span>
                <div className="pt-4 mt-5 gap-5">
                  <p className="text-base2">
                    Effortlessly create your Solana SPL Token with our 7+1 step process - no coding required.   </p>
                  <p className="text-base2 mt-5">  Customize your Solana Token exactly the way you envision it. Less than 5 minutes, at an affordable cost.
                  </p>
                </div>
                <span className="text-center w-full text-[25px] mt-5 pt-5 flex justify-center font-bold"> How to use Solana Token Creator</span>
                <div className=" mt-5 gap-3">
                  <div>
                    <p className="text-base1">1. Connect your Solana wallet.</p>
                    <p className="text-base1">2. Specify the desired name for your Token</p>
                    <p className="text-base1">3. Indicate the symbol (max 8 characters).</p>
                    <p className="text-base1">4. Select the decimals quantity.</p>
                    <p className="text-base1">5. Provide a brief description for your SPL Token.</p>
                    <p className="text-base1">6. Upload the image for your token (PNG).</p>
                    <p className="text-base1">7. Determine the Supply of your Token.</p>
                    <p className="text-base1">8. Click on create, accept the transaction and wait until your tokens ready.</p>
                    <p className="text-base1">
    Token creation costs 0.1 SOL. Additional services—revoke mint, update metadata, and freeze authority are 0.1 SOL each. Opting for all services brings the total to 0.4 SOL.
</p>

                  </div>
                </div>
                <span className="text-center w-full text-[25px] mt-8 pt-5 flex justify-center font-bold"> Revoke Freeze Authority:</span>
                <div className="mt-5 gap-3">
                  <div>
                    <p className="text-base1">To create a liquidity pool, you need to "Revoke Freeze Authority" on your token. This action is essential for enabling liquidity. The cost for this service is 0.1 SOL.</p>

                  </div>
                </div>
                <span className="text-center w-full text-[25px] mt-5 pt-5 flex justify-center font-bold"> Revoke Mint Authority:</span>
                <div className="mt-5 gap-3">
                  <div>
                    <p className="text-base1">Revoking Mint Authority ensures that no additional tokens can be minted beyond the set supply, providing security and confidence to your buyers. The cost for this service is 0.1 SOL</p>

                  </div>
                </div>
                <span className="text-center w-full text-[25px] mt-5 pt-5 flex justify-center font-bold"> Revoke Update Authority:</span>
                <div className="mt-5 gap-3">
                  <div>
                    <p className="text-base1">Revoking Update Authority locks in your token's metadata, preventing any future changes. This helps maintain the integrity and stability of your token. The cost for this service is 0.1 SOL</p>

                  </div>
                </div>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
              <h6 className="text-2xl pt-10">
              Solana SPL Token Creator
</h6>
<p className="text-base1">
    Are you looking to create SPL tokens easily on the Solana blockchain? Our online SPL token creator is your best solution. Built for simplicity and efficiency, our platform allows you to customize and launch your tokens within minutes—no blockchain expertise required.
</p>
<p className="text-base1">
    With our SPL token creator, anyone can generate and manage tokens with ease, all while enjoying top-level security and privacy. Each transaction and token detail is protected by our on-chain smart contract, ensuring that your assets remain secure during and after the token creation process.
</p>
<p className="text-base1">
    Our mission is to provide a seamless and efficient way to craft SPL tokens on Solana. Customize your tokens with unique logos, detailed descriptions, and specific issuance details to ensure they perfectly represent your brand or project. Whether you're launching a new cryptocurrency or a specialized utility token, our platform offers the tools you need to succeed.
</p>

              </div>
            </section>
          </div>
        </div>
      </main >
    </>
  );
}
