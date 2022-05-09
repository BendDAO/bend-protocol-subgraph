import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { PriceHistoryItem, PriceOracle, PriceOracleAsset, UsdEthPriceHistoryItem } from "../../generated/schema";

export function savePriceToHistory(oracleAsset: PriceOracleAsset, event: ethereum.Event): void {
  let id = oracleAsset.id + event.block.number.toString() + event.transaction.index.toString();
  let priceHistoryItem = new PriceHistoryItem(id);
  priceHistoryItem.asset = oracleAsset.id;
  priceHistoryItem.price = oracleAsset.priceInEth;
  priceHistoryItem.floorPrice = oracleAsset.floorPriceInEth;
  priceHistoryItem.timestamp = oracleAsset.lastUpdateTimestamp;
  priceHistoryItem.save();
}

export function usdEthPriceUpdate(
  priceOracle: PriceOracle,
  price: BigInt,
  priceFormated: BigInt,
  event: ethereum.Event
): void {
  priceOracle.usdPriceEth = price;
  priceOracle.usdPriceEthFormated = priceFormated;
  priceOracle.lastUpdateTimestamp = event.block.timestamp.toI32();
  priceOracle.save();

  let usdEthPriceHistoryItem = new UsdEthPriceHistoryItem(
    event.block.number.toString() + event.transaction.index.toString()
  );
  usdEthPriceHistoryItem.oracle = priceOracle.id;
  usdEthPriceHistoryItem.price = priceOracle.usdPriceEth;
  usdEthPriceHistoryItem.priceFormated = priceOracle.usdPriceEthFormated;
  usdEthPriceHistoryItem.timestamp = priceOracle.lastUpdateTimestamp;
  usdEthPriceHistoryItem.save();
}

export function genericPriceUpdate(oracleAsset: PriceOracleAsset, price: BigInt, event: ethereum.Event): void {
  oracleAsset.priceInEth = price;
  oracleAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  oracleAsset.save();

  // add new price to history
  savePriceToHistory(oracleAsset, event);
}

export function genericFloorPriceUpdate(oracleAsset: PriceOracleAsset, price: BigInt, event: ethereum.Event): void {
  oracleAsset.floorPriceInEth = price;
  oracleAsset.lastUpdateTimestamp = event.block.timestamp.toI32();
  oracleAsset.save();

  // add new price to history
  savePriceToHistory(oracleAsset, event);
}
