import { Address } from "@graphprotocol/graph-ts";
import { Assign, PunkTransfer, PunkBought } from "../../generated/CryptoPunksMarket/CryptoPunksMarket";
import { NftAsset } from "../../generated/schema";
import { IERC721Detailed } from "../../generated/templates/BNFT/IERC721Detailed";
import { getOrInitNftAsset, getOrInitNftTokenItem } from "../helpers/initializers";

function initNftAsset(punkContract: Address): NftAsset {
  let nftAsset = getOrInitNftAsset(punkContract);
  if (nftAsset.symbol == "") {
    let ERC721Contract = IERC721Detailed.bind(punkContract);
    let nameStringCall = ERC721Contract.try_name();
    if (nameStringCall.reverted) {
      nftAsset.name = "";
    } else {
      nftAsset.name = nameStringCall.value;
    }
    nftAsset.symbol = ERC721Contract.symbol().slice(1);
    nftAsset.save();
  }
  return nftAsset as NftAsset;
}

export function handleAssign(event: Assign): void {
  let nftAsset = initNftAsset(event.address);

  let tokenItem = getOrInitNftTokenItem(event.address, event.params.punkIndex);
  tokenItem.owner = event.params.to;
  tokenItem.tokenUri = "https://wrappedpunks.com:3000/api/punks/metadata/" + event.params.punkIndex.toString();
  tokenItem.save();
}

export function handlePunkTransfer(event: PunkTransfer): void {
  let nftAsset = initNftAsset(event.address);

  let tokenItem = getOrInitNftTokenItem(event.address, event.params.punkIndex);
  tokenItem.owner = event.params.to;
  tokenItem.save();
}

export function handlePunkBought(event: PunkBought): void {
  let nftAsset = initNftAsset(event.address);

  let tokenItem = getOrInitNftTokenItem(event.address, event.params.punkIndex);
  tokenItem.owner = event.params.toAddress;
  tokenItem.save();
}
