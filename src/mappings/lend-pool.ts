import { Deposit as DepositEvent } from '../../generated/templates/LendPool/LendPool';
import { Deposit as DepositStore } from '../../generated/schema';
import { EventTypeRef, getHistoryId } from '../utils/id-generation';

export function handleDeposit(event: DepositEvent) {
  const id = getHistoryId(event, EventTypeRef.Deposit);

  const deposit = new DepositStore(id);

  deposit.save();
}
