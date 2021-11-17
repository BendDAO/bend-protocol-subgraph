import {
    Mint as BNftMint,
    Burn as BNftBurn,
    //FlashLoan as BNftFlashLoan
  } from "../../../generated/templates/BNFT/BNFT";
  import {
    UserNft,
    NFT,
  } from "../../../generated/schema";
  import {
    getOrInitNft,
    getOrInitUserNft,
    getOrInitUser,
    getPriceOracleAsset,
    getOrInitPriceOracle,
    getOrInitNftParamsHistoryItem,
    getOrInitBNFT,
  } from "../../helpers/initializers";
  import { zeroBI } from "../../utils/converters";
  import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
  
  function saveNft(nft: NFT, event: ethereum.Event): void {
    let nftParamsHistoryItem = getOrInitNftParamsHistoryItem(event.transaction.hash, nft);
    nftParamsHistoryItem.lifetimeBorrows = nft.lifetimeBorrows;
    nftParamsHistoryItem.lifetimeRepayments = nft.lifetimeRepayments;
    nftParamsHistoryItem.lifetimeLiquidated = nft.lifetimeLiquidated;
    nftParamsHistoryItem.totalCollateral = nft.totalCollateral;
    let priceOracleAsset = getPriceOracleAsset(nft.price);
    nftParamsHistoryItem.priceInEth = priceOracleAsset.priceInEth;
  
    let priceOracle = getOrInitPriceOracle();
    nftParamsHistoryItem.priceInUsd = nftParamsHistoryItem.priceInEth
      .toBigDecimal()
      .div(priceOracle.usdPriceEth.toBigDecimal());
  
    nftParamsHistoryItem.timestamp = event.block.timestamp.toI32();
    nftParamsHistoryItem.save();
  }
  
  export function handleBNftBurn(event: BNftBurn): void {
    let bnft = getOrInitBNFT(event.address);
    let userNft = getOrInitUserNft(event.params.owner, bnft.underlyingAssetAddress as Address, event);
    let poolNft = getOrInitNft(bnft.underlyingAssetAddress as Address, event);
  
    userNft.lastUpdateTimestamp = event.block.timestamp.toI32();
    userNft.save();
  
    poolNft.lifetimeRepayments = poolNft.lifetimeRepayments.plus(new BigInt(1));
    saveNft(poolNft, event);
  
    let user = getOrInitUser(event.params.owner);
    if (userNft.totalCollateral.equals(zeroBI())) {
      user.collateralNftsCount -= 1;
      user.save();
    }
  }

  export function handleBNftMint(event: BNftMint): void {
    let bnft = getOrInitBNFT(event.address);
    let poolNft = getOrInitNft(bnft.underlyingAssetAddress as Address, event);
    let userNft = getOrInitUserNft(event.params.owner, bnft.underlyingAssetAddress as Address, event);
  
    let user = getOrInitUser(event.params.owner);
    if (userNft.totalCollateral.equals(zeroBI())) {
      user.collateralNftsCount += 1;
      user.save();
    }

    userNft.lastUpdateTimestamp = event.block.timestamp.toI32();
    userNft.save();

    poolNft.lifetimeBorrows = poolNft.lifetimeBorrows.plus(new BigInt(1));
    saveNft(poolNft, event);
  }
  