import { ethereum } from '@graphprotocol/graph-ts';

export enum EventTypeRef {
  NoType,
  Deposit,
}

export function getHistoryId(
  event: ethereum.Event,
  type: EventTypeRef = EventTypeRef.NoType
): string {
  let postfix = type !== EventTypeRef.NoType ? ':' + type.toString() : '';
  return event.transaction.hash.toHexString() + postfix;
}
