import { BigInt } from "@graphprotocol/graph-ts";
import {
  Initialized,
  LoanCreated,
  LoanUpdated,
  LoanRepaid,
  LoanLiquidated,
} from "../../generated/templates/LendPoolLoan/LendPoolLoan";
import { getOrInitReserve, getOrInitNft, getOrInitLoan } from "../helpers/initializers";
import { getLoanState } from "../utils/converters";
import { rayDiv, rayMul } from "../helpers/math";

export function handleInitialized(event: Initialized): void {
  // no need to do this, address provider had done it
  //createMapContractToPool(event.address, event.pool);
}

export function handleLoanCreated(event: LoanCreated): void {
  let poolReserve = getOrInitReserve(event.params.reserveAsset, event);
  let poolNft = getOrInitNft(event.params.nftAsset, event);
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let calculatedAmount = rayDiv(event.params.amount, event.params.borrowIndex);

  poolLoan.nftAsset = poolNft.id;
  poolLoan.nftTokenId = event.params.nftTokenId;
  poolLoan.reserveAsset = poolReserve.id;
  poolLoan.scaledAmount = calculatedAmount;
  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);
  poolLoan.state = getLoanState(new BigInt(2)); // active

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
}

export function handleLoanUpdated(event: LoanUpdated): void {
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  let calculatedAmountAdded = rayDiv(event.params.amountAdded, event.params.borrowIndex);
  let calculatedAmountTakend = rayDiv(event.params.amountAdded, event.params.borrowIndex);

  poolLoan.scaledAmount = poolLoan.scaledAmount.plus(calculatedAmountAdded);
  poolLoan.scaledAmount = poolLoan.scaledAmount.minus(calculatedAmountTakend);
  poolLoan.currentAmount = rayMul(poolLoan.scaledAmount, event.params.borrowIndex);

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
}

export function handleLoanRepaid(event: LoanRepaid): void {
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  poolLoan.currentAmount = event.params.amount;
  poolLoan.state = getLoanState(new BigInt(3)); // repaid

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
}

export function handleLoanLiquidated(event: LoanLiquidated): void {
  let poolLoan = getOrInitLoan(event.params.loanId, event);

  poolLoan.currentAmount = event.params.amount;
  poolLoan.state = getLoanState(new BigInt(4)); // defaulted(liquidated)

  poolLoan.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolLoan.save();
}
