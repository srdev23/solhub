import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { FC } from "react";

const CustomWalletMultiButton: FC = () => {
  return (
    <div className="rounded-lg custom-wallet-height">
      <WalletMultiButton 
        className="w-50 h-[30px] lg:h-[50px] flex items-center justify-center px-4 lg:px-6 rounded-lg"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem !important',
        }}
      />
    </div>
  );
};

export default CustomWalletMultiButton;
