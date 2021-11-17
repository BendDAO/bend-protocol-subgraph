import { IERC721, Transfer } from "../../generated/BoredApeYachtClub/IERC721";
import { IERC721Detailed } from "../../generated/templates/BNFT/IERC721Detailed";
import { getOrInitNftAsset, getOrInitNftTokenItem } from "../helpers/initializers";

export function handleTransfer(event: Transfer): void {
  let ERC721Contract = IERC721Detailed.bind(event.address);

  let nftAsset = getOrInitNftAsset(event.address);
  if (nftAsset.symbol == "") {
    let nameStringCall = ERC721Contract.try_name();
    if (nameStringCall.reverted) {
      nftAsset.name = "";
    } else {
      nftAsset.name = nameStringCall.value;
    }
    nftAsset.symbol = ERC721Contract.symbol().slice(1);
    nftAsset.save();
  }

  let tokenItem = getOrInitNftTokenItem(event.address, event.params.tokenId);
  tokenItem.owner = event.params.to;
  let uriStringCall = ERC721Contract.try_tokenURI(event.params.tokenId);
  if (uriStringCall.reverted) {
    tokenItem.tokenUri = "";
  } else {
    tokenItem.tokenUri = uriStringCall.value;
  }
  tokenItem.save();
}
