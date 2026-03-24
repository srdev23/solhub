import { useMemo, useState, useEffect } from "react";
import type { AppProps } from "next/app";
import { NextUIProvider } from "@nextui-org/react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter, LedgerWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider, WalletMultiButton, WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'simplebar-react/dist/simplebar.min.css';
import "@/styles/globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { AppProvider } from "@/components/context";

const WalletConnectionManager = () => {
  const { wallet, connected, disconnect } = useWallet();

 
};

export default function App({ Component, pageProps }: AppProps) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof navigator !== 'undefined') {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }
  }, []);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network }),
    new TorusWalletAdapter(),
    new LedgerWalletAdapter()
  ], [network]);

  useEffect(() => {
    // Check for Phantom Wallet but only on desktop
    if (isClient && !isMobile) {
      if (!window.solana || !window.solana.isPhantom) {
        toast.error(
          <div style={{ textAlign: 'center' }}>
            Phantom Wallet not detected.<br />
            <button onClick={() => window.open("https://phantom.app/download", "_blank")} style={{
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              padding: '5px 5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              transition: 'background-color 0.3s ease',
              display: 'inline-block',
              margin: '10px auto',
              textAlign: 'center',
              width: '100%',
              maxWidth: '350px'
            }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005bb5')}
               onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0070f3')}
            >
              Download Phantom
            </button>
          </div>,
          {
            position: "top-right",
            autoClose: 1500,
            closeOnClick: true,
            theme: "dark",
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            style: {
              width: '90%',
              maxWidth: '300px',
              margin: '5rem auto',
              padding: '15px',
              fontSize: '14px'
            }
          }
        );
      }
    }
  }, [isClient, isMobile]);

  if (!isClient) {
    return null; // Avoid rendering on the server or if the client is not ready
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          <NextUIProvider>
            <AppProvider>
              <ToastContainer theme="dark" />
              {isClient ? <Component {...pageProps} /> : null}
            </AppProvider>
          </NextUIProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
