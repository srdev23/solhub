
import { useState, useEffect } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem, SelectedItems } from "@nextui-org/react";
import { AiOutlineLoading } from "react-icons/ai";
import { FaUpload } from "react-icons/fa6";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import ImageUploading from 'react-images-uploading';
import { createToken, updateToken } from "@/lib/txHandler";
import { PINATA_API_KEY } from "@/lib/constant";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { solanaConnection, devConnection, truncateText, getTokenList } from "@/lib/utils";
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


const pinataPublicURL = "https://gateway.pinata.cloud/ipfs/";

export default function Home() {

  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [uploadingStatus, setUploadLoading] = useState(false);
  const [metaDataURL, setMetaDataURL] = useState("");
  const [tokenList, setTokenList] = useState<TokenData[]>([]);
  const [updateAuth, setUpdateAuth] = useState(true);
  const [updateTokenMint, setUpdateTokenMint] = useState("");
  const [tokenImmutable, setTokenImmutable] = useState(false);

  // Mint Section
  const [mintTokenName, setMintTokenName] = useState("");
  const [mintTokenSymbol, setTokenSymbol] = useState("");
  const [mintTokenDesc, setMintTokenDesc] = useState("");
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
  const [mintFlag, setMintFlag] = useState(false);

  const [images, setImages] = useState<any>([]);
  const [isSelected, setIsSelected] = useState(true);
  const [isIMSelected, setIsIMSelected] = useState(true);
  const [isRFSelected, setIsRFSelected] = useState(true);
  const [isRMSelected, setIsRMSelected] = useState(true);
  const [fetchFlag, setFetchFlag] = useState(false);

  const maxNumber = 1;

  const onChange = (imageList: any, addUpdateIndex: any) => {
    // data for submit
    console.log(imageList, addUpdateIndex);
    setImages(imageList);
  };


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

  const tokenUpdate = async () => {
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

    const tx = await updateToken({
      mint: new PublicKey(updateTokenMint), name: mintTokenName, symbol: mintTokenSymbol, url: "mainnet", metaUri: pinataPublicURL + uploadedJsonUrl, mintRevokeAuthorities: isRMSelected, freezeRevokeAuthorities: isRFSelected, mutable: isIMSelected, wallet: anchorWallet
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
          toastSuccess(`${mintTokenName} token updated successfully!`);
          console.log("txId======>>", txId);

        } catch (error: any) {
          toastError(`${error.message}`);
          setLoading(false);
        }

      }
    }
    console.log("tx==>>", tx);
  }

  const validator = async () => {
    if (updateTokenMint == "") {
      toastError("Select the token!")
      return false;
    }
    if (!tokenImmutable) {
      toastError("This token is immutable")
      return false;
    }
    if (!mintTokenName) {
      toastError("Please enter the token name");
      return false;
    }
    if (!mintTokenSymbol) {
      toastError("Please enter the token symbol");
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
        setTokenImmutable(filtered[0].isMutable);
      } else {
        setUpdateTokenMint("");
        setTokenImmutable(false);
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }
  const faqData = [
    {
      label: 'What is token metadata and why is it important to update it?',
      description: "Token metadata includes details like the token's name, symbol, description, and logo. Updating this information is crucial for maintaining accurate representation and branding of your token on the blockchain and across platforms."
  },
  {
      label: 'How do I update my token’s metadata?',
      description: "To update your token's metadata, select the token address, then modify the desired fields such as name, symbol, or description. You can also upload a new logo and add social media links to enhance your token's presence."
  },
  {
      label: 'What does it mean to revoke update, freeze, and mint authorities?',
      description: "Revoking update authority prevents further changes to your token's metadata, making it immutable. Revoking freeze authority ensures that no account can freeze or unfreeze token transfers. Revoking mint authority stops any additional tokens from being created, fixing the total supply."
  },
  {
      label: 'Can I add social media links to my token?',
      description: "Yes, you can enhance your token’s visibility by adding links to your website, Twitter, Telegram, and Discord. This helps build a community around your token and keeps users engaged and informed."
  },
  {
      label: 'Is it safe to update token metadata and revoke authorities?',
      description: "Yes, both updating your token's metadata and revoking authorities are safe and managed by on-chain smart contracts, ensuring that your decisions are securely implemented on the Solana blockchain."
  }
  
  
  ]

  return (
    <>
      <Head>
        <title>Update Token</title>
        <meta name="description" content="This is the home page of my awesome website." />
      </Head>
      <main
        className={`flex flex-col min-h-screen lg:px-16 px-6 max-esm:px-4 py-6 bg-transparent font-IT w-full gap-5 text-white  2xl:container mx-auto`}
      >
        <Header />
        <div className=" w-full h-full flex gap-6">
          <ProSidebar />
          <div className=" w-full max-esm:px-3 p-5 gradient-1 backdrop-blur-lg border custom-scrollbar h-[84vh] overflow-y-auto  rounded-xl ">
            <span className="text-center w-full text-[25px] flex justify-center font-bold"> Update Token Metadata</span>
            <div className=" w-full grid grid-cols-12 gap-6 pt-10">
              <Select
                isRequired
                label="Token Address"
                labelPlacement="outside"
                className=" col-span-4 max-sm:col-span-12"
                placeholder="Select the Token"
                disableSelectorIconRotation
                items={tokenList.filter((item: any) => item.mint !== "So11111111111111111111111111111111111111112")} // Exclude Native Solana
                onChange={(e) => { changeUpadeteAuth(e.target.value); }}
                isLoading={fetchFlag}
                selectorIcon={<SelectorIcon />}
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
                    <div className=" flex w-full justify-between font-IT items-center">
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
                disabled={updateAuth}
                type="text"
                radius="sm"
                label="Name:"
                labelPlacement={'outside'}
                placeholder="Put the name of your token"
                className=" h-[40px] col-span-4 max-sm:col-span-12"
                onChange={(e) => { setMintTokenName(e.target.value); }}
              />
              <Input
                isRequired
                disabled={updateAuth}
                type="text"
                radius="sm"
                label="Symbol:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-4 max-sm:col-span-12"
                placeholder="Put the symbol of your token"
                onChange={(e) => { setTokenSymbol(e.target.value); }}
              />
              {/* <Input
              isRequired
              type="number"
              radius="sm"
              defaultValue="6"
              label="Decimals:"
              labelPlacement={'outside'}
              className=" h-[40px] col-span-6 max-sm:col-span-12"
              onChange={(e) => { setMintTokenDecimal(Math.floor(Number(e.target.value))); }}
            />
            <Input
              isRequired
              type="number"
              radius="sm"
              defaultValue="1"
              label="Supply:"
              labelPlacement={'outside'}
              className=" h-[40px] col-span-6 max-sm:col-span-12"
              onChange={(e) => { setMintTokenSupply(Math.floor(Number(e.target.value))); }}
            /> */}
              <div className="flex flex-col gap-[6px] font-normal text-[14px] col-span-6 max-sm:col-span-12 h-[225px]">
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
              <div className=" w-full h-[200px] col-span-6 max-sm:col-span-12">
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
                  disabled={updateAuth}
                  type="text"
                  radius="sm"
                  label="Website:"
                  labelPlacement={'outside'}
                  placeholder="Put your website"
                  className=" h-[40px] col-span-3 max-md:col-span-4 max-sm:col-span-6 max-esm:col-span-12"
                  onChange={(e) => { updateState("website", e.target.value) }}
                />
                <Input
                  disabled={updateAuth}
                  type="text"
                  radius="sm"
                  label="Twitter:"
                  labelPlacement={'outside'}
                  placeholder="Put your twitter"
                  className=" h-[40px] col-span-3 max-md:col-span-4 max-sm:col-span-6 max-esm:col-span-12"
                  onChange={(e) => { updateState("twitter", e.target.value) }}
                />
                <Input
                  disabled={updateAuth}
                  type="text"
                  radius="sm"
                  label="Telegram:"
                  labelPlacement={'outside'}
                  placeholder="Put your telegram"
                  className=" h-[40px] col-span-3 max-md:col-span-4 max-sm:col-span-6 max-esm:col-span-12"
                  onChange={(e) => { updateState("telegram", e.target.value) }}
                />
                <Input
                  disabled={updateAuth}
                  type="text"
                  radius="sm"
                  label="Discord:"
                  labelPlacement={'outside'}
                  placeholder="Put your discord"
                  className=" h-[40px] col-span-3 max-md:col-span-4 max-sm:col-span-6 max-esm:col-span-12"
                  onChange={(e) => { updateState("discord", e.target.value) }}
                />
              </div> : null}
              <div className=" col-span-12 grid grid-cols-12 gap-4">
                <div className=" col-span-4 max-sm:col-span-6 flex sm:justify-start ">
                  <Switch defaultSelected size="sm" className=" " isSelected={isIMSelected} onValueChange={setIsIMSelected}>
                    <span className=" text-[14px]">Revoke Update (Immutable)</span>
                  </Switch>
                </div>
                <div className=" col-span-4 max-sm:col-span-6 flex sm:justify-center " >
                  <Switch defaultSelected size="sm" isSelected={isRFSelected} onValueChange={setIsRFSelected}>
                    <span className=" text-[14px]">Revoke Freeze</span>
                  </Switch>
                </div>
                <div className=" col-span-4 max-sm:col-span-6 flex sm:justify-end ">
                  <Switch defaultSelected size="sm" isSelected={isRMSelected} onValueChange={setIsRMSelected}>
                    <span className=" text-[14px]">Revoke Mint</span>
                  </Switch>
                </div>
              </div>
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" fullWidth className=" text-[18px]" onClick={() => { tokenUpdate() }} isLoading={uploadingStatus || loading}>
                  {uploadingStatus ? "Uploading Metadata" : loading ? "Updating Token" : "Update Token"}
                </Button>
              </div>
            </div>
            <section className="max-w-[750px] w-full mx-auto mt-10">
              <Faqs faqData={faqData} />
              <div>
              <h6 className="text-2xl pt-10">
    Update Token Metadata
</h6>
<p className="text-base1">
    Easily update your token’s metadata on the Solana blockchain with our intuitive Update Token Metadata tool. Begin by selecting the token address you want to update, and then enter the new name and symbol for your token. You can also upload a new image to represent your token, ensuring it aligns with your branding.
</p>
<p className="text-base1">
    Enhance your token’s visibility by adding a description and social media links such as your website, Twitter, Telegram, and Discord. These details help users better understand and engage with your token. Additionally, you have the option to revoke update authority, freeze authority, or mint authority, ensuring your token’s security and immutability as needed.
</p>
<p className="text-base1">
    Once you’ve made the desired changes, click "Update Token" to securely save the new metadata. Our platform ensures that all updates are processed on-chain, providing a reliable and efficient way to manage your token’s information.
</p>

              </div>
            </section>
          </div>

        </div>
      </main>
    </>
  );
}
