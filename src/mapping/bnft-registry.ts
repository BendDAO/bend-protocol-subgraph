import { BNFTCreated, BNFTUpgraded } from "../../generated/BNFTRegistry/BNFTRegistry";
import { BNFT } from "../../generated/schema";

import { BNFT as BNFTContract } from "../../generated/templates";
import { IERC721Detailed } from "../../generated/templates/BNFT/IERC721Detailed";
import { createMapContractToPool, getOrInitBNFT, getOrInitNftAsset, getProtocol } from "../helpers/initializers";

export function handleBNFTCreated(event: BNFTCreated): void {
  let nftAsset = getOrInitNftAsset(event.params.nftAsset);

  BNFTContract.create(event.params.bNftProxy);

  let bnft = getOrInitBNFT(event.params.bNftProxy);

  bnft.nftAsset = nftAsset.id;
  bnft.tokenContractImpl = event.params.bNftImpl;

  let ERC721BNftContract = IERC721Detailed.bind(event.params.bNftProxy);

  let nameStringCall = ERC721BNftContract.try_name();
  if (nameStringCall.reverted) {
    bnft.name = "";
  } else {
    bnft.name = nameStringCall.value;
  }

  bnft.symbol = ERC721BNftContract.symbol().slice(1);

  bnft.save();
}

export function handleBNFTUpgraded(event: BNFTUpgraded): void {
  let bnft = getOrInitBNFT(event.params.bNftProxy);

  bnft.tokenContractImpl = event.params.bNftImpl;

  let ERC721BNftContract = IERC721Detailed.bind(event.params.bNftProxy);

  let nameStringCall = ERC721BNftContract.try_name();
  if (nameStringCall.reverted) {
    bnft.name = "";
  } else {
    bnft.name = nameStringCall.value;
  }

  bnft.symbol = ERC721BNftContract.symbol().slice(1);

  bnft.save();
}
