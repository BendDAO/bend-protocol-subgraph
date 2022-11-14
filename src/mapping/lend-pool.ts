import { BigInt } from "@graphprotocol/graph-ts";
import {
  Borrow,
  Deposit,
  Auction,
  Redeem,
  Liquidate,
  Paused,
  Unpaused,
  Withdraw,
  Repay,
  ReserveDataUpdated,
  PausedTimeUpdated,
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
  Auction as AuctionAction,
  Redeem as RedeemAction,
  Liquidate as LiquidateAction,
  Pool,
  Withdraw as WithdrawAction,
  Repay as RepayAction,
  UserTransactionHistoryItem,
} from "../../generated/schema";
import { EventTypeRef, getHistoryEntityId, getHistoryId } from "../utils/id-generation";
import { calculateGrowth } from "../helpers/math";
import {
  TX_TYPE_AUCTION,
  TX_TYPE_BORROW,
  TX_TYPE_DEPOSIT,
  TX_TYPE_LIQUIDATE,
  TX_TYPE_REDEEM,
  TX_TYPE_REPAY,
  TX_TYPE_WITHDRAW,
  zeroBI,
} from "../utils/converters";

export function handlePaused(event: Paused): void {
  let poolId = getPoolByEventContract(event);
  let lendPool = Pool.load(poolId);

  lendPool.paused = true;
  lendPool.pauseStartTime = event.block.timestamp;
  lendPool.save();
}

export function handleUnpaused(event: Unpaused): void {
  let poolId = getPoolByEventContract(event);
  let lendPool = Pool.load(poolId);

  lendPool.paused = false;
  lendPool.pauseDurationTime = event.block.timestamp.minus(lendPool.pauseStartTime);
  if (lendPool.pauseDurationTime.lt(zeroBI())) {
    lendPool.pauseDurationTime = zeroBI();
  }
  lendPool.save();
}

export function handlePausedTimeUpdated(event: PausedTimeUpdated): void {
  let poolId = getPoolByEventContract(event);
  let lendPool = Pool.load(poolId);

  lendPool.pauseStartTime = event.params.startTime;
  lendPool.pauseDurationTime = event.params.durationTime;
  lendPool.save();
}

export function handleDeposit(event: Deposit): void {
  let onBehalfOf = getOrInitUser(event.params.onBehalfOf);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let depositedAmount = event.params.amount;

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_DEPOSIT;
  userTx.onBehalfOf = onBehalfOf.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.reserve = poolReserve.id;
  userTx.amount = depositedAmount;
  userTx.save();

  let id = getHistoryId(event, EventTypeRef.Deposit);
  if (DepositAction.load(id)) {
    id = id + "0";
  }

  let deposit = new DepositAction(id);
  deposit.userTx = userTx.id;
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

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_WITHDRAW;
  userTx.onBehalfOf = toUser.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.reserve = poolReserve.id;
  userTx.amount = redeemedAmount;
  userTx.save();

  let withdraw = new WithdrawAction(getHistoryId(event, EventTypeRef.Redeem));
  withdraw.userTx = userTx.id;
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

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_BORROW;
  userTx.onBehalfOf = onBehalfOf.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.nftAsset = poolNft.id;
  userTx.nftTokenId = event.params.nftTokenId;
  userTx.loan = poolLoan.id;
  userTx.reserve = poolReserve.id;
  userTx.amount = event.params.amount;
  userTx.save();

  let borrow = new BorrowAction(getHistoryId(event, EventTypeRef.Borrow));
  borrow.userTx = userTx.id;
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
  borrow.loan = poolLoan.id;

  borrow.timestamp = event.block.timestamp.toI32();
  if (event.params.referral) {
    let referrer = getOrInitReferrer(event.params.referral);
    borrow.referrer = referrer.id;
  }
  borrow.save();
}

export function handleRepay(event: Repay): void {
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let borrower = getOrInitUser(event.params.borrower);

  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  poolReserve.save();

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_REPAY;
  userTx.onBehalfOf = borrower.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.nftAsset = poolNft.id;
  userTx.nftTokenId = event.params.nftTokenId;
  userTx.loan = poolLoan.id;
  userTx.reserve = poolReserve.id;
  userTx.amount = event.params.amount;
  userTx.save();

  let repay = new RepayAction(getHistoryId(event, EventTypeRef.Repay));
  repay.userTx = userTx.id;
  repay.pool = poolReserve.pool;
  repay.user = userReserve.user;
  repay.userReserve = userReserve.id;
  repay.reserve = poolReserve.id;

  repay.userNft = userNft.id;
  repay.nftAsset = poolNft.id;
  repay.nftTokenId = event.params.nftTokenId;
  repay.borrower = borrower.id;
  repay.loan = poolLoan.id;

  repay.amount = event.params.amount;

  repay.timestamp = event.block.timestamp.toI32();
  repay.save();
}

export function handleAuction(event: Auction): void {
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let onBehalfOf = getOrInitUser(event.params.onBehalfOf);
  let borrower = getOrInitUser(event.params.borrower);

  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_AUCTION;
  userTx.onBehalfOf = onBehalfOf.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.nftAsset = poolNft.id;
  userTx.nftTokenId = event.params.nftTokenId;
  userTx.loan = poolLoan.id;
  userTx.reserve = poolReserve.id;
  userTx.amount = event.params.bidPrice;
  userTx.save();

  let auction = new AuctionAction(getHistoryId(event, EventTypeRef.Auction));
  auction.userTx = userTx.id;
  auction.pool = poolReserve.pool;
  auction.user = userReserve.user;
  auction.userReserve = userReserve.id;
  auction.reserve = poolReserve.id;

  auction.userNft = userNft.id;
  auction.nftAsset = poolNft.id;
  auction.nftTokenId = event.params.nftTokenId;
  auction.borrower = borrower.id;
  auction.loan = poolLoan.id;

  auction.onBehalfOf = onBehalfOf.id;
  auction.bidPrice = event.params.bidPrice;

  auction.timestamp = event.block.timestamp.toI32();
  auction.save();
}

export function handleRedeem(event: Redeem): void {
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let borrower = getOrInitUser(event.params.borrower);

  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_REDEEM;
  userTx.onBehalfOf = borrower.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.nftAsset = poolNft.id;
  userTx.nftTokenId = event.params.nftTokenId;
  userTx.loan = poolLoan.id;
  userTx.reserve = poolReserve.id;
  userTx.amount = event.params.borrowAmount;
  userTx.save();

  let redeem = new RedeemAction(getHistoryId(event, EventTypeRef.Redeem));
  redeem.userTx = userTx.id;
  redeem.pool = poolReserve.pool;
  redeem.user = userReserve.user;
  redeem.userReserve = userReserve.id;
  redeem.reserve = poolReserve.id;

  redeem.userNft = userNft.id;
  redeem.nftAsset = poolNft.id;
  redeem.nftTokenId = event.params.nftTokenId;
  redeem.borrower = borrower.id;
  redeem.loan = poolLoan.id;

  redeem.repayAmount = event.params.borrowAmount;
  redeem.bidFine = event.params.fineAmount;

  redeem.timestamp = event.block.timestamp.toI32();
  redeem.save();
}

export function handleLiquidate(event: Liquidate): void {
  let userReserve = getOrInitUserReserve(event.params.user, event.params.reserve, event);
  let poolReserve = getOrInitReserve(event.params.reserve, event);
  let borrower = getOrInitUser(event.params.borrower);

  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);

  let debtReserve = getOrInitReserve(event.params.reserve, event);
  debtReserve.save();

  let collateralNft = getOrInitNft(event.params.nftAsset, event);
  collateralNft.lifetimeLiquidated = collateralNft.lifetimeLiquidated.plus(event.params.repayAmount);
  collateralNft.save();

  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let userTx = new UserTransactionHistoryItem(getHistoryEntityId(event));
  userTx.txType = TX_TYPE_LIQUIDATE;
  userTx.onBehalfOf = borrower.id;
  userTx.pool = poolReserve.pool;
  userTx.user = userReserve.user;
  userTx.timestamp = event.block.timestamp.toI32();
  userTx.nftAsset = collateralNft.id;
  userTx.nftTokenId = event.params.nftTokenId;
  userTx.loan = poolLoan.id;
  userTx.reserve = poolReserve.id;
  userTx.amount = event.params.repayAmount;
  userTx.save();

  let liquidate = new LiquidateAction(getHistoryId(event, EventTypeRef.Liquidate));
  liquidate.userTx = userTx.id;
  liquidate.pool = collateralNft.pool;
  liquidate.user = userReserve.user;
  liquidate.reserve = poolReserve.id;
  liquidate.userReserve = userReserve.id;

  liquidate.userNft = userNft.id;
  liquidate.nftAsset = collateralNft.id;
  liquidate.nftTokenId = event.params.nftTokenId;
  liquidate.loan = poolLoan.id;
  liquidate.borrower = borrower.id;

  liquidate.repayAmount = event.params.repayAmount;
  liquidate.remainAmount = event.params.remainAmount;

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
