import { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from '@solana/web3.js';
import { WalletModalProvider, WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

const WalletConnectionManager = () => {
  const { wallet, connected, disconnect, select } = useWallet();

  useEffect(() => {
    // Force disconnect and clear selection on mount
    disconnect().then(() => select('')).catch(console.error);
  }, [disconnect, select]);

  return (
    <div style={{ color: 'white', padding: '10px', textAlign: 'center' }}>
      {wallet ? (
        <div>
          <p>Connected to {wallet.adapter?.name}</p>
          {!connected && <p>Wallet not connected. Please connect your wallet.</p>}
        </div>
      ) : (
        <p>No wallet connected</p>
      )}
      <div style={{ marginTop: '20px' }}>
        <WalletDisconnectButton style={{ marginRight: '10px' }} />
        <WalletMultiButton />
      </div>
    </div>
  );
};

function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const [isClient, setIsClient] = useState(false);



  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network }),
    new TorusWalletAdapter()
  ], [network]);

  if (!isClient) {
    return null; // Avoid rendering on the server or if the client is not ready
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}> {/* autoConnect disabled */}
        <WalletModalProvider>
          <div style={{ backgroundColor: 'black', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <WalletConnectionManager />
            <div>Test Application</div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
