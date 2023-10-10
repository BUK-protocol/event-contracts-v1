import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, toUtf8Bytes, toBeArray } from "ethers";

describe("SignatureVerifier", function () {
  let SignatureVerifier;
  let verifier;
  let owner;
  let signer;

  beforeEach(async function () {
    SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
    verifier = await SignatureVerifier.deploy();
    [owner, signer] = await ethers.getSigners();
  });

  it("should verify the signature correctly", async function () {
    const totalPenalty = 100;
    const totalRefund = 50;
    const totalCharges = 25;

    // Construct the message
    const message = `Cancellation Details:\nTotal Penalty: ${totalPenalty}\nTotal Refund: ${totalRefund}\nTotal Charges: ${totalCharges}`;
    const messageHash = keccak256(toUtf8Bytes(message));
    
    // Sign the message
    const byteArray = Buffer.from(messageHash.slice(2), 'hex');
    
    const signature = await signer.signMessage(byteArray);
    
    // Call the generateAndVerify function
    const recoveredAddress = await verifier.generateAndVerify(totalPenalty, totalRefund, totalCharges, signature);

    // Check if the recovered address matches the signer's address
    expect(recoveredAddress).to.equal(signer.address);
  });
});
