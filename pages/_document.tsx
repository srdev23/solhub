import { Html, Head, Main, NextScript } from "next/document";

const meta = {
  title: 'SolHub | Solana Token Management & Liquidity Solutions',
  description: '"SolHub makes creating and managing Solana tokens effortless with one-click token minting, seamless liquidity pool management, and easy authority revocation. Streamline your blockchain operations with our user-friendly platform. Start building your Solana tokens today!',
  icons: "/favicon.ico",
  url: "https://www.solhub.io",
  keywords: "Create Solana Token, Solana Token Maker, Solana SPL Token Creation, No-Code Solana Token, Solana Token Management, Mint Solana Tokens, Solana Liquidity Pool, Revoke Solana Token Authority, Solana Token Tools, Solana Token Freezing, Solana, Solana Blockchain Tools, Affordable Solana Token Creation, Meme Coin Maker Solana, Fast Solana Token Management, User-Friendly Solana Tools, SolHub Solana Tools, Solana Token Creation Steps, Solana Token Management Platform, Secure Solana Token Management, Solana Token Creation Tool, How to Mint Solana Token, Liquidity Pool on Solana, Token Minting on Solana, Revoke Authority for Solana Token, Freeze Authority in Solana, No-Code Token Creation Solana, Solana Token Launch Guide, SPL Token Creation, Solana Token Distribution, Build Liquidity Pool Solana, Manage Solana Tokens Easily, Solana Token Features, Token Authority Management Solana, Step-by-Step Token Creation Solana, Solana Token Supply Management",
  author: "SolHub Team",
  themeColor: "#00FF00",
  type: "website",

  // Platform-Specific Images
  images: {
    facebook: "/images/Facebook/FB_preview.jpg",
    twitter: "/images/X_Twitter/X_preview1.jpg",
    linkedin: "/images/LinkedIn/LinkedIn_preview2.jpg",
    telegram: "/images/Telegram/Telegram_preview2.jpg",
    whatsapp: "/images/Whatsapp/Whatsapp_preview2.png",
  },
  
};

export default function Document() {
  return (
    <Html lang="en" data-bs-theme="dark" data-theme="dark" className="dark" style={{ colorScheme: "dark" }}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="follow, index" />
        <meta name="description" content={meta.description} />
        <meta name="keywords" content={meta.keywords} />
        <meta name="author" content={meta.author} />
        <link rel="canonical" href={meta.url} />
        <link rel="icon" href={meta.icons} sizes="any" />
        <meta name="theme-color" content={meta.themeColor} />

        {/* Facebook & Instagram */}
        <meta property="og:type" content={meta.type} />
        <meta property="og:site_name" content="SolHub" />
        <meta property="og:title" content="SolHub | Manage Solana Tokens & Liquidity Pools" />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={meta.url} />
        <meta property="og:image" content={meta.images.facebook} />  {/* Facebook/Instagram Image */}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@solhub" /> {/* Replace with your Twitter handle */}
        <meta name="twitter:title" content="SolHub | Solana Token Management & Minting" />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.images.twitter} />  {/* Twitter Image */}
        <meta name="twitter:url" content={meta.url} />

        {/* LinkedIn */}
        <meta property="og:title" content="SolHub | Solana Blockchain Token Minting & Management" />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={meta.url} />
        <meta property="og:image" content={meta.images.linkedin} />  {/* LinkedIn Image */}

        {/* WhatsApp */}
        <meta property="og:title" content="SolHub | Secure Your Solana Tokens & Liquidity Pools" />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={meta.url} />
        <meta property="og:image" content={meta.images.whatsapp} />  {/* WhatsApp Image */}

        {/* Telegram */}
        <meta property="og:title" content="SolHub | Complete Solana Token & Liquidity Management" />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={meta.url} />
        <meta property="og:image" content={meta.images.telegram} />  {/* Telegram Image */}

      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
