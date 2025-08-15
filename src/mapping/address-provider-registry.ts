import { Address } from "@graphprotocol/graph-ts";
import { Pool } from "../../generated/schema";
import { LendPoolAddressesProvider } from "../../generated/templates";
import {
  AddressesProviderRegistered,
  AddressesProviderUnregistered,
} from "../../generated/LendPoolAddressesProviderRegistry/LendPoolAddressesProviderRegistry";
import { getProtocol } from "../helpers/initializers";
import { zeroBI } from "../utils/converters";

export function handleAddressesProviderRegistered(event: AddressesProviderRegistered): void {
  let protocol = getProtocol();
  let address = event.params.newAddress.toHexString();
  if (Pool.load(address) == null) {
    let pool = new Pool(address);
    pool.protocol = protocol.id;
    pool.active = true;
    pool.paused = false;
    pool.pauseStartTime = zeroBI();
    pool.pauseDurationTime = zeroBI();
    pool.lastUpdateTimestamp = event.block.timestamp.toI32();
    pool.save();

    LendPoolAddressesProvider.create(Address.fromString(address));
  }
}

export function handleAddressesProviderUnregistered(event: AddressesProviderUnregistered): void {
  let pool = Pool.load(event.params.newAddress.toHexString());
  if (pool != null) {
    pool.active = false;
    pool.save();
  }
}
