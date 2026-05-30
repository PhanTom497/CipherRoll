import { expect } from "chai";

import {
  calculateAggregateReserveAmount,
  formatCompliancePolicyLabel,
  normalizeComplianceTaxReserveBps
} from "../packages/cipherroll-sdk/src/compliance";

describe("compliance policy helpers", function () {
  it("normalizes tax reserve basis points within the Tier A policy range", function () {
    expect(normalizeComplianceTaxReserveBps(undefined)).to.equal(1500);
    expect(normalizeComplianceTaxReserveBps("1750")).to.equal(1750);
    expect(normalizeComplianceTaxReserveBps("-25")).to.equal(0);
    expect(normalizeComplianceTaxReserveBps("9000")).to.equal(5000);
    expect(normalizeComplianceTaxReserveBps("not-a-number")).to.equal(1500);
  });

  it("calculates aggregate reserve amounts without employee-level inputs", function () {
    expect(calculateAggregateReserveAmount("100000000000000000000", 1500)).to.equal(
      "15000000000000000000"
    );
    expect(calculateAggregateReserveAmount(25_000n, 1250)).to.equal("3125");
  });

  it("formats policy labels for frontend and export use", function () {
    expect(formatCompliancePolicyLabel(1500)).to.equal("15.00% aggregate reserve policy");
    expect(formatCompliancePolicyLabel(75)).to.equal("0.75% aggregate reserve policy");
  });
});
