import { BigInt, ethereum, Value, Address, log } from "@graphprotocol/graph-ts";

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
} from "../../generated/templates/LendPoolAddressesProvider/LendPoolAddressesProvider";
import {
  LendPool as LendPoolContract,
  LendPoolConfigurator as LendPoolConfiguratorContract,
} from "../../generated/templates";
import { createMapContractToPool, getOrInitPriceOracle } from "../helpers/initializers";
import { Pool, PoolConfigurationHistoryItem } from "../../generated/schema";
import { EventTypeRef, getHistoryId } from "../utils/id-generation";

let POOL_COMPONENTS = [
  "lendPoolConfigurator",
  "lendPoolConfiguratorImpl",
  "lendPool",
  "lendPoolImpl",
  "lendPoolLoan",
  "lendPoolImplLoan",
  "reserveOracle",
  "nftOracle",
  "bnftRegistry",
  "configurationAdmin",
  "emergencyAdmin",
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
  if (!POOL_COMPONENTS.includes(component)) {
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

  if (contactId == "LENDING_POOL_CONFIGURATOR") {
    poolComponent = "LendPoolConfigurator";
    LendPoolConfiguratorContract.create(newProxyAddress);
  } else if (contactId == "LENDING_POOL") {
    poolComponent = "lendPool";
    LendPoolContract.create(newProxyAddress);
  } else {
    return;
  }

  genericAddressProviderUpdate(poolComponent, newProxyAddress, event);
}

// TODO: not completely sure that this should work, as id passed through event can not mach, and proxy? or impl?
export function handleAddressSet(event: AddressSet): void {
  let mappedId = "";
  if (event.params.id.toString() == "LEND_POOL") {
    mappedId = "lendPool";
  } else if (event.params.id.toString() == "LEND_POOL_CONFIGURATOR") {
    mappedId = "LendPoolConfigurator";
  } else if (event.params.id.toString() == "LEND_POOL_LOAN") {
    mappedId = "lendPoolLoan";
  } else if (event.params.id.toString() == "RESERVE_ORACLE") {
    mappedId = "reserveOracle";
  } else if (event.params.id.toString() == "NFT_ORACLE") {
    mappedId = "nftOracle";
  } else if (event.params.id.toString() == "BNFT_REGISTRY") {
    mappedId = "bnftRegistry";
  } else if (event.params.id.toString() == "POOL_ADMIN") {
    mappedId = "configurationAdmin";
  } else if (event.params.id.toString() == "EMERGENCY_ADMIN") {
    mappedId = "emergencyAdmin";
  }

  if (mappedId != "") {
    genericAddressProviderUpdate(mappedId, event.params.newAddress, event, false);
  } else {
    log.error("Address set: {} | Contract ID: {}", [event.params.newAddress.toHexString(), event.params.id.toString()]);
  }
}

export function handleReserveOracleUpdated(event: ReserveOracleUpdated): void {
  genericAddressProviderUpdate("reserveOracle", event.params.newAddress, event, false);

  let priceOracle = getOrInitPriceOracle();
  priceOracle.proxyPriceProvider = event.params.newAddress;
  priceOracle.save();
}

export function handleNFTOracleUpdated(event: NftOracleUpdated): void {
  genericAddressProviderUpdate("nftOracle", event.params.newAddress, event, false);
}

export function handleLendPoolUpdated(event: LendPoolUpdated): void {
  genericAddressProviderUpdate("lendPoolImpl", event.params.newAddress, event, false);
}

export function handleLendPoolConfiguratorUpdated(event: LendPoolConfiguratorUpdated): void {
  genericAddressProviderUpdate("lendPoolConfiguratorImpl", event.params.newAddress, event, false);
}

export function handleLendPoolLoanUpdated(event: LendPoolLoanUpdated): void {
  genericAddressProviderUpdate("lendPoolLoan", event.params.newAddress, event, false);
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
