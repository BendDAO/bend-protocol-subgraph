import {
  RewardsAccruedHistoryItem,
  RewardsClaimedHistoryItem,
} from "../../generated/schema";
import {
  AssetConfigUpdated,
  AssetIndexUpdated,
  DistributionEndUpdated,
  RewardsAccrued,
  RewardsClaimed,
  UserIndexUpdated,
} from "../../generated/IncentivesController/IncentivesController";
import {
  getOrInitDistributionManager,
  getOrInitDistributionManagerAsset,
  getOrInitDistributionManagerUserAsset,
  getOrInitUser,
  getOrInitUserIncentive,
} from "../helpers/initializers";
import { EventTypeRef, getHistoryId } from "../utils/id-generation";

export function handleAssetConfigUpdated(event: AssetConfigUpdated): void {
  let distributionManagerAsset = getOrInitDistributionManagerAsset(event.params._asset, event.address);
  distributionManagerAsset.emissionPerSecond = event.params._emissionPerSecond;
  distributionManagerAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  distributionManagerAsset.save();
}

export function handleAssetIndexUpdated(event: AssetIndexUpdated): void {
  let distributionManagerAsset = getOrInitDistributionManagerAsset(event.params._asset, event.address);
  distributionManagerAsset.index = event.params._index;
  distributionManagerAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  distributionManagerAsset.save();
  distributionManagerAsset.save();
}

export function handleUserIndexUpdated(event: UserIndexUpdated): void {
  let distributionManagerUserAsset = getOrInitDistributionManagerUserAsset(
    event.params.user,
    event.params.asset,
    event.address
  );

  distributionManagerUserAsset.index = event.params.index;
  distributionManagerUserAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  distributionManagerUserAsset.save();
}

export function handleDistributionEndUpdated(event: DistributionEndUpdated): void {
  let distributionManager = getOrInitDistributionManager(event.address);
  distributionManager.distributionEnd = event.params.newDistributionEnd;
  distributionManager.lastUpdateTimestamp = event.block.timestamp.toI32();

  distributionManager.save();
}

export function handleRewardsAccrued(event: RewardsAccrued): void {
  getOrInitUser(event.params._user);
  let userIncentive = getOrInitUserIncentive(event.params._user, event.address);

  userIncentive.reward = userIncentive.reward.plus(event.params._amount);
  userIncentive.lastUpdateTimestamp = event.block.timestamp.toI32();
  userIncentive.save();

  let history = new RewardsAccruedHistoryItem(getHistoryId(event, EventTypeRef.RewardsAccrued));
  history.timestamp = event.block.timestamp.toI32();
  history.amount = event.params._amount;
  history.userIncentive = userIncentive.id;
  history.save();
}

export function handleRewardsClaimed(event: RewardsClaimed): void {
  getOrInitUser(event.params._user);
  let userStake = getOrInitUserIncentive(event.params._user, event.address);

  userStake.reward = userStake.reward.minus(event.params._amount);
  userStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  userStake.save();

  let history = new RewardsClaimedHistoryItem(getHistoryId(event, EventTypeRef.RewardsAccrued));
  history.timestamp = event.block.timestamp.toI32();
  history.amount = event.params._amount;
  history.userIncentive = userStake.id;
  history.save();
}
