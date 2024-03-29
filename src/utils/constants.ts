import { convertToLowerCase } from "./converters";

const CASE_MOCK_ETHEREUM_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const CASE_MOCK_USD_ADDRESS = "0x9ceb4d4c184d1786614a593a03621b7f37f8685f";
// Treasury address should be BendCollector contract
const CASE_GOERLI_TREASURY_ADDRESS = "0x32B08f895d93a207e8A5C9405870D780A43b25Dd";
const CASE_SEPOLIA_TREASURY_ADDRESS = "0xdd3eC916c0B438b9DB2Ee675cBD412c46763a641";
const CASE_MAINNET_TREASURY_ADDRESS = "0x43078AbfB76bd24885Fd64eFFB22049f92a8c495";

export const PROPOSAL_STATUS_INITIALIZING = "Initializing";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export let MOCK_ETHEREUM_ADDRESS = convertToLowerCase(CASE_MOCK_ETHEREUM_ADDRESS);
export let MOCK_USD_ADDRESS = convertToLowerCase(CASE_MOCK_USD_ADDRESS);
export let GOERLI_TREASURY_ADDRESS = convertToLowerCase(CASE_GOERLI_TREASURY_ADDRESS);
export let SEPOLIA_TREASURY_ADDRESS = convertToLowerCase(CASE_SEPOLIA_TREASURY_ADDRESS);
export let MAINNET_TREASURY_ADDRESS = convertToLowerCase(CASE_MAINNET_TREASURY_ADDRESS);
