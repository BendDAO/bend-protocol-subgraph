import { PriceOracle, PriceOracleAsset } from "../../generated/schema";
import { ReserveOracle, AggregatorAdded } from "../../generated/ReserveOracle/ReserveOracle";
import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { formatUsdEthPrice, zeroAddress, zeroBI } from "../utils/converters";
import { AggregatorV2V3Interface } from "../../generated/templates/ChainlinkAggregator/AggregatorV2V3Interface";
import { getChainlinkAggregator, getOrInitPriceOracle, getPriceOracleAsset } from "../helpers/initializers";
import { MOCK_USD_ADDRESS } from "../utils/constants";
import { genericPriceUpdate, usdEthPriceUpdate } from "../helpers/price-updates";
import { AnswerUpdated } from "../../generated/templates/ChainlinkAggregator/AggregatorV2V3Interface";
import { getNFTOracleId, getReserveOracleId } from "../utils/id-generation";
import { EACAggregatorProxy } from "../../generated/templates/ChainlinkAggregator/EACAggregatorProxy";
import { ChainlinkAggregator as ChainlinkAggregatorContract } from "../../generated/templates";
import { ReserveAggregatorUpdated } from "../../generated/ChainlinkAggregatorHelper/ChainlinkAggregatorHelper";

export function handleAggregatorAdded(event: AggregatorAdded): void {
  let assetAddress = event.params.currencyKey;
  let aggregatorAddress = event.params.aggregator;

  let priceOracle = getOrInitPriceOracle(getReserveOracleId());
  if (priceOracle.proxyPriceProvider.equals(zeroAddress())) {
    priceOracle.proxyPriceProvider = event.address;
  }

  let priceOracleAsset = getPriceOracleAsset(assetAddress.toHexString(), getReserveOracleId());

  priceFeedUpdated(event, assetAddress, aggregatorAddress, priceOracleAsset, priceOracle);
}

export function handleChainlinkAnswerUpdated(event: AnswerUpdated): void {
  let priceOracle = getOrInitPriceOracle(getReserveOracleId());
  let chainlinkAggregator = getChainlinkAggregator(event.address.toHexString());

  // setting price in asset
  let oracleAsset = getPriceOracleAsset(chainlinkAggregator.oracleAsset, getReserveOracleId());

  // if it's correct oracle for this asset
  if (oracleAsset.priceSource.equals(event.address)) {
    // if oracle answer is valid
    if (event.params.current.gt(zeroBI())) {
      genericPriceUpdate(oracleAsset, event.params.current, event);
    }
  }

  // setting price in oracle for ETH-USD asset
  if (priceOracle.usdPriceEthMainSource.equals(event.address)) {
    let proxyPriceProvider = ReserveOracle.bind(priceOracle.proxyPriceProvider as Address);

    genericHandleChainlinkUSDETHPrice(event.params.current, event, priceOracle, proxyPriceProvider);
  }
}

// Event that gets triggered when an aggregator of chainlink change gets triggered
// updates the ens entity with new aggregator address
// updates price on priceOracleAsset of underlying
// creates aggregator listener for latestAnswer event on new aggregator
export function handleReserveAggregatorUpdated(event: ReserveAggregatorUpdated): void {
  let oracleAssetAddress = event.params.reserve;
  let oracleAssetAddressHexStr = oracleAssetAddress.toHexString();
  let newPriceSource = event.params.aggregator;
  let newPriceSourceHexStr = newPriceSource.toHexString();

  let assetOracle = getPriceOracleAsset(oracleAssetAddressHexStr, getReserveOracleId());
  if (assetOracle.priceSource.equals(newPriceSource)) {
    log.warning(`Reserve same aggregator: {}`, [oracleAssetAddressHexStr]);
    //return;
  }

  let oldChainlinkAggregator = getChainlinkAggregator(assetOracle.priceSource.toHexString());

  assetOracle.priceSource = newPriceSource;
  assetOracle.save();

  // create chainlinkAggregator entity with new aggregator to be able to match asset and oracle after
  let chainlinkAggregator = getChainlinkAggregator(newPriceSourceHexStr);
  // create new instance only if it doesn't exist
  if (chainlinkAggregator.createTimestamp == 0) {
    // start listening to events from new price source
    ChainlinkAggregatorContract.create(newPriceSource);
    chainlinkAggregator.createTimestamp = event.block.timestamp.toI32();
  }
  chainlinkAggregator.oracleAsset = oracleAssetAddressHexStr;
  chainlinkAggregator.answerDecimals = oldChainlinkAggregator.answerDecimals;
  chainlinkAggregator.save();

  // update the price from latestAnswer of new aggregator
  let priceAggregatorInstance = AggregatorV2V3Interface.bind(newPriceSource);
  let latestAnswerCall = priceAggregatorInstance.try_latestAnswer();
  if (!latestAnswerCall.reverted && latestAnswerCall.value.gt(zeroBI())) {
    let priceFromOracle = latestAnswerCall.value;

    genericPriceUpdate(assetOracle, priceFromOracle, event);

    // update usd
    if (oracleAssetAddress.toHexString() == MOCK_USD_ADDRESS) {
      let formatPrice = formatUsdEthPrice(priceFromOracle);

      let priceOracle = getOrInitPriceOracle(getReserveOracleId());
      priceOracle.usdPriceEthFallbackRequired = assetOracle.fallbackRequired;
      priceOracle.usdPriceEthMainSource = newPriceSource;
      usdEthPriceUpdate(priceOracle, priceFromOracle, formatPrice, event);

      // update usd price in nft oracle
      let nftOracle = getOrInitPriceOracle(getNFTOracleId());
      nftOracle.usdPriceEthFallbackRequired = assetOracle.fallbackRequired;
      nftOracle.usdPriceEthMainSource = newPriceSource;
      usdEthPriceUpdate(nftOracle, priceFromOracle, formatPrice, event);
    }
  } else {
    log.error(`Latest answer call failed on aggregator:: {}`, [newPriceSourceHexStr]);
    return;
  }

  log.warning("Reserve aggregator updated: {}", [oracleAssetAddressHexStr]);
}

export function handleReserveAggregatorRemoved(event: ReserveAggregatorUpdated): void {
  let newPriceSource = event.params.aggregator;
  let newPriceSourceHexStr = newPriceSource.toHexString();

  let chainlinkAggregator = getChainlinkAggregator(newPriceSourceHexStr);
  chainlinkAggregator.oracleAsset = zeroAddress().toHexString();
  chainlinkAggregator.save();

  log.warning("Reserve aggregator removed: {}", [newPriceSourceHexStr]);
}

export function priceFeedUpdated(
  event: ethereum.Event,
  assetAddress: Address,
  assetOracleAddress: Address,
  priceOracleAsset: PriceOracleAsset,
  priceOracle: PriceOracle
): void {
  let sAssetAddress = assetAddress.toHexString();

  // We get the current price from the oracle. Valid for chainlink source and custom oracle
  let proxyPriceProvider = ReserveOracle.bind(Address.fromString(priceOracle.proxyPriceProvider.toHexString()));
  let priceFromOracle = zeroBI();
  let priceFromProxyCall = proxyPriceProvider.try_getAssetPrice(assetAddress);
  if (!priceFromProxyCall.reverted) {
    priceFromOracle = priceFromProxyCall.value;
  } else {
    log.error(`this asset has not been registered. || asset: {} | assetOracle: {}`, [
      sAssetAddress,
      assetOracleAddress.toHexString(),
    ]);
    return;
  }

  // if it's valid oracle address
  if (!assetOracleAddress.equals(zeroAddress())) {
    let priceAggregatorInstance = AggregatorV2V3Interface.bind(assetOracleAddress);

    // get underlying aggregator from proxy (assetOracleAddress) address
    let chainlinkProxyInstance = EACAggregatorProxy.bind(assetOracleAddress);
    let aggregatorAddressCall = chainlinkProxyInstance.try_aggregator();
    // If we can't get the aggregator, it means that the source address is not a chainlink proxy
    // so it has been registered badly.
    if (aggregatorAddressCall.reverted) {
      log.error(`try_aggregator failed: asset: {} | assetOracleAddress: {}`, [
        sAssetAddress,
        assetOracleAddress.toHexString(),
      ]);
      return;
    }

    let aggregatorAddress = aggregatorAddressCall.value;
    priceOracleAsset.priceSource = aggregatorAddress;

    // create ChainLink aggregator template entity
    ChainlinkAggregatorContract.create(aggregatorAddress);

    // Need to check latestAnswer and not use priceFromOracle because priceFromOracle comes from the oracle
    // and the value could be from the fallback already. So we need to check if we can get latestAnswer from the
    // chainlink aggregator
    let priceAggregatorlatestAnswerCall = priceAggregatorInstance.try_latestAnswer();
    if (priceAggregatorlatestAnswerCall.reverted || priceAggregatorlatestAnswerCall.value.isZero()) {
      priceOracleAsset.fallbackRequired = true;

      log.error("try_latestAnswer failed: asset: {} | oracle: {} | price: {}", [
        assetAddress.toHexString(),
        assetOracleAddress.toHexString(),
        priceFromOracle.toString(),
      ]);
    } else {
      priceOracleAsset.fallbackRequired = false;

      priceFromOracle = priceAggregatorlatestAnswerCall.value;
    }

    // get decimals
    let priceAggregatorDecimalsCall = priceAggregatorInstance.try_decimals();
    if (priceAggregatorDecimalsCall.reverted) {
      log.error("try_decimals failed: asset: {} | oracle: {} | price: {}", [
        assetAddress.toHexString(),
        assetOracleAddress.toHexString(),
        priceFromOracle.toString(),
      ]);
    } else {
      priceOracleAsset.answerDecimals = priceAggregatorDecimalsCall.value;
      priceOracleAsset.priceDecimals = priceOracleAsset.answerDecimals;
    }

    // create chainlinkAggregator entity with new aggregator to be able to match asset and oracle after
    let chainlinkAggregator = getChainlinkAggregator(aggregatorAddress.toHexString());
    chainlinkAggregator.oracleAsset = assetAddress.toHexString();
    chainlinkAggregator.answerDecimals = priceOracleAsset.answerDecimals;
    chainlinkAggregator.createTimestamp = event.block.timestamp.toI32();
    chainlinkAggregator.save();
  } else {
    log.error("registry of asset: {} | oracle: {} | price: {}", [
      assetAddress.toHexString(),
      assetOracleAddress.toHexString(),
      priceFromOracle.toString(),
    ]);
  }

  if (sAssetAddress == MOCK_USD_ADDRESS) {
    let formatPrice = formatUsdEthPrice(priceFromOracle);
    priceOracle.usdPriceDecimals = priceOracleAsset.answerDecimals;
    priceOracle.usdPriceEthMainSource = priceOracleAsset.priceSource;
    priceOracle.usdPriceEthFallbackRequired = priceOracleAsset.fallbackRequired;

    usdEthPriceUpdate(priceOracle, priceFromOracle, formatPrice, event);

    // update usd price in nft oracle
    let nftOracle = getOrInitPriceOracle(getNFTOracleId());
    nftOracle.usdPriceDecimals = priceOracleAsset.answerDecimals;
    nftOracle.usdPriceEthMainSource = priceOracleAsset.priceSource;
    nftOracle.usdPriceEthFallbackRequired = priceOracleAsset.fallbackRequired;
    usdEthPriceUpdate(nftOracle, priceFromOracle, formatPrice, event);

    // this is so we also save the assetOracle for usd chainlink
    genericPriceUpdate(priceOracleAsset, priceFromOracle, event);
  } else {
    genericPriceUpdate(priceOracleAsset, priceFromOracle, event);
  }
}

export function genericHandleChainlinkUSDETHPrice(
  price: BigInt,
  event: ethereum.Event,
  priceOracle: PriceOracle,
  proxyPriceProvider: ReserveOracle
): void {
  if (price.gt(zeroBI())) {
    priceOracle.usdPriceEthFallbackRequired = false;
    let formatPrice = formatUsdEthPrice(price);
    usdEthPriceUpdate(priceOracle, price, formatPrice, event);

    // update usd price in nft oracle
    let nftOracle = getOrInitPriceOracle(getNFTOracleId());
    nftOracle.usdPriceEthFallbackRequired = false;
    usdEthPriceUpdate(nftOracle, price, formatPrice, event);
  } else {
    priceOracle.usdPriceEthFallbackRequired = true;
    let formatPrice = formatUsdEthPrice(
      proxyPriceProvider.getAssetPrice(Bytes.fromHexString(MOCK_USD_ADDRESS) as Address)
    );
    usdEthPriceUpdate(priceOracle, price, formatPrice, event);

    // update usd price in nft oracle
    let nftOracle = getOrInitPriceOracle(getNFTOracleId());
    nftOracle.usdPriceEthFallbackRequired = true;
    usdEthPriceUpdate(nftOracle, price, formatPrice, event);
  }
}
