import { Initialized, Mint, Burn, FlashLoan } from "../../generated/templates/BNFT/BNFT";
import { FlashLoan as FlashLoanAction } from "../../generated/schema";
import { getOrInitBNFT, getOrInitNftTokenItem, getOrInitUser } from "../helpers/initializers";
import { zeroAddress, zeroBI } from "../utils/converters";
import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { EventTypeRef, getHistoryId } from "../utils/id-generation";
import { IERC721Detailed } from "../../generated/templates/BNFT/IERC721Detailed";

export function handleInitialized(event: Initialized): void {
}

export function handleBurn(event: Burn): void {
  let tokenItem = getOrInitNftTokenItem(event.address, event.params.nftTokenId);
  tokenItem.owner = zeroAddress();
  tokenItem.save();
}

export function handleMint(event: Mint): void {
  let tokenItem = getOrInitNftTokenItem(event.address, event.params.nftTokenId);
  tokenItem.owner = event.params.owner;

  let ERC721Contract = IERC721Detailed.bind(event.address);
  let uriStringCall = ERC721Contract.try_tokenURI(event.params.nftTokenId);
  if (uriStringCall.reverted) {
    tokenItem.tokenUri = "";
  } else {
    tokenItem.tokenUri = uriStringCall.value;
  }

  tokenItem.save();
}

export function handleFlashLoan(event: FlashLoan): void {
  let bnft = getOrInitBNFT(event.address);

  let flashLoan = new FlashLoanAction(getHistoryId(event, EventTypeRef.FlashLoan));
  flashLoan.bnft = bnft.id;
  flashLoan.nftAsset = event.params.nftAsset;
  flashLoan.nftTokenId = event.params.tokenId;
  flashLoan.target = event.params.target;
  flashLoan.initiator = event.params.initiator;
  flashLoan.timestamp = event.block.timestamp.toI32();
  flashLoan.save();
}
