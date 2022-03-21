import {
  BalanceTransfer as ATokenTransfer,
  Mint as BTokenMint,
  Burn as BTokenBurn,
} from "../../../generated/templates/BToken/BToken";
import { Mint as DebtTokenMint, Burn as DebtTokenBurn } from "../../../generated/templates/DebtToken/DebtToken";
import { BTokenBalanceHistoryItem, DebtTokenBalanceHistoryItem, UserReserve, Reserve } from "../../../generated/schema";
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
import { zeroBI } from "../../utils/converters";
import { calculateUtilizationRate } from "../../helpers/reserve-logic";
import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { rayDiv, rayMul } from "../../helpers/math";
import { getReserveOracleId } from "../../utils/id-generation";
import { DEVELOP_TREASURY_ADDRESS, RINKEBY_TREASURY_ADDRESS, MAINNET_TREASURY_ADDRESS } from "../../utils/constants";

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
    (fromHexStr == DEVELOP_TREASURY_ADDRESS)
    || (fromHexStr == RINKEBY_TREASURY_ADDRESS)
    || (fromHexStr == MAINNET_TREASURY_ADDRESS)
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
  tokenBurn(event, event.params.from, event.params.value, event.params.index);
}

export function handleBTokenMint(event: BTokenMint): void {
  tokenMint(event, event.params.from, event.params.value, event.params.index);
}

export function handleBTokenTransfer(event: ATokenTransfer): void {
  tokenBurn(event, event.params.from, event.params.value, event.params.index);
  tokenMint(event, event.params.to, event.params.value, event.params.index);

  // TODO: is this really necessary(from v1)? if we transfer aToken we are not moving the collateral (underlying token)
  let aToken = getOrInitBToken(event.address);
  let userFromReserve = getOrInitUserReserve(event.params.from, aToken.underlyingAssetAddress as Address, event);
  let userToReserve = getOrInitUserReserve(event.params.to, aToken.underlyingAssetAddress as Address, event);
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
  userReserve.lastUpdateTimestamp = event.block.timestamp.toI32();
  userReserve.save();

  saveReserve(poolReserve, event);

  let user = getOrInitUser(from);
  if (userReserve.scaledVariableDebt.equals(zeroBI())) {
    user.borrowedReservesCount -= 1;
    user.save();
  }

  saveUserReserveVHistory(userReserve, event, index);
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
}
