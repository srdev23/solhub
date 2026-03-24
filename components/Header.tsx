import CustomWalletMultiButton from "./Walletmultibutton"; // Use the customized button
import ChangeWalletButton from "./WalletButton"; // Use the customized button
import { IoMenuOutline } from "react-icons/io5";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAppContext } from "./context";
import Image from 'next/image';
import logo from './Bluewhite_full.png';

export default function Header() {
  const { toggleSidebar } = useAppContext();

  return (
    <div className='flex w-full px-4 max-esm:px-3 sticky top-0 z-50 justify-between gradient-1 backdrop-blur-lg border h-[60px] lg:h-[80px] rounded-xl items-center'>
      <div className="flex items-center gap-3">
        <button className="min-[992px]:hidden" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <IoMenuOutline size={24} />
        </button>
        <span className="inline-block">
        <Image
        src={logo}
        alt="Capital Coin"
        width={150} // Specify width and height
        height={50} // This should match the aspect ratio of your image
        className="w-[130px] lg:w-[180px] h-auto"
      />
</span>

      </div>
      <div className="flex ml-auto items-center gap-2">
        {/* WalletMultiButton div */}
        <div className="rounded-lg  custom-wallet-height flex flex-row">
          <CustomWalletMultiButton />
        </div>
        
        {/* ChangeWalletButton div */}
        <div className="custom-wallet-margin">
          <ChangeWalletButton />
        </div>
      </div>
    </div>
  );
}
