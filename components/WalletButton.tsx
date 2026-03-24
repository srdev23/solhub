import { FC } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const ChangeWalletButton: FC = () => {
  const { wallet, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const handleChangeWallet = () => {
    setVisible(true); // Opens the wallet selection modal
  };

  if (connected || !wallet) {
    return null; // Hide the button if a wallet is fully connected or no wallet is selected
  }

  return (
    <button
      onClick={handleChangeWallet}
      className="h-[40px] lg:h-[45px] px-3 lg:px-4 hover:bg-gray-700 text-white cus-wallet-btn"
    >
      Wallet
    </button>
  );
};

export default ChangeWalletButton;
