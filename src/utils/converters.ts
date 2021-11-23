import { BigInt, BigDecimal, Bytes, ByteArray, crypto, log, Value } from "@graphprotocol/graph-ts";

export function zeroBD(): BigDecimal {
  return BigDecimal.fromString("0");
}

export function zeroBI(): BigInt {
  return BigInt.fromI32(0);
}

export function oneEther(): BigInt {
  return exponentToBigInt(18);
}

export function zeroAddress(): Bytes {
  return Bytes.fromHexString("0x0000000000000000000000000000000000000000") as Bytes;
}

// @ts-ignore
export function exponentToBigDecimal(decimals: i32): BigDecimal {
  let bd = BigDecimal.fromString("1");
  let bd10 = BigDecimal.fromString("10");
  for (let i = 0; i < decimals; i++) {
    bd = bd.times(bd10);
  }
  return bd;
}

// @ts-ignore
export function exponentToBigInt(decimals: i32): BigInt {
  let bi = BigInt.fromI32(1);
  let bi10 = BigInt.fromI32(10);
  for (let i = 0; i < decimals; i++) {
    bi = bi.times(bi10);
  }
  return bi;
}
// @ts-ignore
export function convertTokenAmountToDecimals(amount: BigInt, decimals: i32): BigDecimal {
  return amount.toBigDecimal().div(exponentToBigDecimal(decimals));
}

export function convertValueFromRay(value: BigInt): BigDecimal {
  return convertTokenAmountToDecimals(value, 27);
}

export function format18(price: BigInt): BigInt {
  // IF the price is 0
  if (price == BigInt.fromI32(0)) return price;
  return exponentToBigInt(18).div(price);
}

export function formatUsdEthPrice(price: BigInt): BigInt {
  return formatUsdEthReserveOraclePrice(price);
}

export function formatUsdEthChainlinkPrice(price: BigInt): BigInt {
  // IF the price is 0
  if (price == BigInt.fromI32(0)) return price;
  return exponentToBigInt(18 + 8).div(price);
}

export function formatUsdEthReserveOraclePrice(price: BigInt): BigInt {
  // IF the price is 0
  if (price == BigInt.fromI32(0)) return price;
  return exponentToBigInt(18 + 18).div(price);
}

export const LOAN_STATE_NONE = "None";
export const LOAN_STATE_CREATED = "Created";
export const LOAN_STATE_ACTIVE = "Active";
export const LOAN_STATE_REPAID = "Repaid";
export const LOAN_STATE_DEFAULTED = "Defaulted";

export function getLoanState(_mode: BigInt): string {
  let mode = _mode.toI32();
  if (mode == 0) {
    return LOAN_STATE_NONE;
  } else if (mode == 1) {
    return LOAN_STATE_CREATED;
  } else if (mode == 2) {
    return LOAN_STATE_ACTIVE;
  } else if (mode == 3) {
    return LOAN_STATE_REPAID;
  } else if (mode == 4) {
    return LOAN_STATE_DEFAULTED;
  }
  throw new Error("invalid loan state");
}

export function getLoanStateFromString(_mode: string): BigInt {
  if (_mode == LOAN_STATE_NONE) {
    return zeroBI();
  } else if (_mode == LOAN_STATE_CREATED) {
    return BigInt.fromI32(1);
  } else if (_mode == LOAN_STATE_ACTIVE) {
    return BigInt.fromI32(2);
  } else if (_mode == LOAN_STATE_REPAID) {
    return BigInt.fromI32(3);
  } else if (_mode == LOAN_STATE_DEFAULTED) {
    return BigInt.fromI32(4);
  }
  throw new Error("invalid loan state");
}

export function byteArrayFromHex(s: string): ByteArray {
  if (s.length % 2 !== 0) {
    throw new TypeError("Hex string must have an even number of characters");
  }
  let out = new Uint8Array(s.length / 2);
  for (var i = 0; i < s.length; i += 2) {
    out[i / 2] = parseInt(s.substring(i, i + 2), 16);
  }
  return out as ByteArray;
}

// Helper for concatenating two byte arrays
export function concat(a: ByteArray, b: ByteArray): ByteArray {
  let out = new Uint8Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i];
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j];
  }
  return out as ByteArray;
}

const Zeros = new ByteArray(32);
Zeros.fill(0);

export function namehash(partition: Array<string>): string {
  let result: ByteArray = Zeros;
  while (partition.length > 0) {
    let data = partition[partition.length - 1];
    let label = ByteArray.fromUTF8(data);

    result = crypto.keccak256(concat(result, crypto.keccak256(label)));

    partition.pop();
  }

  return result.toHexString();
}

export function convertToLowerCase(str: string): string {
  // create a result variable
  let result = "";

  for (let i = 0; i < str.length; i++) {
    // get the code of the current character
    let code = str.charCodeAt(i);

    // check if it's within the range of capital letters
    if (code > 64 && code < 91) {
      // if so, add a new character to the result string
      // of the character from our code, plus 32
      result += String.fromCharCode(code + 32);
    } else {
      // otherwise, just add the current character
      result += str.charAt(i);
    }
  }

  // return the result
  return result;
}

export function generateSymbol(description: string): string {
  let symbolArr = description.split(" / ");
  return convertToLowerCase(symbolArr[0] + "-" + symbolArr[1]);
}
