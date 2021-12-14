import {
  RedeemHistoryItem,
  RewardsAccruedHistoryItem,
  RewardsClaimedHistoryItem,
  StakedHistoryItem,
} from "../../generated/schema";
import {
  AssetConfigUpdated,
  AssetIndexUpdated,
  DistributionEndUpdated,
  Redeem,
  RewardsAccrued,
  RewardsClaimed,
  Staked,
  Transfer,
  UserIndexUpdated,
} from "../../generated/StakedBend/StakedBend";
import {
  getOrInitDistributionManager,
  getOrInitDistributionManagerAsset,
  getOrInitDistributionManagerUserAsset,
  getOrInitUser,
  getOrInitUserStakedBend,
} from "../helpers/initializers";
import { EventTypeRef, getHistoryId } from "../utils/id-generation";

export function handleAssetConfigUpdated(event: AssetConfigUpdated): void {
  let distributionManagerAsset = getOrInitDistributionManagerAsset(event.params.asset, event.address);
  distributionManagerAsset.emissionPerSecond = event.params.emission;
  distributionManagerAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  distributionManagerAsset.save();
}

export function handleAssetIndexUpdated(event: AssetIndexUpdated): void {
  let distributionManagerAsset = getOrInitDistributionManagerAsset(event.params.asset, event.address);
  distributionManagerAsset.index = event.params.index;
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

export function handleStaked(event: Staked): void {
  getOrInitUser(event.params.onBehalfOf);
  let userStake = getOrInitUserStakedBend(event.params.onBehalfOf, event.address);

  userStake.balance = userStake.balance.plus(event.params.amount);
  userStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  userStake.save();

  let history = new StakedHistoryItem(getHistoryId(event, EventTypeRef.Staked));
  history.timestamp = event.block.timestamp.toI32();
  history.amount = event.params.amount;
  history.from = getOrInitUser(event.params.from).id;
  history.userStakedBend = userStake.id;
  history.save();
}

export function handleRedeem(event: Redeem): void {
  getOrInitUser(event.params.from);
  let userStake = getOrInitUserStakedBend(event.params.from, event.address);

  userStake.balance = userStake.balance.minus(event.params.amount);
  userStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  userStake.save();

  let history = new RedeemHistoryItem(getHistoryId(event, EventTypeRef.StakeRedeem));
  history.timestamp = event.block.timestamp.toI32();
  history.amount = event.params.amount;
  history.to = getOrInitUser(event.params.to).id;
  history.userStakedBend = userStake.id;
  history.save();
}

export function handleRewardsAccrued(event: RewardsAccrued): void {
  getOrInitUser(event.params.user);
  let userStake = getOrInitUserStakedBend(event.params.user, event.address);

  userStake.reward = userStake.reward.plus(event.params.amount);
  userStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  userStake.save();

  let history = new RewardsAccruedHistoryItem(getHistoryId(event, EventTypeRef.RewardsAccrued));
  history.timestamp = event.block.timestamp.toI32();
  history.amount = event.params.amount;
  history.userStakedBend = userStake.id;
  history.save();
}

export function handleRewardsClaimed(event: RewardsClaimed): void {
  getOrInitUser(event.params.from);
  let userStake = getOrInitUserStakedBend(event.params.from, event.address);

  userStake.reward = userStake.reward.minus(event.params.amount);
  userStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  userStake.save();

  let history = new RewardsClaimedHistoryItem(getHistoryId(event, EventTypeRef.RewardsAccrued));
  history.timestamp = event.block.timestamp.toI32();
  history.amount = event.params.amount;
  history.to = getOrInitUser(event.params.to).id;
  history.userStakedBend = userStake.id;
  history.save();
}

export function handleTransfer(event: Transfer): void {
  let fromUserStake = getOrInitUserStakedBend(event.params.from, event.address);

  fromUserStake.balance = fromUserStake.balance.minus(event.params.value);
  fromUserStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  fromUserStake.save();

  let toUserStake = getOrInitUserStakedBend(event.params.to, event.address);

  toUserStake.balance = toUserStake.balance.plus(event.params.value);
  toUserStake.lastUpdateTimestamp = event.block.timestamp.toI32();
  toUserStake.save();
}
