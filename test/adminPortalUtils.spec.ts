import { expect } from "chai";

import {
  extractCipherRollErrorMessage,
  parseDecimalAmountToWei,
  shortHash
} from "../web/lib/admin-portal-utils";

describe("admin portal utils", function () {
  it("parses decimal operator amounts without losing precision", function () {
    expect(parseDecimalAmountToWei("1")).to.equal(1000000000000000000n);
    expect(parseDecimalAmountToWei("0.000000000000000001")).to.equal(1n);
    expect(parseDecimalAmountToWei("1.234567890123456789")).to.equal(1234567890123456789n);
  });

  it("rejects malformed or unsupported amount strings", function () {
    expect(parseDecimalAmountToWei("")).to.equal(null);
    expect(parseDecimalAmountToWei("0")).to.equal(null);
    expect(parseDecimalAmountToWei("-1")).to.equal(null);
    expect(parseDecimalAmountToWei("1.2345678901234567891")).to.equal(null);
    expect(parseDecimalAmountToWei("abc")).to.equal(null);
  });

  it("maps known contract and wallet failures to operator-friendly messages", function () {
    expect(extractCipherRollErrorMessage(new Error("CipherRoll: not admin"))).to.equal(
      "The connected wallet is not the admin for this organization."
    );

    expect(
      extractCipherRollErrorMessage(new Error("user rejected action"))
    ).to.equal("The wallet request was rejected before submission.");
  });

  it("formats transaction hashes for compact status displays", function () {
    expect(shortHash("0x1234567890abcdef")).to.equal("0x123456...abcdef");
    expect(shortHash(null)).to.equal(null);
  });
});
