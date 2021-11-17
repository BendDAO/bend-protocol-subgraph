import { Initialized as BTokenInitialized } from "../../../generated/templates/BToken/BToken";
import { Initialized as DebtTokenInitialized } from "../../../generated/templates/DebtToken/DebtToken";
import { ContractToPoolMapping, MapAssetPool } from "../../../generated/schema";
import { Address, log } from "@graphprotocol/graph-ts";
import { IERC20Detailed } from "../../../generated/templates/BToken/IERC20Detailed";
import { zeroAddress } from "../../utils/converters";
export {
  handleBTokenBurn,
  handleBTokenMint,
  handleBTokenTransfer,
  handleDebtTokenBurn,
  handleDebtTokenMint,
} from "./reserve";
export {
  handleBNftMint,
  handleBNftBurn,
} from "./nft";

function createIncentivesController(
  asset: Address,
  incentivesController: Address,
  underlyingAsset: Address,
  pool: Address
): void {
  if (incentivesController == zeroAddress()) {
    log.warning("Incentives controller is 0x0 for asset: {} | underlyingasset: {} | pool: {}", [
      asset.toHexString(),
      underlyingAsset.toHexString(),
      pool.toHexString(),
    ]);
    return;
  }

  let poolAddressProvider = ContractToPoolMapping.load(pool.toHexString());
  // save asset pool mapping
  let mapAssetPool = new MapAssetPool(asset.toHexString());
  mapAssetPool.pool = poolAddressProvider.pool;
  mapAssetPool.underlyingAsset = underlyingAsset;
  mapAssetPool.save();
}

export function handleBTokenInitialized(event: BTokenInitialized): void {
  createIncentivesController(
    event.address,
    event.params.incentivesController,
    event.params.underlyingAsset,
    event.params.pool
  );
}

export function handleDebtTokenInitialized(event: DebtTokenInitialized): void {
  createIncentivesController(
    event.address,
    event.params.incentivesController,
    event.params.underlyingAsset,
    event.params.pool
  );
}
