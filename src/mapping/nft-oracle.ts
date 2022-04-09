import { Address, ethereum } from "@graphprotocol/graph-ts";
import { AssetAdded, NFTOracle, SetAssetData } from "../../generated/NFTOracle/NFTOracle";
import { getOrInitPriceOracle, getPriceOracleAsset } from "../helpers/initializers";
import { genericPriceUpdate } from "../helpers/price-updates";
import { zeroAddress, zeroBI } from "../utils/converters";
import { getNFTOracleId } from "../utils/id-generation";

export function handleAssetAdded(event: AssetAdded): void {
  let assetAddress = event.params.asset;
  let priceOracle = getOrInitPriceOracle(getNFTOracleId());
  if (priceOracle.proxyPriceProvider.equals(event.address)==false) {
    priceOracle.proxyPriceProvider = event.address;
    priceOracle.save();
  }

  let priceOracleAsset = getPriceOracleAsset(assetAddress.toHexString(), getNFTOracleId());
  priceOracleAsset.priceSource = priceOracle.proxyPriceProvider;
  priceOracleAsset.save();
}

export function handleSetAssetData(event: SetAssetData): void {
  let assetAddress = event.params.asset;
  let assetPrice = event.params.price;

  let priceOracle = getOrInitPriceOracle(getNFTOracleId());

  let oracleAsset = getPriceOracleAsset(assetAddress.toHexString(), getNFTOracleId());

  // if it's correct oracle for this asset
  //if (oracleAsset.priceSource.equals(event.address)) 
  {
    // if oracle answer is valid
    if (assetPrice.gt(zeroBI())) {
      oracleAsset.fallbackRequired = false;
      genericPriceUpdate(oracleAsset, assetPrice, event);
    } else {
      oracleAsset.fallbackRequired = true;
      let proxyPriceProvider = NFTOracle.bind(priceOracle.proxyPriceProvider as Address);
      let fallbackPrice = proxyPriceProvider.getAssetPrice(assetAddress);
      genericPriceUpdate(oracleAsset, fallbackPrice, event);
    }
  }
}
