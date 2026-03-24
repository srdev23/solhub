
  export interface MeteoraConfig {
    computeUnitPriceMicroLamports: number;
    dynamicAmm: DynamicAmmConfig | null;
    dlmm: DlmmConfig | null;
  }
  
  export interface CreateBaseMintConfig {
    mintBaseTokenAmount: number | string;
    baseDecimals: number;
  }
  
  export interface DynamicAmmConfig {
    baseAmount: number | string;
    quoteAmount: number | string;
    tradeFeeNumerator: number;
    activationType: ActivationTypeConfig;
    activationPoint: number | null;
    hasAlphaVault: boolean;
  }
  
  export interface DlmmConfig {
    binStep: number;
    feeBps: number;
    initialPrice: number;
    activationType: ActivationTypeConfig;
    activationPoint: number | null;
    priceRounding: PriceRoundingConfig;
    hasAlphaVault: boolean;
  }
  
  export interface FcfsAlphaVaultConfig {
    poolType: PoolTypeConfig;
    alphaVaultType: AlphaVaultTypeConfig;
    // absolute value, depend on the pool activation type it will be the timestamp in secs or the slot number
    depositingPoint: number;
    // absolute value
    startVestingPoint: number;
    // absolute value
    endVestingPoint: number;
    // total max deposit
    maxDepositCap: number;
    // user max deposit
    individualDepositingCap: number;
    // fee to create stake escrow account
    escrowFee: number;
    // whitelist mode: permissionless / permission_with_merkle_proof / permission_with_authority
    whitelistMode: WhitelistModeConfig;
  }
  
  export interface ProrataAlphaVaultConfig {
    poolType: PoolTypeConfig;
    alphaVaultType: AlphaVaultTypeConfig;
    // absolute value, depend on the pool activation type it will be the timestamp in secs or the slot number
    depositingPoint: number;
    // absolute value
    startVestingPoint: number;
    // absolute value
    endVestingPoint: number;
    // total max deposit
    maxBuyingCap: number;
    // fee to create stake escrow account
    escrowFee: number;
    // whitelist mode: permissionless / permission_with_merkle_proof / permission_with_authority
    whitelistMode: WhitelistModeConfig;
  }
  
  export interface LockLiquidityConfig {
    allocations: LockLiquidityAllocation[];
  }
  
  export interface LockLiquidityAllocation {
    percentage: number;
    address: string;
  }
  
  export interface LfgSeedLiquidityConfig {
    minPrice: number;
    maxPrice: number;
    curvature: number;
    seedAmount: string;
    basePositionKeypairFilepath: string;
    operatorKeypairFilepath: string;
    positionOwner: string;
    feeOwner: string;
    lockReleasePoint: number;
    seedTokenXToPositionOwner: boolean;
  }
  
  export interface SingleBinSeedLiquidityConfig {
    price: number;
    priceRounding: string;
    seedAmount: string;
    basePositionKeypairFilepath: string;
    operatorKeypairFilepath: string;
    positionOwner: string;
    feeOwner: string;
    lockReleasePoint: number;
    seedTokenXToPositionOwner: boolean;
  }
  
  export interface M3m3Config {
    topListLength: number;
    unstakeLockDurationSecs: number;
    secondsToFullUnlock: number;
    startFeeDistributeTimestamp: number;
  }
  
  export enum ActivationTypeConfig {
    Slot = "slot",
    Timestamp = "timestamp",
  }
  
  export enum PriceRoundingConfig {
    Up = "up",
    Down = "down",
  }
  
  export enum AlphaVaultTypeConfig {
    Fcfs = "fcfs",
    Prorata = "prorata",
  }
  
  export enum PoolTypeConfig {
    Dynamic = "dynamic",
    Dlmm = "dlmm",
  }
  
  export enum WhitelistModeConfig {
    Permissionless = "permissionless",
    PermissionedWithMerkleProof = "permissioned_with_merkle_proof",
    PermissionedWithAuthority = "permissioned_with_authority",
  }