import { BigInt } from "@graphprotocol/graph-ts";
import {
  Borrow,
  Deposit,
  Liquidate,
  Paused,
  Unpaused,
  Withdraw,
  Repay,
  ReserveDataUpdated,
} from "../../generated/templates/LendPool/LendPool";
import {
  getOrInitReferrer,
  getOrInitReserve,
  getOrInitUser,
  getOrInitUserReserve,
  getOrInitNft,
  getOrInitUserNft,
  getOrInitLoan,
  getPoolByEventContract,
} from "../helpers/initializers";
import {
  Borrow as BorrowAction,
  Deposit as DepositAction,
  Liquidate as LiquidateAction,
  Pool,
  Withdraw as WithdrawAction,
  Repay as RepayAction,
} from "../../generated/schema";
import { EventTypeRef, getHistoryId } from "../utils/id-generation";
import { calculateGrowth } from "../helpers/math";

export function handleDeposit(event: Deposit): void {
  let onBehalfOf = getOrInitUser(event.params.onBehalfOf);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let depositedAmount = event.params.amount;

  let id = getHistoryId(event, EventTypeRef.Deposit);
  if (DepositAction.load(id)) {
    id = id + "0";
  }

  let deposit = new DepositAction(id);
  deposit.pool = poolReserve.pool;
  deposit.user = userReserve.user;
  deposit.onBehalfOf = onBehalfOf.id;
  deposit.userReserve = userReserve.id;
  deposit.reserve = poolReserve.id;
  deposit.amount = depositedAmount;
  deposit.timestamp = event.block.timestamp.toI32();
  if (event.params.referral) {
    let referrer = getOrInitReferrer(event.params.referral);
    deposit.referrer = referrer.id;
  }
  deposit.save();
}

export function handleWithdraw(event: Withdraw): void {
  let toUser = getOrInitUser(event.params.to);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let redeemedAmount = event.params.amount;

  let withdraw = new WithdrawAction(getHistoryId(event, EventTypeRef.Redeem));
  withdraw.pool = poolReserve.pool;
  withdraw.user = userReserve.user;
  withdraw.to = toUser.id;
  withdraw.userReserve = userReserve.id;
  withdraw.reserve = poolReserve.id;
  withdraw.amount = redeemedAmount;
  withdraw.timestamp = event.block.timestamp.toI32();
  withdraw.save();
}

export function handleBorrow(event: Borrow): void {
  let onBehalfOf = getOrInitUser(event.params.onBehalfOf);
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let poolReserve = getOrInitReserve(event.params.reserve, event);

  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let borrow = new BorrowAction(getHistoryId(event, EventTypeRef.Borrow));
  borrow.pool = poolReserve.pool;
  borrow.user = userReserve.user;
  borrow.onBehalfOf = onBehalfOf.id;
  borrow.userReserve = userReserve.id;
  borrow.reserve = poolReserve.id;
  borrow.amount = event.params.amount;
  borrow.borrowRate = event.params.borrowRate;

  borrow.userNft = userNft.id;
  borrow.nftAsset = poolNft.id;
  borrow.nftTokenId = event.params.nftTokenId;
  borrow.loanId = poolLoan.id;

  borrow.timestamp = event.block.timestamp.toI32();
  if (event.params.referral) {
    let referrer = getOrInitReferrer(event.params.referral);
    borrow.referrer = referrer.id;
  }
  borrow.save();
}

export function handlePaused(event: Paused): void {
  let poolId = getPoolByEventContract(event);
  let lendPool = Pool.load(poolId);

  lendPool.paused = true;
  lendPool.save();
}

export function handleUnpaused(event: Unpaused): void {
  let poolId = getPoolByEventContract(event);
  let lendPool = Pool.load(poolId);

  lendPool.paused = false;
  lendPool.save();
}

export function handleRepay(event: Repay): void {
  let repayer = getOrInitUser(event.params.repayer);
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let poolReserve = getOrInitReserve(event.params.reserve, event);

  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  poolReserve.save();

  let repay = new RepayAction(getHistoryId(event, EventTypeRef.Repay));
  repay.pool = poolReserve.pool;
  repay.user = userReserve.user;
  repay.repayer = repayer.id;
  repay.userReserve = userReserve.id;
  repay.reserve = poolReserve.id;
  repay.amount = event.params.amount;

  repay.userNft = userNft.id;
  repay.nftAsset = poolNft.id;
  repay.nftTokenId = event.params.nftTokenId;
  repay.loanId = poolLoan.id;

  repay.timestamp = event.block.timestamp.toI32();
  repay.save();
}

export function handleLiquidate(event: Liquidate): void {
  let user = getOrInitUser(event.params.user);
  let onBehalfOf = getOrInitUser(event.params.onBehalfOf);

  let debtUserReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let debtReserve = getOrInitReserve(event.params.reserve, event);
  debtReserve.save();

  let collateralUserNft = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let collateralNft = getOrInitNft(event.params.nftAsset, event);
  collateralNft.lifetimeLiquidated = collateralNft.lifetimeLiquidated.plus(event.params.repayAmount);
  collateralNft.save();

  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let liquidate = new LiquidateAction(getHistoryId(event, EventTypeRef.Liquidate));
  liquidate.pool = collateralNft.pool;
  liquidate.user = user.id;
  liquidate.onBehalfOf = onBehalfOf.id;
  liquidate.nftAsset = collateralNft.id;
  liquidate.nftTokenId = event.params.nftTokenId;
  liquidate.loanId = poolLoan.id;
  liquidate.liquidator = event.params.liquidator;
  liquidate.repayAmount = event.params.repayAmount;
  liquidate.borrowerAmount = event.params.borrowerAmount;
  liquidate.timestamp = event.block.timestamp.toI32();
  liquidate.save();
}

export function handleReserveDataUpdated(event: ReserveDataUpdated): void {
  let reserve = getOrInitReserve(event.params.reserve, event);
  reserve.variableBorrowRate = event.params.variableBorrowRate;
  reserve.variableBorrowIndex = event.params.variableBorrowIndex;
  let timestamp = event.block.timestamp;
  let prevTimestamp = BigInt.fromI32(reserve.lastUpdateTimestamp);
  if (timestamp.gt(prevTimestamp)) {
    let growth = calculateGrowth(reserve.totalBTokenSupply, reserve.liquidityRate, prevTimestamp, timestamp);
    reserve.totalBTokenSupply = reserve.totalBTokenSupply.plus(growth);
    reserve.lifetimeDepositorsInterestEarned = reserve.lifetimeDepositorsInterestEarned.plus(growth);
  }
  reserve.liquidityRate = event.params.liquidityRate;
  reserve.liquidityIndex = event.params.liquidityIndex;
  reserve.lastUpdateTimestamp = event.block.timestamp.toI32();

  reserve.save();
}
