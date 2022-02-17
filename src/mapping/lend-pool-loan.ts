import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  Initialized,
  LoanCreated,
  LoanUpdated,
  LoanRepaid,
  LoanAuctioned,
  LoanRedeemed,
  LoanLiquidated,
} from "../../generated/templates/LendPoolLoan/LendPoolLoan";
import {
  getOrInitReserve,
  getOrInitNft,
  getOrInitLoan,
  getOrInitUser,
  getOrInitUserNft,
  getOrInitNftParamsHistoryItem,
  getOrInitPriceOracle,
  getPriceOracleAsset,
} from "../helpers/initializers";
import {
  LOAN_STATE_ACTIVE,
  LOAN_STATE_AUCTION,
  LOAN_STATE_DEFAULTED,
  LOAN_STATE_REPAID,
  zeroAddress,
  zeroBI,
} from "../utils/converters";
import { rayDiv, rayMul } from "../helpers/math";
import { Loan, LoanBalanceHistoryItem, NFT, UserNft } from "../../generated/schema";
import { getNFTOracleId, getReserveOracleId } from "../utils/id-generation";
import { ZERO_ADDRESS } from "../utils/constants";

function saveLoanBHistory(loan: Loan, event: ethereum.Event, index: BigInt): void {
  let loanHistoryItem = new LoanBalanceHistoryItem(loan.id + event.transaction.hash.toHexString());
  loanHistoryItem.loan = loan.id;
  loanHistoryItem.currentAmount = loan.currentAmount;
  loanHistoryItem.scaledAmount = loan.scaledAmount;
  loanHistoryItem.index = index;
  loanHistoryItem.timestamp = event.block.timestamp.toI32();
  loanHistoryItem.save();
}

function saveNftHistory(nft: NFT, event: ethereum.Event): void {
  let historyItem = getOrInitNftParamsHistoryItem(event.transaction.hash, nft);
  historyItem.totalCollateral = nft.totalCollateral;
  historyItem.lifetimeBorrows = nft.lifetimeBorrows;
  historyItem.lifetimeRepayments = nft.lifetimeRepayments;
  historyItem.lifetimeAuctions = nft.lifetimeAuctions;
  historyItem.lifetimeRedeems = nft.lifetimeRedeems;
  historyItem.lifetimeLiquidated = nft.lifetimeLiquidated;
  let priceOracleAsset = getPriceOracleAsset(nft.underlyingAsset.toHexString(), getNFTOracleId());
  historyItem.priceInEth = priceOracleAsset.priceInEth;

  let priceOracle = getOrInitPriceOracle(getReserveOracleId());
  if (priceOracle.usdPriceEthFormated.gt(zeroBI())) {
    historyItem.priceInUsd = historyItem.priceInEth.toBigDecimal().div(priceOracle.usdPriceEthFormated.toBigDecimal());
  }

  historyItem.timestamp = event.block.timestamp.toI32();
  historyItem.save();
}

export function handleInitialized(event: Initialized): void {
  // no need to do this, address provider had done it
  //createMapContractToPool(event.address, event.pool);
}

export function handleLoanCreated(event: LoanCreated): void {
  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let borrowerNft = getOrInitUserNft(event.params.onBehalfOf, event.params.nftAsset, event);
  let poolReserve = getOrInitReserve(event.params.reserveAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  borrowerNft.totalCollateral = borrowerNft.totalCollateral.plus(BigInt.fromI32(1));
  borrowerNft.lastUpdateTimestamp = event.block.timestamp.toI32();
  borrowerNft.save();

  poolLoan.user = userNft.user;
  poolLoan.borrower = borrowerNft.user;
  poolLoan.nftAsset = poolNft.id;
  poolLoan.nftTokenId = event.params.nftTokenId;
  poolLoan.reserveAsset = poolReserve.id;

  let calculatedAmount = rayDiv(event.params.amount, event.params.borrowIndex);

  poolLoan.scaledAmount = calculatedAmount;
  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);
  poolLoan.state = LOAN_STATE_ACTIVE; // active

  poolLoan.lifetimeBorrows = poolLoan.lifetimeBorrows.plus(event.params.amount);

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
  saveLoanBHistory(poolLoan, event, event.params.borrowIndex);

  poolNft.totalCollateral = poolNft.totalCollateral.plus(BigInt.fromI32(1));
  poolNft.lifetimeBorrows = poolNft.lifetimeBorrows.plus(BigInt.fromI32(1));
  poolNft.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolNft.save();

  saveNftHistory(poolNft, event);
}

export function handleLoanUpdated(event: LoanUpdated): void {
  let poolLoan = getOrInitLoan(event.params.loanId, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);

  let calculatedAmountAdded = rayDiv(event.params.amountAdded, event.params.borrowIndex);
  let calculatedAmountTaken = rayDiv(event.params.amountTaken, event.params.borrowIndex);

  poolLoan.scaledAmount = poolLoan.scaledAmount.plus(calculatedAmountAdded);
  poolLoan.scaledAmount = poolLoan.scaledAmount.minus(calculatedAmountTaken);
  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);

  poolLoan.lifetimeBorrows = poolLoan.lifetimeBorrows.plus(event.params.amountAdded);
  poolLoan.lifetimeRepays = poolLoan.lifetimeRepays.plus(event.params.amountTaken);

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
  saveLoanBHistory(poolLoan, event, event.params.borrowIndex);

  poolNft.save();

  saveNftHistory(poolNft, event);
}

export function handleLoanRepaid(event: LoanRepaid): void {
  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);

  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);
  poolLoan.state = LOAN_STATE_REPAID; // repaid

  poolLoan.lifetimeRepays = poolLoan.lifetimeRepays.plus(event.params.amount);

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
  saveLoanBHistory(poolLoan, event, event.params.borrowIndex);

  userNft.totalCollateral = userNft.totalCollateral.minus(BigInt.fromI32(1));
  userNft.save();

  poolNft.totalCollateral = poolNft.totalCollateral.minus(BigInt.fromI32(1));
  poolNft.lifetimeRepayments = poolNft.lifetimeRepayments.plus(BigInt.fromI32(1));
  poolNft.save();

  saveNftHistory(poolNft, event);
}

export function handleLoanAuctioned(event: LoanAuctioned): void {
  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);

  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);

  if (poolLoan.state != LOAN_STATE_AUCTION) {
    poolLoan.state = LOAN_STATE_AUCTION; // auction at first time
    poolLoan.bidStartTimestamp = event.block.timestamp.toI32();
  }
  poolLoan.bidderAddress = event.params.bidder;
  poolLoan.bidPrice = event.params.price;
  poolLoan.bidBorrowAmount = event.params.amount;

  poolLoan.lifetimeRepays = poolLoan.lifetimeRepays.plus(event.params.amount);

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
  saveLoanBHistory(poolLoan, event, event.params.borrowIndex);

  poolNft.lifetimeAuctions = poolNft.lifetimeAuctions.plus(BigInt.fromI32(1));
  poolNft.save();

  saveNftHistory(poolNft, event);
}

export function handleLoanRedeemed(event: LoanRedeemed): void {
  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);

  let calculatedAmountTaken = rayDiv(event.params.amountTaken, event.params.borrowIndex);
  poolLoan.scaledAmount = poolLoan.scaledAmount.minus(calculatedAmountTaken);
  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);

  poolLoan.state = LOAN_STATE_ACTIVE;
  poolLoan.bidStartTimestamp = 0;
  poolLoan.bidderAddress = zeroAddress();
  poolLoan.bidPrice = zeroBI();
  poolLoan.bidBorrowAmount = zeroBI();

  poolLoan.lifetimeRedeems = poolLoan.lifetimeRedeems.plus(event.params.amountTaken);

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
  saveLoanBHistory(poolLoan, event, event.params.borrowIndex);

  poolNft.lifetimeRedeems = poolNft.lifetimeRedeems.plus(BigInt.fromI32(1));
  poolNft.save();

  saveNftHistory(poolNft, event);
}

export function handleLoanLiquidated(event: LoanLiquidated): void {
  let userNft = getOrInitUserNft(event.params.user, event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);

  //special case for old liquidate event, liqType = 0 or 1
  // borrowIndex is very bigger number
  if (event.params.borrowIndex <= BigInt.fromI32(1)) {
    poolLoan.currentAmount = event.params.amount;
  } else {
    poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);
  }
  poolLoan.state = LOAN_STATE_DEFAULTED; // defaulted(liquidated)

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
  saveLoanBHistory(poolLoan, event, zeroBI());

  userNft.totalCollateral = userNft.totalCollateral.minus(BigInt.fromI32(1));
  userNft.save();

  poolNft.totalCollateral = poolNft.totalCollateral.minus(BigInt.fromI32(1));
  poolNft.lifetimeLiquidated = poolNft.lifetimeLiquidated.plus(BigInt.fromI32(1));
  poolNft.save();

  saveNftHistory(poolNft, event);
}
