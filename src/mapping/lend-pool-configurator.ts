/* eslint-disable @typescript-eslint/no-inferrable-types */
import { Bytes, Address, ethereum } from "@graphprotocol/graph-ts";

import {
  ReserveInitialized,
  BorrowingDisabledOnReserve,
  BorrowingEnabledOnReserve,
  ReserveActivated,
  ReserveDeactivated,
  ReserveInterestRateChanged,
  ReserveFactorChanged,
  ReserveDecimalsChanged,
  NftInitialized,
  NftConfigurationChanged,
  NftAuctionChanged,
  NftActivated,
  NftDeactivated,
  BTokenUpgraded,
  DebtTokenUpgraded,
} from "../../generated/templates/LendPoolConfigurator/LendPoolConfigurator";
import { IERC20Detailed } from "../../generated/templates/LendPoolConfigurator/IERC20Detailed";
import { IERC721Detailed } from "../../generated/templates/LendPoolConfigurator/IERC721Detailed";
import { BToken as BTokenContract, DebtToken as DebtTokenContract } from "../../generated/templates";
import { InterestRate } from "../../generated/templates/LendPoolConfigurator/InterestRate";
import {
  createMapContractToPool,
  getOrInitBToken,
  getOrInitDebtToken,
  getOrInitReserve,
  getOrInitReserveConfigurationHistoryItem,
  getOrInitNft,
  getOrInitNftConfigurationHistoryItem,
  getPriceOracleAsset,
} from "../helpers/initializers";
import { Reserve, NFT } from "../../generated/schema";
import { oneEther, zeroAddress, zeroBI } from "../utils/converters";
import { getReserveOracleId } from "../utils/id-generation";

export function saveReserve(reserve: Reserve, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let txHash = event.transaction.hash;

  reserve.lastUpdateTimestamp = timestamp;
  reserve.save();

  let configurationHistoryItem = getOrInitReserveConfigurationHistoryItem(txHash, reserve);
  configurationHistoryItem.borrowingEnabled = reserve.borrowingEnabled;
  configurationHistoryItem.isActive = reserve.isActive;
  configurationHistoryItem.isFrozen = reserve.isFrozen;
  configurationHistoryItem.reserveInterestRateStrategy = reserve.reserveInterestRateStrategy;
  configurationHistoryItem.timestamp = timestamp;
  configurationHistoryItem.save();
}

export function saveNft(nft: NFT, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let txHash = event.transaction.hash;

  nft.lastUpdateTimestamp = timestamp;
  nft.save();

  let configurationHistoryItem = getOrInitNftConfigurationHistoryItem(txHash, nft);
  configurationHistoryItem.isActive = nft.isActive;
  configurationHistoryItem.isFrozen = nft.isFrozen;
  configurationHistoryItem.baseLTVasCollateral = nft.baseLTVasCollateral;
  configurationHistoryItem.liquidationThreshold = nft.liquidationThreshold;
  configurationHistoryItem.liquidationBonus = nft.liquidationBonus;
  configurationHistoryItem.timestamp = timestamp;
  configurationHistoryItem.save();
}

export function handleReserveInitialized(event: ReserveInitialized): void {
  let underlyingAssetAddress = event.params.asset; //_reserve;
  let reserve = getOrInitReserve(underlyingAssetAddress, event);

  let ERC20BTokenContract = IERC20Detailed.bind(event.params.bToken);
  let ERC20ReserveContract = IERC20Detailed.bind(underlyingAssetAddress);

  let nameStringCall = ERC20ReserveContract.try_name();
  if (nameStringCall.reverted) {
    reserve.name = "";
  } else {
    reserve.name = nameStringCall.value;
  }

  reserve.symbol = ERC20BTokenContract.symbol().slice(1);

  reserve.decimals = ERC20ReserveContract.decimals();

  updateInterestRateStrategy(reserve, event.params.interestRateAddress, true);

  BTokenContract.create(event.params.bToken);
  createMapContractToPool(event.params.bToken, reserve.pool);
  let bToken = getOrInitBToken(event.params.bToken);
  bToken.underlyingAssetAddress = reserve.underlyingAsset;
  bToken.underlyingAssetDecimals = reserve.decimals;
  bToken.pool = reserve.pool;
  bToken.save();

  DebtTokenContract.create(event.params.debtToken);
  createMapContractToPool(event.params.debtToken, reserve.pool);
  let dToken = getOrInitDebtToken(event.params.debtToken);
  dToken.underlyingAssetAddress = reserve.underlyingAsset;
  dToken.underlyingAssetDecimals = reserve.decimals;
  dToken.pool = reserve.pool;
  dToken.save();

  if (reserve.symbol == "WETH" || reserve.symbol == "ETH") {
    let priceOracleAsset = getPriceOracleAsset(reserve.underlyingAsset.toHexString(), getReserveOracleId());
    priceOracleAsset.priceInEth = oneEther();
    priceOracleAsset.save();
  }

  reserve.bToken = bToken.id;
  reserve.debtToken = dToken.id;
  reserve.isActive = true;
  saveReserve(reserve, event);
}

export function handleNftInitialized(event: NftInitialized): void {
  let underlyingAssetAddress = event.params.asset; //_nft;
  let nft = getOrInitNft(underlyingAssetAddress, event);

  let ERC721BNftContract = IERC721Detailed.bind(event.params.bNft);
  let ERC721NftContract = IERC721Detailed.bind(underlyingAssetAddress);

  let nameStringCall = ERC721NftContract.try_name();
  if (nameStringCall.reverted) {
    nft.name = "";
  } else {
    nft.name = nameStringCall.value;
  }

  nft.symbol = ERC721BNftContract.symbol().slice(1);

  nft.bnftToken = event.params.bNft;
  nft.isActive = true;
  saveNft(nft, event);
}

export function updateInterestRateStrategy(reserve: Reserve, strategy: Bytes, init: boolean = false): void {
  let interestRateStrategyContract = InterestRate.bind(strategy as Address);

  reserve.reserveInterestRateStrategy = strategy;
  reserve.baseVariableBorrowRate = interestRateStrategyContract.baseVariableBorrowRate();
  if (init) {
    reserve.variableBorrowRate = reserve.baseVariableBorrowRate;
  }
  reserve.optimalUtilisationRate = interestRateStrategyContract.OPTIMAL_UTILIZATION_RATE();
  reserve.variableRateSlope1 = interestRateStrategyContract.variableRateSlope1();
  reserve.variableRateSlope2 = interestRateStrategyContract.variableRateSlope2();
}

export function handleReserveInterestRateStrategyChanged(event: ReserveInterestRateChanged): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  // if reserve is not initialize, needed to handle ropsten wrong deployment
  if (reserve.bToken == zeroAddress().toHexString()) {
    return;
  }
  updateInterestRateStrategy(reserve, event.params.strategy, false);
  saveReserve(reserve, event);
}

export function handleBorrowingDisabledOnReserve(event: BorrowingDisabledOnReserve): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.borrowingEnabled = false;
  saveReserve(reserve, event);
}

export function handleBorrowingEnabledOnReserve(event: BorrowingEnabledOnReserve): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.borrowingEnabled = true;
  saveReserve(reserve, event);
}

export function handleReserveActivated(event: ReserveActivated): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.isActive = true;
  saveReserve(reserve, event);
}
export function handleReserveDeactivated(event: ReserveDeactivated): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.isActive = false;
  saveReserve(reserve, event);
}

export function handleReserveFreezed(event: ReserveActivated): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.isFrozen = true;
  saveReserve(reserve, event);
}
export function handleReserveUnfreezed(event: ReserveDeactivated): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.isFrozen = false;
  saveReserve(reserve, event);
}

export function handleReserveFactorChanged(event: ReserveFactorChanged): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.reserveFactor = event.params.factor;
  saveReserve(reserve, event);
}

export function handleReserveDecimalsChanged(event: ReserveDecimalsChanged): void {
  let reserve = getOrInitReserve(event.params.asset, event);
  reserve.decimals = event.params.decimals.toI32();
  saveReserve(reserve, event);
}

export function handleNftConfigurationChanged(event: NftConfigurationChanged): void {
  let nft = getOrInitNft(event.params.asset, event);

  nft.baseLTVasCollateral = event.params.ltv;
  nft.liquidationThreshold = event.params.liquidationThreshold;
  nft.liquidationBonus = event.params.liquidationBonus;
  saveNft(nft, event);
}

export function handleNftAuctionChanged(event: NftAuctionChanged): void {
  let nft = getOrInitNft(event.params.asset, event);

  nft.redeemDuration = event.params.redeemDuration;
  nft.auctionDuration = event.params.auctionDuration;
  nft.redeemFine = event.params.redeemFine;
  saveNft(nft, event);
}

export function handleNftActivated(event: NftActivated): void {
  let nft = getOrInitNft(event.params.asset, event);
  nft.isActive = true;
  saveNft(nft, event);
}
export function handleNftDeactivated(event: NftDeactivated): void {
  let nft = getOrInitNft(event.params.asset, event);
  nft.isActive = false;
  saveNft(nft, event);
}

export function handleNftFreezed(event: NftActivated): void {
  let nft = getOrInitNft(event.params.asset, event);
  nft.isFrozen = true;
  saveNft(nft, event);
}
export function handleNftUnfreezed(event: NftDeactivated): void {
  let nft = getOrInitNft(event.params.asset, event);
  nft.isFrozen = false;
  saveNft(nft, event);
}

export function handleBTokenUpgraded(event: BTokenUpgraded): void {
  let bToken = getOrInitBToken(event.params.proxy);
  bToken.tokenContractImpl = event.params.implementation;
  bToken.save();
}

export function handleDebtTokenUpgraded(event: DebtTokenUpgraded): void {
  let dToken = getOrInitDebtToken(event.params.proxy);
  dToken.tokenContractImpl = event.params.implementation;
  dToken.save();
}
