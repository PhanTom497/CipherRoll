// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FHERC20} from "fhenix-confidential-contracts/contracts/FHERC20/FHERC20.sol";
import {FHERC20ERC20Wrapper} from "fhenix-confidential-contracts/contracts/FHERC20/extensions/FHERC20ERC20Wrapper.sol";

contract MockConfidentialPayrollToken is FHERC20ERC20Wrapper {
    constructor(IERC20 underlyingToken)
        FHERC20("CipherRoll Confidential Payroll USD", "ccpUSD", 6, "")
        FHERC20ERC20Wrapper(underlyingToken)
    {}
}
