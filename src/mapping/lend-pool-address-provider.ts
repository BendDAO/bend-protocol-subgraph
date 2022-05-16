import { BigInt, ethereum, Value, Address, log, Bytes } from "@graphprotocol/graph-ts";

import {
  AddressSet,
  LendPoolUpdated,
  LendPoolConfiguratorUpdated,
  LendPoolLoanUpdated,
  ReserveOracleUpdated,
  NftOracleUpdated,
  BNFTRegistryUpdated,
  ProxyCreated,
  ConfigurationAdminUpdated,
  EmergencyAdminUpdated,
  IncentivesControllerUpdated,
  UIDataProviderUpdated,
  BendDataProviderUpdated,
  WalletBalanceProviderUpdated,
} from "../../generated/templates/LendPoolAddressesProvider/LendPoolAddressesProvider";
import {
  LendPool as LendPoolContract,
  LendPoolConfigurator as LendPoolConfiguratorContract,
  LendPoolLoan as LendPoolLoanContract,
} from "../../generated/templates";
import { createMapContractToPool, getOrInitPriceOracle } from "../helpers/initializers";
import { Pool, PoolConfigurationHistoryItem } from "../../generated/schema";
import { EventTypeRef, getHistoryId, getNFTOracleId, getReserveOracleId } from "../utils/id-generation";

let POOL_COMPONENTS = [
  "lendPoolConfigurator",
  "lendPoolConfiguratorImpl",
  "lendPool",
  "lendPoolImpl",
  "lendPoolLoan",
  "lendPoolLoanImpl",
  "reserveOracle",
  "nftOracle",
  "bnftRegistry",
  "configurationAdmin",
  "emergencyAdmin",
  "incentivesController",
  "uiDataProvider",
  "bendDataProvider",
  "walletBalanceProvider",
] as string[];

function saveAddressProvider(lendPool: Pool, timestamp: BigInt, event: ethereum.Event): void {
  lendPool.lastUpdateTimestamp = timestamp.toI32();
  lendPool.save();

  let configurationHistoryItem = new PoolConfigurationHistoryItem(getHistoryId(event, EventTypeRef.NoType));
  for (let i = 0; i < POOL_COMPONENTS.length; i++) {
    let param = POOL_COMPONENTS[i];
    let value = lendPool.get(param);
    if (!value) {
      return;
    }
    configurationHistoryItem.set(param, value as Value);
  }
  configurationHistoryItem.timestamp = timestamp.toI32();
  configurationHistoryItem.pool = lendPool.id;
  configurationHistoryItem.save();
}

function genericAddressProviderUpdate(
  component: string,
  newAddress: Address,
  event: ethereum.Event,
  createMapContract: boolean = true
): void {
  if (POOL_COMPONENTS.indexOf(component) < 0) {
    log.error("wrong pool component name {}", [component]);
    throw new Error("wrong pool component name" + component);
  }
  let poolAddress = event.address.toHexString();
  let lendPool = Pool.load(poolAddress);
  if (lendPool == null) {
    log.error("pool {} is not registered!", [poolAddress]);
    throw new Error("pool" + poolAddress + "is not registered!");
  }

  lendPool.set(component, Value.fromAddress(newAddress));
  if (createMapContract) {
    createMapContractToPool(newAddress, lendPool.id);
  }
  saveAddressProvider(lendPool as Pool, event.block.timestamp, event);
}

export function handleProxyCreated(event: ProxyCreated): void {
  let newProxyAddress = event.params.newAddress;
  let contactId = event.params.id.toString();
  let poolComponent: string;

  if (contactId == "LEND_POOL_CONFIGURATOR") {
    poolComponent = "lendPoolConfigurator";
    LendPoolConfiguratorContract.create(newProxyAddress);
  } else if (contactId == "LEND_POOL") {
    poolComponent = "lendPool";
    LendPoolContract.create(newProxyAddress);
  } else if (contactId == "LEND_POOL_LOAN") {
    poolComponent = "lendPoolLoan";
    LendPoolLoanContract.create(newProxyAddress);
  } else {
    return;
  }

  genericAddressProviderUpdate(poolComponent, newProxyAddress, event);
}

// TODO: not completely sure that this should work, as id passed through event can not mach, and proxy? or impl?
export function handleAddressSet(event: AddressSet): void {
  let mappedId = "";

  let addressIdHex = event.params.id.toHexString().slice(0, 6);
  if (addressIdHex == "0xadde") {
    log.error("Address set: {} | Contract ID: {}", [
      event.params.newAddress.toHexString(),
      event.params.id.toHexString(),
    ]);
    return;
  }

  let addressId = event.params.id.toString();
  if (addressId == "LEND_POOL") {
    mappedId = "lendPool";
  } else if (addressId == "LEND_POOL_CONFIGURATOR") {
    mappedId = "lendPoolConfigurator";
  } else if (addressId == "LEND_POOL_LOAN") {
    mappedId = "lendPoolLoan";
  } else if (addressId == "RESERVE_ORACLE") {
    mappedId = "reserveOracle";
  } else if (addressId == "NFT_ORACLE") {
    mappedId = "nftOracle";
  } else if (addressId == "BNFT_REGISTRY") {
    mappedId = "bnftRegistry";
  } else if (addressId == "POOL_ADMIN") {
    mappedId = "configurationAdmin";
  } else if (addressId == "EMERGENCY_ADMIN") {
    mappedId = "emergencyAdmin";
  } else if (addressId == "INCENTIVES_CONTROLLER") {
    mappedId = "incentivesController";
  } else if (addressId == "BEND_DATA_PROVIDER") {
    mappedId = "uiDataProvider";
  } else if (addressId == "UI_DATA_PROVIDER") {
    mappedId = "bendDataProvider";
  } else if (addressId == "WALLET_BALANCE_PROVIDER") {
    mappedId = "walletBalanceProvider";
  }

  if (mappedId != "") {
    genericAddressProviderUpdate(mappedId, event.params.newAddress, event, false);
  } else {
    log.error("Address set: {} | Contract ID: {}", [
      event.params.newAddress.toHexString(),
      event.params.id.toHexString(),
    ]);
  }
}

export function handleReserveOracleUpdated(event: ReserveOracleUpdated): void {
  genericAddressProviderUpdate("reserveOracle", event.params.newAddress, event, false);

  let priceOracle = getOrInitPriceOracle(getReserveOracleId());
  priceOracle.proxyPriceProvider = event.params.newAddress;
  priceOracle.save();
}

export function handleNFTOracleUpdated(event: NftOracleUpdated): void {
  genericAddressProviderUpdate("nftOracle", event.params.newAddress, event, false);

  let priceOracle = getOrInitPriceOracle(getNFTOracleId());
  priceOracle.proxyPriceProvider = event.params.newAddress;
  priceOracle.save();
}

export function handleLendPoolUpdated(event: LendPoolUpdated): void {
  genericAddressProviderUpdate("lendPoolImpl", event.params.newAddress, event, false);
}

export function handleLendPoolConfiguratorUpdated(event: LendPoolConfiguratorUpdated): void {
  genericAddressProviderUpdate("lendPoolConfiguratorImpl", event.params.newAddress, event, false);
}

export function handleLendPoolLoanUpdated(event: LendPoolLoanUpdated): void {
  genericAddressProviderUpdate("lendPoolLoanImpl", event.params.newAddress, event, false);
}

export function handleBNFTRegistryUpdated(event: BNFTRegistryUpdated): void {
  genericAddressProviderUpdate("bnftRegistry", event.params.newAddress, event, false);
}

export function handleConfigurationAdminUpdated(event: ConfigurationAdminUpdated): void {
  genericAddressProviderUpdate("configurationAdmin", event.params.newAddress, event, false);
}

export function handleEmergencyAdminUpdated(event: EmergencyAdminUpdated): void {
  genericAddressProviderUpdate("emergencyAdmin", event.params.newAddress, event, false);
}

export function handleIncentivesControllerUpdated(event: IncentivesControllerUpdated): void {
  genericAddressProviderUpdate("incentivesController", event.params.newAddress, event, false);
}

export function handleUIDataProviderUpdated(event: UIDataProviderUpdated): void {
  genericAddressProviderUpdate("uiDataProvider", event.params.newAddress, event, false);
}

export function handleBendDataProviderUpdated(event: BendDataProviderUpdated): void {
  genericAddressProviderUpdate("bendDataProvider", event.params.newAddress, event, false);
}

export function handleWalletBalanceProviderUpdated(event: WalletBalanceProviderUpdated): void {
  genericAddressProviderUpdate("walletBalanceProvider", event.params.newAddress, event, false);
}
