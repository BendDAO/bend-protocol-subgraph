import {
  BalanceTransfer as ATokenTransfer,
  Mint as BTokenMint,
  Burn as BTokenBurn,
} from "../../../generated/templates/BToken/BToken";
import { Mint as DebtTokenMint, Burn as DebtTokenBurn } from "../../../generated/templates/DebtToken/DebtToken";
import {
  BTokenBalanceHistoryItem,
  DebtTokenBalanceHistoryItem,
  UserReserve,
  Reserve,
  BTokenEventHistoryItem,
  DebtTokenEventHistoryItem,
} from "../../../generated/schema";
import {
  getOrInitBToken,
  getOrInitReserve,
  getOrInitUserReserve,
  getOrInitDebtToken,
  getOrInitUser,
  getPriceOracleAsset,
  getOrInitPriceOracle,
  getOrInitReserveParamsHistoryItem,
} from "../../helpers/initializers";
import { TOKEN_EVENT_BURN, TOKEN_EVENT_MINT, TOKEN_EVENT_TRANSFER, zeroAddress, zeroBI } from "../../utils/converters";
import { calculateUtilizationRate } from "../../helpers/reserve-logic";
import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { rayDiv, rayMul } from "../../helpers/math";
import { getReserveOracleId } from "../../utils/id-generation";
import {
  DEVELOP_TREASURY_ADDRESS,
  RINKEBY_TREASURY_ADDRESS,
  MAINNET_TREASURY_ADDRESS,
  ZERO_ADDRESS,
} from "../../utils/constants";

function saveUserReserveBHistory(userReserve: UserReserve, event: ethereum.Event, index: BigInt): void {
  let bTokenBalanceHistoryItem = new BTokenBalanceHistoryItem(userReserve.id + event.transaction.hash.toHexString());
  bTokenBalanceHistoryItem.scaledBTokenBalance = userReserve.scaledBTokenBalance;
  bTokenBalanceHistoryItem.currentBTokenBalance = userReserve.currentBTokenBalance;
  bTokenBalanceHistoryItem.userReserve = userReserve.id;
  bTokenBalanceHistoryItem.index = index;
  bTokenBalanceHistoryItem.timestamp = event.block.timestamp.toI32();
  bTokenBalanceHistoryItem.save();
}

function saveUserReserveVHistory(userReserve: UserReserve, event: ethereum.Event, index: BigInt): void {
  let dTokenBalanceHistoryItem = new DebtTokenBalanceHistoryItem(userReserve.id + event.transaction.hash.toHexString());

  dTokenBalanceHistoryItem.scaledVariableDebt = userReserve.scaledVariableDebt;
  dTokenBalanceHistoryItem.currentVariableDebt = userReserve.currentVariableDebt;
  dTokenBalanceHistoryItem.userReserve = userReserve.id;
  dTokenBalanceHistoryItem.index = index;
  dTokenBalanceHistoryItem.timestamp = event.block.timestamp.toI32();
  dTokenBalanceHistoryItem.save();
}

function saveBTokenEventHistory(
  userReserve: UserReserve,
  event: ethereum.Event,
  eventType: string,
  amount: BigInt,
  to: Bytes
): void {
  let eventHistoryItem = new BTokenEventHistoryItem(userReserve.id + event.transaction.hash.toHexString());
  eventHistoryItem.pool = userReserve.pool;
  eventHistoryItem.user = userReserve.user;
  eventHistoryItem.userReserve = userReserve.id;
  eventHistoryItem.eventType = eventType;
  eventHistoryItem.amount = amount;
  eventHistoryItem.to = to;
  eventHistoryItem.timestamp = event.block.timestamp.toI32();
  eventHistoryItem.save();
}

function saveDebtTokenEventHistory(
  userReserve: UserReserve,
  event: ethereum.Event,
  eventType: string,
  amount: BigInt
): void {
  let eventHistoryItem = new DebtTokenEventHistoryItem(userReserve.id + event.transaction.hash.toHexString());
  eventHistoryItem.pool = userReserve.pool;
  eventHistoryItem.user = userReserve.user;
  eventHistoryItem.userReserve = userReserve.id;
  eventHistoryItem.eventType = eventType;
  eventHistoryItem.amount = amount;
  eventHistoryItem.timestamp = event.block.timestamp.toI32();
  eventHistoryItem.save();
}

function saveReserve(reserve: Reserve, event: ethereum.Event): void {
  reserve.utilizationRate = calculateUtilizationRate(reserve);
  reserve.save();

  let reserveParamsHistoryItem = getOrInitReserveParamsHistoryItem(event.transaction.hash, reserve);
  reserveParamsHistoryItem.totalScaledVariableDebt = reserve.totalScaledVariableDebt;
  reserveParamsHistoryItem.totalCurrentVariableDebt = reserve.totalCurrentVariableDebt;
  reserveParamsHistoryItem.lifetimeScaledVariableDebt = reserve.lifetimeScaledVariableDebt;
  reserveParamsHistoryItem.lifetimeCurrentVariableDebt = reserve.lifetimeCurrentVariableDebt;
  reserveParamsHistoryItem.lifetimeDeposits = reserve.lifetimeDeposits;
  reserveParamsHistoryItem.lifetimeWithdrawals = reserve.lifetimeWithdrawals;
  reserveParamsHistoryItem.lifetimeBorrows = reserve.lifetimeBorrows;
  reserveParamsHistoryItem.lifetimeRepayments = reserve.lifetimeRepayments;
  reserveParamsHistoryItem.lifetimeReserveFactorAccrued = reserve.lifetimeReserveFactorAccrued;
  reserveParamsHistoryItem.lifetimeDepositorsInterestEarned = reserve.lifetimeDepositorsInterestEarned;
  reserveParamsHistoryItem.availableLiquidity = reserve.availableLiquidity;
  reserveParamsHistoryItem.totalLiquidity = reserve.totalLiquidity;
  reserveParamsHistoryItem.utilizationRate = reserve.utilizationRate;
  reserveParamsHistoryItem.variableBorrowRate = reserve.variableBorrowRate;
  reserveParamsHistoryItem.variableBorrowIndex = reserve.variableBorrowIndex;
  reserveParamsHistoryItem.liquidityIndex = reserve.liquidityIndex;
  reserveParamsHistoryItem.liquidityRate = reserve.liquidityRate;
  reserveParamsHistoryItem.totalBTokenSupply = reserve.totalBTokenSupply;
  let priceOracleAsset = getPriceOracleAsset(reserve.underlyingAsset.toHexString(), getReserveOracleId());
  reserveParamsHistoryItem.priceInEth = priceOracleAsset.priceInEth;

  let priceOracle = getOrInitPriceOracle(getReserveOracleId());
  if (priceOracle.usdPriceEthFormated.gt(zeroBI())) {
    reserveParamsHistoryItem.priceInUsd = reserveParamsHistoryItem.priceInEth
      .toBigDecimal()
      .div(priceOracle.usdPriceEthFormated.toBigDecimal());
  }

  reserveParamsHistoryItem.timestamp = event.block.timestamp.toI32();
  reserveParamsHistoryItem.save();
}

function tokenBurn(event: ethereum.Event, from: Address, value: BigInt, index: BigInt): void {
  let aToken = getOrInitBToken(event.address);
  let userReserve = getOrInitUserReserve(from, aToken.underlyingAssetAddress as Address, event);
  let poolReserve = getOrInitReserve(aToken.underlyingAssetAddress as Address, event);

  let calculatedAmount = rayDiv(value, index);

  userReserve.scaledBTokenBalance = userReserve.scaledBTokenBalance.minus(calculatedAmount);
  userReserve.currentBTokenBalance = rayMul(userReserve.scaledBTokenBalance, index);
  userReserve.variableBorrowIndex = poolReserve.variableBorrowIndex;
  userReserve.liquidityRate = poolReserve.liquidityRate;

  poolReserve.availableLiquidity = poolReserve.availableLiquidity.minus(value);
  poolReserve.totalBTokenSupply = poolReserve.totalBTokenSupply.minus(value);

  poolReserve.totalLiquidity = poolReserve.totalLiquidity.minus(value);
  poolReserve.lifetimeWithdrawals = poolReserve.lifetimeWithdrawals.plus(value);

  saveReserve(poolReserve, event);

  userReserve.lifetimeWithdrawals = userReserve.lifetimeWithdrawals.plus(value);
  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  saveUserReserveBHistory(userReserve, event, index);
}

function tokenMint(event: ethereum.Event, from: Address, value: BigInt, index: BigInt): void {
  let bToken = getOrInitBToken(event.address);
  let poolReserve = getOrInitReserve(bToken.underlyingAssetAddress as Address, event);
  poolReserve.totalBTokenSupply = poolReserve.totalBTokenSupply.plus(value);
  // Check if we are minting to treasury for mainnet, rinkeby, develop
  let fromHexStr = from.toHexString().toString();
  if (
    fromHexStr == DEVELOP_TREASURY_ADDRESS ||
    fromHexStr == RINKEBY_TREASURY_ADDRESS ||
    fromHexStr == MAINNET_TREASURY_ADDRESS
  ) {
    // mint bTokens to treasury address
    poolReserve.lifetimeReserveFactorAccrued = poolReserve.lifetimeReserveFactorAccrued.plus(value);
    saveReserve(poolReserve, event);
  } else {
    // not treasury address
    let userReserve = getOrInitUserReserve(from, bToken.underlyingAssetAddress as Address, event);
    let calculatedAmount = rayDiv(value, index);

    userReserve.scaledBTokenBalance = userReserve.scaledBTokenBalance.plus(calculatedAmount);
    userReserve.currentBTokenBalance = rayMul(userReserve.scaledBTokenBalance, index);

    userReserve.liquidityRate = poolReserve.liquidityRate;
    userReserve.variableBorrowIndex = poolReserve.variableBorrowIndex;

    userReserve.lifetimeDeposits = userReserve.lifetimeDeposits.plus(value);

    userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();

    userReserve.save();

    poolReserve.availableLiquidity = poolReserve.availableLiquidity.plus(value);
    poolReserve.totalLiquidity = poolReserve.totalLiquidity.plus(value);
    poolReserve.lifetimeDeposits = poolReserve.lifetimeDeposits.plus(value);

    saveReserve(poolReserve, event);
    saveUserReserveBHistory(userReserve, event, index);
  }
}

export function handleBTokenBurn(event: BTokenBurn): void {
  let bToken = getOrInitBToken(event.address);
  let poolReserve = getOrInitReserve(bToken.underlyingAssetAddress as Address, event);
  let userReserve = getOrInitUserReserve(event.params.from, bToken.underlyingAssetAddress as Address, event);

  tokenBurn(event, event.params.from, event.params.value, event.params.index);

  saveBTokenEventHistory(userReserve, event, TOKEN_EVENT_BURN, event.params.value, zeroAddress());
}

export function handleBTokenMint(event: BTokenMint): void {
  let bToken = getOrInitBToken(event.address);
  let userReserve = getOrInitUserReserve(event.params.from, bToken.underlyingAssetAddress as Address, event);

  tokenMint(event, event.params.from, event.params.value, event.params.index);

  saveBTokenEventHistory(userReserve, event, TOKEN_EVENT_MINT, event.params.value, event.params.from);
}

export function handleBTokenTransfer(event: ATokenTransfer): void {
  let bToken = getOrInitBToken(event.address);
  let userReserve = getOrInitUserReserve(event.params.from, bToken.underlyingAssetAddress as Address, event);

  tokenBurn(event, event.params.from, event.params.value, event.params.index);
  tokenMint(event, event.params.to, event.params.value, event.params.index);

  saveBTokenEventHistory(userReserve, event, TOKEN_EVENT_TRANSFER, event.params.value, event.params.to);
}

export function handleDebtTokenBurn(event: DebtTokenBurn): void {
  let dToken = getOrInitDebtToken(event.address);
  let from = event.params.user;
  let value = event.params.amount;
  let index = event.params.index;
  let userReserve = getOrInitUserReserve(from, dToken.underlyingAssetAddress as Address, event);
  let poolReserve = getOrInitReserve(dToken.underlyingAssetAddress as Address, event);

  let calculatedAmount = rayDiv(value, index);
  userReserve.scaledVariableDebt = userReserve.scaledVariableDebt.minus(calculatedAmount);
  userReserve.currentVariableDebt = rayMul(userReserve.scaledVariableDebt, index);
  userReserve.currentTotalDebt = userReserve.currentVariableDebt;

  poolReserve.totalScaledVariableDebt = poolReserve.totalScaledVariableDebt.minus(calculatedAmount);
  poolReserve.totalCurrentVariableDebt = rayMul(poolReserve.totalScaledVariableDebt, index);

  poolReserve.availableLiquidity = poolReserve.availableLiquidity.plus(value);
  poolReserve.lifetimeRepayments = poolReserve.lifetimeRepayments.plus(value);

  userReserve.liquidityRate = poolReserve.liquidityRate;
  userReserve.variableBorrowIndex = poolReserve.variableBorrowIndex;

  userReserve.lifetimeRepayments = userReserve.lifetimeRepayments.plus(value);

  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  saveReserve(poolReserve, event);

  let user = getOrInitUser(from);
  if (userReserve.scaledVariableDebt.equals(zeroBI())) {
    user.borrowedReservesCount -= 1;
    user.save();
  }

  saveUserReserveVHistory(userReserve, event, index);

  saveDebtTokenEventHistory(userReserve, event, TOKEN_EVENT_BURN, value);
}

export function handleDebtTokenMint(event: DebtTokenMint): void {
  let dToken = getOrInitDebtToken(event.address);
  let poolReserve = getOrInitReserve(dToken.underlyingAssetAddress as Address, event);

  let from = event.params.from;

  let value = event.params.value;
  let index = event.params.index;

  let userReserve = getOrInitUserReserve(from, dToken.underlyingAssetAddress as Address, event);

  let user = getOrInitUser(event.params.from);
  if (userReserve.scaledVariableDebt.equals(zeroBI())) {
    user.borrowedReservesCount += 1;
    user.save();
  }

  let calculatedAmount = rayDiv(value, index);
  userReserve.scaledVariableDebt = userReserve.scaledVariableDebt.plus(calculatedAmount);
  userReserve.currentVariableDebt = rayMul(userReserve.scaledVariableDebt, index);

  userReserve.currentTotalDebt = userReserve.currentVariableDebt;

  userReserve.liquidityRate = poolReserve.liquidityRate;
  userReserve.variableBorrowIndex = poolReserve.variableBorrowIndex;

  userReserve.lifetimeBorrows = userReserve.lifetimeBorrows.plus(value);

  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  poolReserve.totalScaledVariableDebt = poolReserve.totalScaledVariableDebt.plus(calculatedAmount);
  poolReserve.totalCurrentVariableDebt = rayMul(poolReserve.totalScaledVariableDebt, index);

  poolReserve.lifetimeScaledVariableDebt = poolReserve.lifetimeScaledVariableDebt.plus(calculatedAmount);
  poolReserve.lifetimeCurrentVariableDebt = rayMul(poolReserve.lifetimeScaledVariableDebt, index);

  poolReserve.availableLiquidity = poolReserve.availableLiquidity.minus(value);
  poolReserve.lifetimeBorrows = poolReserve.lifetimeBorrows.plus(value);

  saveReserve(poolReserve, event);

  saveUserReserveVHistory(userReserve, event, index);

  saveDebtTokenEventHistory(userReserve, event, TOKEN_EVENT_MINT, value);
}
