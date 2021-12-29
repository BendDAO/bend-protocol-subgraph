import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Address } from "@graphprotocol/graph-ts/index";

export enum EventTypeRef {
  NoType,
  Deposit,
  Borrow,
  Repay,
  Auction,
  Redeem,
  Liquidate,
  Staked,
  StakeRedeem,
  RewardsAccrued,
  RewardsClaimed,
}

export function getHistoryId(event: ethereum.Event, type: EventTypeRef = EventTypeRef.NoType): string {
  let postfix = type !== EventTypeRef.NoType ? ":" + type.toString() : "";
  return event.transaction.hash.toHexString() + postfix;
}

export function getHistoryEntityId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + ":" + event.logIndex.toString();
}

export function getReserveId(underlyingAsset: Address, poolId: string): string {
  return underlyingAsset.toHexString() + poolId;
}

export function getNftId(underlyingAsset: Address, poolId: string): string {
  return underlyingAsset.toHexString() + poolId;
}

export function getLoanId(loanId: BigInt, poolId: string): string {
  return loanId.toString() + poolId;
}

export function getUserReserveId(userAddress: Address, underlyingAssetAddress: Address, poolId: string): string {
  return userAddress.toHexString() + underlyingAssetAddress.toHexString() + poolId;
}

export function getUserNftId(userAddress: Address, underlyingAssetAddress: Address, poolId: string): string {
  return userAddress.toHexString() + underlyingAssetAddress.toHexString() + poolId;
}

export function getBTokenId(bTokenAddress: Address): string {
  return bTokenAddress.toHexString();
}

export function getDebtTokenId(dTokenAddress: Address): string {
  return dTokenAddress.toHexString();
}

export function getReserveOracleId(): string {
  return "1";
}

export function getNFTOracleId(): string {
  return "2";
}

export function getUserIncentiveId(userAddress: Address, managerAddress: Address): string {
  return userAddress.toHexString() + managerAddress.toHexString();
}

export function getDistributionManagerAssetId(assetAddress: Address, distributionManagerAddress: Address): string {
  return assetAddress.toHexString() + distributionManagerAddress.toHexString();
}

export function getDistributionManagerUserAssetId(
  userAddress: Address,
  assetAddress: Address,
  distributionManagerAddress: Address
): string {
  return userAddress.toHexString() + assetAddress.toHexString() + distributionManagerAddress.toHexString();
}
