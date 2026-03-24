import { NATIVE_MINT } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"

export const COMMITMENT_LEVEL = "confirmed"
export const DEV_RPC = "https://bold-omniscient-season.solana-devnet.quiknode.pro/dc06472b3c09b7d611180b6247869b2a64ffa235"
export const MAIN_RPC = "https://mainnet.helius-rpc.com/?api-key=6aaff7cf-a9ba-433f-8c45-2b45659747a7"
export const KEYPAIR = ""
export const WSOL_ADDRESS = NATIVE_MINT.toBase58();
export const TOKEN_ADDRESS = "9RBJdXaJ1u7RQtsZ5pHPRLnq1dQXCjibQBtyTArr2B2F"
export const BLOCKENGINE_URL = "BLOCKENGINE_URL=mainnet.block-engine.jito.wtf,ny.mainnet.block-engine.jito.wtf,amsterdam.mainnet.block-engine.jito.wtf,frankfurt.mainnet.block-engine.jito.wtf,tokyo.mainnet.block-engine.jito.wtf"
export const JITO_AUTH_KEYPAIR="2hgM3fr1PF1Yq9TJAhTHq8YSKkCBW96v6AAkmdXxB8xSuDpsZ1vUnE1tsXbRmGxHHLWadjM2yjgAgksgKqX154FB"
export const PINATA_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJmZTFjMGJkNS0zZDJiLTQzYzEtYjYyYS00ZTAwYjg2Y2QwZDciLCJlbWFpbCI6InByaW1lQG9zcy5vbmUiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiZGVkNmVlZWYyODI1NDliMTMzNmMiLCJzY29wZWRLZXlTZWNyZXQiOiIwY2RlOTkzZjRiOTRmY2U5NDFmYzljOWYwMTA3NjQ4MDUzMGEyNzNkOWIwOTc5NTAyNWQ4ZTNjZmIxODA2OGI4IiwiZXhwIjoxNzYwOTg2MTk3fQ.k8JOUhGqm-d3PQh64VAb257vwQKBctGrfwwoQ2U6nYk"
export let cluster = "mainnet";
const COMPUTE_UNIT_PRICE = 100_000 

export const FEE_WALLET = new PublicKey(process.env.NEXT_PUBLIC_FEE_WALLET!);
export const CREATE_POOL_FEE = parseFloat(process.env.NEXT_PUBLIC_CREATE_POOL_FEE!) * 10 ** 9;
export const CREATE_MARKET_FEE = parseFloat(process.env.NEXT_PUBLIC_CREATE_MARKET_FEE!) * 10 ** 9;
export const ADD_LIQUIDITY_FEE = parseFloat(process.env.NEXT_PUBLIC_ADD_LIQUIDITY_FEE!) * 10 ** 9;
export const REMOVE_LIQUIDITY_FEE = parseFloat(process.env.NEXT_PUBLIC_REMOVE_LIQUIDITY_FEE!) * 10 ** 9;
export const MINT_FEE = parseFloat(process.env.NEXT_PUBLIC_MINT_FEE!) * 10 ** 9;

export const METEORA_CREATE_POOL_FEE = parseFloat(process.env.NEXT_PUBLIC_METEORA_CREATE_POOL_FEE!) * 10 ** 9;
export const METEORA_ADD_LIQUIDITY_FEE = parseFloat(process.env.NEXT_PUBLIC_METEORA_ADD_LIQUIDITY_FEE!) * 10 ** 9;
export const METEORA_REMOVE_LIQUIDITY_FEE = parseFloat(process.env.NEXT_PUBLIC_METEORA_REMOVE_LIQUIDITY_FEE!) * 10 ** 9;

export const BUMP_FEE = parseFloat(process.env.NEXT_PUBLIC_BUMP_FEE!) * 10 ** 9;
export const BUNDLER_FEE = parseFloat(process.env.NEXT_PUBLIC_BUNDLER_FEE!) * 10 ** 9;
export const VOLUME_FEE = parseFloat(process.env.NEXT_PUBLIC_VOLUME_FEE!) * 10 ** 9;

// Dynamic REVOKE_FEE using a getter and setter
let revokeFee = parseFloat(process.env.NEXT_PUBLIC_REVOKE_FEE!) * 10 ** 9;

export const getRevokeFee = () => Math.floor(revokeFee);

export const setRevokeFee = (newFee: number) => {
  revokeFee = newFee;
};

export const ENV = {
    COMPUTE_UNIT_PRICE,
    // JITO_AUTH_KEYPAIR,
    // JITO_BLOCK_ENGINE_URL
}

