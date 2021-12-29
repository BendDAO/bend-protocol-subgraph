import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  BToken,
  DebtToken,
  PriceOracle,
  PriceOracleAsset,
  Reserve,
  NFT,
  User,
  UserReserve,
  UserNft,
  Loan,
  ReserveParamsHistoryItem,
  NftParamsHistoryItem,
  ReserveConfigurationHistoryItem,
  NftConfigurationHistoryItem,
  Referrer,
  ChainlinkAggregator,
  ContractToPoolMapping,
  Protocol,
  DistributionManager,
  UserIncentive,
  DistributionManagerAsset,
  DistributionManagerUserAsset,
} from "../../generated/schema";
import { LOAN_STATE_NONE, zeroAddress, zeroBD, zeroBI } from "../utils/converters";
import {
  getBTokenId,
  getDebtTokenId,
  getReserveId,
  getUserReserveId,
  getNftId,
  getUserNftId,
  getLoanId,
  getReserveOracleId,
  getNFTOracleId,
  getUserIncentiveId,
  getDistributionManagerAssetId,
  getDistributionManagerUserAssetId,
} from "../utils/id-generation";

export function getProtocol(): Protocol {
  let protocolId = "1";
  let protocol = Protocol.load(protocolId);
  if (protocol == null) {
    protocol = new Protocol(protocolId);
    protocol.save();
  }
  return protocol as Protocol;
}

export function getPoolByEventContract(event: ethereum.Event): string {
  let contractAddress = event.address.toHexString();
  let contractToPoolMapping = ContractToPoolMapping.load(contractAddress);
  if (contractToPoolMapping === null) {
    throw new Error(contractAddress + "is not registered in ContractToPoolMapping");
  }
  return contractToPoolMapping.pool;
}

export function getPoolByAddress(underlyingAssetAddress: Address): string {
  let contractAddress = underlyingAssetAddress.toHexString();
  let contractToPoolMapping = ContractToPoolMapping.load(contractAddress);
  if (contractToPoolMapping === null) {
    throw new Error(contractAddress + "is not registered in ContractToPoolMapping");
  }
  return contractToPoolMapping.pool;
}

export function getOrInitUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (!user) {
    user = new User(address.toHexString());
    user.borrowedReservesCount = 0;
    user.collateralNftsCount = 0;
    user.save();
  }
  return user as User;
}

function initUserReserve(
  underlyingAssetAddress: Address,
  userAddress: Address,
  poolId: string,
  reserveId: string
): UserReserve {
  let userReserveId = getUserReserveId(userAddress, underlyingAssetAddress, poolId);
  let userReserve = UserReserve.load(userReserveId);
  if (userReserve === null) {
    userReserve = new UserReserve(userReserveId);
    userReserve.pool = poolId;
    userReserve.scaledBTokenBalance = zeroBI();
    userReserve.scaledVariableDebt = zeroBI();
    userReserve.currentBTokenBalance = zeroBI();
    userReserve.currentVariableDebt = zeroBI();
    userReserve.currentTotalDebt = zeroBI();
    userReserve.variableBorrowIndex = zeroBI();
    userReserve.lastUpdateTimestamp = 0;
    userReserve.liquidityRate = zeroBI();

    let user = getOrInitUser(userAddress);
    userReserve.user = user.id;

    userReserve.reserve = reserveId;
    userReserve.save();
  }
  return userReserve as UserReserve;
}

export function getOrInitUserReserveWithIds(
  userAddress: Address,
  underlyingAssetAddress: Address,
  pool: string
): UserReserve {
  let reserveId = getReserveId(underlyingAssetAddress, pool);
  return initUserReserve(underlyingAssetAddress, userAddress, pool, reserveId);
}

export function getOrInitUserReserve(_user: Address, _underlyingAsset: Address, event: ethereum.Event): UserReserve {
  let poolId = getPoolByEventContract(event);
  let reserve = getOrInitReserve(_underlyingAsset, event);
  return initUserReserve(_underlyingAsset, _user, poolId, reserve.id);
}

function initUserNft(underlyingAssetAddress: Address, userAddress: Address, poolId: string, nftId: string): UserNft {
  let userNftId = getUserNftId(userAddress, underlyingAssetAddress, poolId);
  let userNft = UserNft.load(userNftId);
  if (userNft === null) {
    userNft = new UserNft(userNftId);
    userNft.pool = poolId;
    userNft.nftAsset = nftId;
    let user = getOrInitUser(userAddress);
    userNft.user = user.id;

    userNft.totalCollateral = zeroBI();
    userNft.lastUpdateTimestamp = 0;
    userNft.save();
  }
  return userNft as UserNft;
}

export function getOrInitUserNftWithIds(userAddress: Address, underlyingAssetAddress: Address, pool: string): UserNft {
  let nftId = getNftId(underlyingAssetAddress, pool);
  return initUserNft(underlyingAssetAddress, userAddress, pool, nftId);
}

export function getOrInitUserNft(_user: Address, _underlyingAsset: Address, event: ethereum.Event): UserNft {
  let poolId = getPoolByEventContract(event);
  let nft = getOrInitNft(_underlyingAsset, event);
  return initUserNft(_underlyingAsset, _user, poolId, nft.id);
}

export function getOrInitPriceOracle(oracleId: string): PriceOracle {
  let priceOracle = PriceOracle.load(oracleId);
  if (!priceOracle) {
    priceOracle = new PriceOracle(oracleId);
    priceOracle.proxyPriceProvider = zeroAddress();
    priceOracle.usdPriceEth = zeroBI();
    priceOracle.usdPriceEthFormated = zeroBI();
    priceOracle.usdPriceEthMainSource = zeroAddress();
    priceOracle.usdPriceEthFallbackRequired = false;
    priceOracle.lastUpdateTimestamp = 0;
    priceOracle.save();
  }
  return priceOracle as PriceOracle;
}

export function getPriceOracleAsset(id: string, oracleId: string, save: boolean = true): PriceOracleAsset {
  let priceOracleReserve = PriceOracleAsset.load(id);
  if (!priceOracleReserve && save) {
    priceOracleReserve = new PriceOracleAsset(id);
    priceOracleReserve.oracle = getOrInitPriceOracle(oracleId).id;
    priceOracleReserve.priceSource = zeroAddress();
    priceOracleReserve.priceInEth = zeroBI();
    priceOracleReserve.fallbackRequired = false;
    priceOracleReserve.lastUpdateTimestamp = 0;
    priceOracleReserve.save();
  }
  return priceOracleReserve as PriceOracleAsset;
}

export function getOrInitReserve(underlyingAsset: Address, event: ethereum.Event): Reserve {
  let poolId = getPoolByEventContract(event);
  let reserveId = getReserveId(underlyingAsset, poolId);
  let reserve = Reserve.load(reserveId);

  if (reserve === null) {
    reserve = new Reserve(reserveId);
    reserve.underlyingAsset = underlyingAsset;
    reserve.pool = poolId;
    reserve.symbol = "";
    reserve.name = "";
    reserve.decimals = 0;
    reserve.borrowingEnabled = false;
    reserve.isActive = false;
    reserve.isFrozen = false;
    reserve.reserveFactor = zeroBI(); // TODO: is default 0?
    reserve.bToken = zeroAddress().toHexString();
    reserve.debtToken = zeroAddress().toHexString();

    reserve.reserveInterestRateStrategy = new Bytes(1);
    reserve.baseVariableBorrowRate = zeroBI();
    reserve.optimalUtilisationRate = zeroBI();
    reserve.variableRateSlope1 = zeroBI();
    reserve.variableRateSlope2 = zeroBI();

    reserve.utilizationRate = zeroBD();
    reserve.totalLiquidity = zeroBI();
    reserve.totalBTokenSupply = zeroBI();
    reserve.availableLiquidity = zeroBI();
    reserve.liquidityRate = zeroBI();
    reserve.variableBorrowRate = zeroBI();
    reserve.liquidityIndex = zeroBI();
    reserve.variableBorrowIndex = zeroBI();

    reserve.totalScaledVariableDebt = zeroBI();
    reserve.totalCurrentVariableDebt = zeroBI();

    reserve.lifetimeScaledVariableDebt = zeroBI();
    reserve.lifetimeCurrentVariableDebt = zeroBI();

    reserve.lifetimeDeposits = zeroBI();
    reserve.lifetimeWithdrawals = zeroBI();
    reserve.lifetimeBorrows = zeroBI();
    reserve.lifetimeRepayments = zeroBI();
    reserve.lifetimeLiquidated = zeroBI();

    reserve.lifetimeReserveFactorAccrued = zeroBI();
    reserve.lifetimeDepositorsInterestEarned = zeroBI();

    reserve.lastUpdateTimestamp = 0;

    let priceOracleAsset = getPriceOracleAsset(underlyingAsset.toHexString(), getReserveOracleId());
    if (!priceOracleAsset.lastUpdateTimestamp) {
      priceOracleAsset.save();
    }
    reserve.price = priceOracleAsset.id;

    reserve.save();
  }
  return reserve as Reserve;
}

export function getOrInitNft(underlyingAsset: Address, event: ethereum.Event): NFT {
  let poolId = getPoolByEventContract(event);
  let nftId = getNftId(underlyingAsset, poolId);
  let nft = NFT.load(nftId);

  if (nft === null) {
    nft = new NFT(nftId);
    nft.underlyingAsset = underlyingAsset;
    nft.pool = poolId;
    nft.symbol = "";
    nft.name = "";
    nft.isActive = false;
    nft.isFrozen = false;
    nft.baseLTVasCollateral = zeroBI();
    nft.liquidationThreshold = zeroBI();
    nft.liquidationBonus = zeroBI();
    nft.redeemDuration = zeroBI();
    nft.auctionDuration = zeroBI();
    nft.redeemFine = zeroBI();

    nft.totalCollateral = zeroBI();
    nft.bnftToken = zeroAddress();

    nft.lifetimeBorrows = zeroBI();
    nft.lifetimeRepayments = zeroBI();
    nft.lifetimeAuctions = zeroBI();
    nft.lifetimeRedeems = zeroBI();
    nft.lifetimeLiquidated = zeroBI();

    let priceOracleAsset = getPriceOracleAsset(underlyingAsset.toHexString(), getNFTOracleId());
    if (!priceOracleAsset.lastUpdateTimestamp) {
      priceOracleAsset.save();
    }
    nft.price = priceOracleAsset.id;

    nft.lastUpdateTimestamp = 0;

    nft.save();
  }
  return nft as NFT;
}

export function getOrInitLoan(loanId: BigInt, event: ethereum.Event): Loan {
  let poolId = getPoolByEventContract(event);
  let loanIdInDB = getLoanId(loanId, poolId);
  let loan = Loan.load(loanIdInDB);

  if (loan === null) {
    loan = new Loan(loanIdInDB);
    loan.pool = poolId;
    loan.loanId = loanId;
    loan.user = zeroAddress().toHexString();
    loan.state = LOAN_STATE_NONE;
    loan.borrower = zeroAddress().toHexString();
    loan.reserveAsset = zeroAddress().toHexString();
    loan.nftAsset = zeroAddress().toHexString();
    loan.nftTokenId = zeroBI();
    loan.scaledAmount = zeroBI();
    loan.currentAmount = zeroBI();
    loan.bidStartTimestamp = 0;
    loan.bidderAddress = new Bytes(1);
    loan.bidPrice = zeroBI();
    loan.bidBorrowAmount = zeroBI();
    loan.lastUpdateTimestamp = 0;

    loan.save();
  }
  return loan as Loan;
}

export function getChainlinkAggregator(id: string): ChainlinkAggregator {
  let chainlinkAggregator = ChainlinkAggregator.load(id);
  if (!chainlinkAggregator) {
    chainlinkAggregator = new ChainlinkAggregator(id);
    chainlinkAggregator.oracleAsset = "";
  }
  return chainlinkAggregator as ChainlinkAggregator;
}

export function getOrInitDebtToken(dTokenAddress: Address): DebtToken {
  let dTokenId = getDebtTokenId(dTokenAddress);
  let dToken = DebtToken.load(dTokenId);
  if (!dToken) {
    dToken = new DebtToken(dTokenId);
    dToken.underlyingAssetAddress = new Bytes(1);
    dToken.tokenContractImpl = zeroAddress();
    dToken.pool = "";
    dToken.underlyingAssetDecimals = 18;

    dToken.save();
  }
  return dToken as DebtToken;
}

export function getOrInitBToken(bTokenAddress: Address): BToken {
  let bTokenId = getBTokenId(bTokenAddress);
  let bToken = BToken.load(bTokenId);
  if (!bToken) {
    bToken = new BToken(bTokenId);
    bToken.underlyingAssetAddress = new Bytes(1);
    bToken.tokenContractImpl = zeroAddress();
    bToken.pool = "";
    bToken.underlyingAssetDecimals = 18;

    bToken.save();
  }
  return bToken as BToken;
}

export function getOrInitReserveParamsHistoryItem(id: Bytes, reserve: Reserve): ReserveParamsHistoryItem {
  let itemId = id.toHexString() + reserve.id;
  let reserveParamsHistoryItem = ReserveParamsHistoryItem.load(itemId);
  if (!reserveParamsHistoryItem) {
    reserveParamsHistoryItem = new ReserveParamsHistoryItem(itemId);
    reserveParamsHistoryItem.variableBorrowRate = zeroBI();
    reserveParamsHistoryItem.variableBorrowIndex = zeroBI();
    reserveParamsHistoryItem.utilizationRate = zeroBD();
    reserveParamsHistoryItem.liquidityIndex = zeroBI();
    reserveParamsHistoryItem.liquidityRate = zeroBI();
    reserveParamsHistoryItem.totalLiquidity = zeroBI();
    reserveParamsHistoryItem.totalBTokenSupply = zeroBI();
    reserveParamsHistoryItem.availableLiquidity = zeroBI();
    reserveParamsHistoryItem.priceInEth = zeroBI();
    reserveParamsHistoryItem.priceInUsd = zeroBD();
    reserveParamsHistoryItem.reserve = reserve.id;
    reserveParamsHistoryItem.totalScaledVariableDebt = zeroBI();
    reserveParamsHistoryItem.totalCurrentVariableDebt = zeroBI();
    reserveParamsHistoryItem.lifetimeScaledVariableDebt = zeroBI();
    reserveParamsHistoryItem.lifetimeCurrentVariableDebt = zeroBI();
    reserveParamsHistoryItem.lifetimeDeposits = zeroBI();
    reserveParamsHistoryItem.lifetimeWithdrawals = zeroBI();
    reserveParamsHistoryItem.lifetimeBorrows = zeroBI();
    reserveParamsHistoryItem.lifetimeRepayments = zeroBI();
    reserveParamsHistoryItem.lifetimeLiquidated = zeroBI();
    reserveParamsHistoryItem.lifetimeReserveFactorAccrued = zeroBI();
    reserveParamsHistoryItem.lifetimeDepositorsInterestEarned = zeroBI();
  }
  return reserveParamsHistoryItem as ReserveParamsHistoryItem;
}

export function getOrInitReserveConfigurationHistoryItem(id: Bytes, reserve: Reserve): ReserveConfigurationHistoryItem {
  let reserveConfigurationHistoryItem = ReserveConfigurationHistoryItem.load(id.toHexString());
  if (!reserveConfigurationHistoryItem) {
    reserveConfigurationHistoryItem = new ReserveConfigurationHistoryItem(id.toHexString());
    reserveConfigurationHistoryItem.borrowingEnabled = false;
    reserveConfigurationHistoryItem.isActive = false;
    reserveConfigurationHistoryItem.reserveInterestRateStrategy = new Bytes(1);
    reserveConfigurationHistoryItem.reserve = reserve.id;
  }
  return reserveConfigurationHistoryItem as ReserveConfigurationHistoryItem;
}

export function getOrInitNftParamsHistoryItem(id: Bytes, nft: NFT): NftParamsHistoryItem {
  let itemId = id.toHexString() + nft.id;
  let historyItem = NftParamsHistoryItem.load(itemId);
  if (!historyItem) {
    historyItem = new NftParamsHistoryItem(itemId);
    historyItem.totalCollateral = zeroBI();
    historyItem.priceInEth = zeroBI();
    historyItem.priceInUsd = zeroBD();
    historyItem.nftAsset = nft.id;
    historyItem.lifetimeBorrows = zeroBI();
    historyItem.lifetimeRepayments = zeroBI();
    historyItem.lifetimeAuctions = zeroBI();
    historyItem.lifetimeRedeems = zeroBI();
    historyItem.lifetimeLiquidated = zeroBI();
  }
  return historyItem as NftParamsHistoryItem;
}

export function getOrInitNftConfigurationHistoryItem(id: Bytes, nft: NFT): NftConfigurationHistoryItem {
  let nftConfigurationHistoryItem = NftConfigurationHistoryItem.load(id.toHexString());
  if (!nftConfigurationHistoryItem) {
    nftConfigurationHistoryItem = new NftConfigurationHistoryItem(id.toHexString());
    nftConfigurationHistoryItem.isActive = false;
    nftConfigurationHistoryItem.baseLTVasCollateral = zeroBI();
    nftConfigurationHistoryItem.liquidationThreshold = zeroBI();
    nftConfigurationHistoryItem.liquidationBonus = zeroBI();
    nftConfigurationHistoryItem.nftAsset = nft.id;
  }
  return nftConfigurationHistoryItem as NftConfigurationHistoryItem;
}

// @ts-ignore
export function getOrInitReferrer(id: i32): Referrer {
  let referrer = Referrer.load(id.toString());
  if (!referrer) {
    referrer = new Referrer(id.toString());
    referrer.save();
  }
  return referrer as Referrer;
}

export function createMapContractToPool(_contractAddress: Address, pool: string): void {
  let contractAddress = _contractAddress.toHexString();
  let contractToPoolMapping = ContractToPoolMapping.load(contractAddress);

  if (contractToPoolMapping) {
    log.error("contract {} is already registered in the protocol", [contractAddress]);
    throw new Error(contractAddress + "is already registered in the protocol");
  }
  contractToPoolMapping = new ContractToPoolMapping(contractAddress);
  contractToPoolMapping.pool = pool;
  contractToPoolMapping.save();
}

export function getOrInitDistributionManager(address: Address): DistributionManager {
  let distributionManager = DistributionManager.load(address.toHexString());
  if (!distributionManager) {
    distributionManager = new DistributionManager(address.toHexString());
    distributionManager.lastUpdateTimestamp = 0;
    distributionManager.distributionEnd = zeroBI();
    distributionManager.save();
  }

  return distributionManager as DistributionManager;
}

export function initDistributionManagerAsset(
  assetAddress: Address,
  distributionManagerAddress: Address
): DistributionManagerAsset {
  let id = getDistributionManagerAssetId(assetAddress, distributionManagerAddress);
  let distributionManagerAsset = DistributionManagerAsset.load(id);
  if (!distributionManagerAsset) {
    distributionManagerAsset = new DistributionManagerAsset(id);
    distributionManagerAsset.lastUpdateTimestamp = 0;
    let distributionManager = getOrInitDistributionManager(distributionManagerAddress);
    distributionManagerAsset.distributionManager = distributionManager.id;
    distributionManagerAsset.emissionPerSecond = zeroBI();
    distributionManagerAsset.index = zeroBI();
    distributionManagerAsset.save();
  }

  return distributionManagerAsset as DistributionManagerAsset;
}

export function getOrInitDistributionManagerAsset(
  assetAddress: Address,
  distributionManagerAddress: Address
): DistributionManagerAsset {
  getOrInitDistributionManager(distributionManagerAddress);

  return initDistributionManagerAsset(assetAddress, distributionManagerAddress);
}

function initDistributionManagerUserAsset(
  userAddress: Address,
  assetAddress: Address,
  distributionManagerAddress: Address
): DistributionManagerUserAsset {
  let id = getDistributionManagerUserAssetId(userAddress, assetAddress, distributionManagerAddress);
  let distributionManagerUserAsset = DistributionManagerUserAsset.load(id);
  if (!distributionManagerUserAsset) {
    distributionManagerUserAsset = new DistributionManagerUserAsset(id);
    distributionManagerUserAsset.lastUpdateTimestamp = 0;
    let user = getOrInitUser(userAddress);
    distributionManagerUserAsset.user = user.id;
    let distributionManager = getOrInitDistributionManager(distributionManagerAddress);
    distributionManagerUserAsset.distributionManager = distributionManager.id;
    let asset = getOrInitDistributionManagerAsset(assetAddress, distributionManagerAddress);
    distributionManagerUserAsset.asset = asset.id;
    distributionManagerUserAsset.index = zeroBI();
    distributionManagerUserAsset.save();
  }

  return distributionManagerUserAsset as DistributionManagerUserAsset;
}

export function getOrInitDistributionManagerUserAsset(
  userAddress: Address,
  assetAddress: Address,
  distributionManagerAddress: Address
): DistributionManagerUserAsset {
  getOrInitDistributionManagerAsset(assetAddress, distributionManagerAddress);

  return initDistributionManagerUserAsset(userAddress, assetAddress, distributionManagerAddress);
}

function initUserIncentive(userAddress: Address, managerAddress: Address): UserIncentive {
  let userIncentiveId = getUserIncentiveId(userAddress, managerAddress);
  let userIncentive = UserIncentive.load(userIncentiveId);
  if (!userIncentive) {
    userIncentive = new UserIncentive(userIncentiveId);
    let user = getOrInitUser(userAddress);
    userIncentive.user = user.id;
    userIncentive.lastUpdateTimestamp = 0;
    let distributionManager = getOrInitDistributionManager(managerAddress);
    userIncentive.distributionManager = distributionManager.id;
    let asset = getOrInitDistributionManagerAsset(userAddress, managerAddress);
    userIncentive.asset = asset.id;
    let userAsset = getOrInitDistributionManagerUserAsset(userAddress, managerAddress, managerAddress);
    userIncentive.userAsset = userAsset.id;
    userIncentive.reward = zeroBI();

    userIncentive.save();
  }

  return userIncentive as UserIncentive;
}

export function getOrInitUserIncentive(userAddress: Address, managerAddress: Address): UserIncentive {
  getOrInitDistributionManager(managerAddress);

  return initUserIncentive(userAddress, managerAddress);
}
