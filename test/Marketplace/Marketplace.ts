import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransactionResponse } from "ethers";
import { Marketplace } from "../../typechain-types";
import { BukEventProtocol } from "../../typechain-types";
import { bukNfTs } from "../../typechain-types/contracts";
import { keccak256, toUtf8Bytes } from "ethers";

describe("Marketplace", function () {
  let stableTokenContract;
  let marketplaceContract;
  let bukProtocolContract;
  let signatureVerifierContract;
  let royaltiesContract;
  let owner;
  let account1;
  let account2;
  let adminWallet;
  let bukWallet;
  let bukTreasuryContract;
  let nftContract;
  let nftPosContract;
  let sellerWallet;
  let buyerWallet;

  beforeEach("deploy the contract instance first", async function () {
    [
      owner,
      account1,
      account2,
      adminWallet,
      sellerWallet,
      buyerWallet,
      bukWallet,
    ] = await ethers.getSigners();
    // Token
    const Token = await ethers.getContractFactory("Token");
    stableTokenContract = await Token.deploy(
      "USD Dollar",
      "USDC",
      18,
      owner.address,
      2000000,
    );
    // console.log(await stableTokenContract.getAddress(), " tokenContract");

    //BukTreasury
    const BukTreasury = await ethers.getContractFactory("BukTreasury");
    bukTreasuryContract = await BukTreasury.deploy(
      stableTokenContract.getAddress(),
    );
    // console.log(await bukTreasuryContract.getAddress(), " bukTreasuryContract");

    //Deploy SignatureVerifier contract
    const SignatureVerifier = await ethers.getContractFactory(
      "SignatureVerifier",
    );
    signatureVerifierContract = await SignatureVerifier.deploy();

    //Deploy BukRoyalties contract
    const BukRoyalties = await ethers.getContractFactory("BukRoyalties");
    royaltiesContract = await BukRoyalties.deploy();

    //BukEventProtocol
    const BukEventProtocol = await ethers.getContractFactory(
      "BukEventProtocol",
    );
    bukProtocolContract = await BukEventProtocol.deploy(
      bukTreasuryContract.getAddress(),
      stableTokenContract.getAddress(),
      bukWallet.getAddress(),
      signatureVerifierContract.getAddress(),
      royaltiesContract.getAddress(),
    );
    // console.log(await bukProtocolContract.getAddress(), " bukProtocolContract");

    // BukPOSNFT
    const BukPOSNFT = await ethers.getContractFactory("BukPOSNFTs");
    nftPosContract = await BukPOSNFT.deploy(
      "BUK_POS",
      bukProtocolContract.getAddress(),
      bukTreasuryContract.getAddress(),
    );
    // console.log(await nftPosContract.getAddress(), " nftPosContract");

    // BukNFT
    const BukNFT = await ethers.getContractFactory("BukNFTs");
    nftContract = await BukNFT.deploy(
      "BUK_NFT",
      nftPosContract.getAddress(),
      bukProtocolContract.getAddress(),
      bukTreasuryContract.getAddress(),
    );
    // console.log(await nftContract.getAddress(), " nftContract");

    //Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplaceContract = await Marketplace.deploy(
      bukProtocolContract.getAddress(),
      nftContract.getAddress(),
      stableTokenContract.getAddress(),
    );

    // console.log(await marketplaceContract.getAddress(), " marketplaceContract");

    //Set BukNFTs address in Buk Protocol
    const setBukNFTs = await bukProtocolContract.setBukNFTs(
      nftContract.getAddress(),
    );
    //Set marketplace role in BukNFT
    await nftContract.setMarketplaceRole(
      await marketplaceContract.getAddress(),
    );
    // console.log("🚀 ~ file: Marketplace.ts:94 ~ setBukNFTs:");

    //Set BukPOSNFTs address in Buk Protocol
    const setBukPOSNFTs = await bukProtocolContract.setBukPOSNFTs(
      nftPosContract.getAddress(),
    );

    //Set Buk Protocol in Treasury
    const setBukEventProtocol = await bukTreasuryContract.setBukEventProtocol(
      bukProtocolContract.getAddress(),
    );

    //Set Buk Protocol in BukRoyalties
    const setBukEventProtocolRoyalties =
      await royaltiesContract.setBukEventProtocolContract(
        bukProtocolContract.getAddress(),
      );

    // console.log("🚀 ~ file: Marketplace.ts:98 ~ setBukPOSNFTs:");

    // Set all required
    await royaltiesContract.setBukRoyaltyInfo(bukTreasuryContract, 200);
    await royaltiesContract.setHotelRoyaltyInfo(bukTreasuryContract, 200);
    await royaltiesContract.setFirstOwnerRoyaltyInfo(200);
    await nftContract.setBukTreasury(await bukTreasuryContract.getAddress());
  });

  describe("Deployment marketplace", function () {
    it("Should set the BUK protocol address", async function () {
      expect(await marketplaceContract.getBukEventProtocol()).to.equal(
        await bukProtocolContract.getAddress(),
      );
    });

    it("Should set the BUK NFT address", async function () {
      expect(await marketplaceContract.getBukNFT()).to.equal(
        await nftContract.getAddress(),
      );
    });

    it("Should set the stable token", async function () {
      expect(await marketplaceContract.getStableToken()).to.equal(
        await stableTokenContract.getAddress(),
      );
    });

    it("Should set the buk protocol contract", async function () {
      expect(await marketplaceContract.getBukEventProtocol()).to.equal(
        await bukProtocolContract.getAddress(),
      );
    });

    it("Should set the buk NFT contract", async function () {
      expect(await marketplaceContract.getBukNFT()).to.equal(
        await nftContract.getAddress(),
      );
    });
  });

  // Test cases for setting buk protocol
  describe("Set Buk protocol contract for marketplace", function () {
    it("Should set the BUK protocol", async function () {
      let newContract = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setBukEventProtocol(newContract))
        .to.not.be.reverted;
      expect(await marketplaceContract.getBukEventProtocol()).to.equal(
        newContract,
      );
    });
    it("Should reverted with error Buk protocol contract", async function () {
      let newContract = "0x0000000000000000000000000000000000000000";
      await expect(
        marketplaceContract.setBukEventProtocol(newContract),
      ).to.be.revertedWith("Invalid address");
    });

    it("Should set the Buk protocol contract and emit event", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setBukEventProtocol(newAddress))
        .to.emit(marketplaceContract, "BukEventProtocolSet")
        .withArgs(newAddress);
    });

    it("Should reverted with admin error Buk protocol contract", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(
        marketplaceContract.connect(account1).setBukEventProtocol(newAddress),
      ).to.be.revertedWith(
        `AccessControl: account ${account1.address.toLowerCase()} is missing role ${await marketplaceContract.ADMIN_ROLE()}`,
      );
    });
  });

  // Test cases for setting buk NFT
  describe("Set Buk NFT contract for marketplace", function () {
    it("Should set the BUK NFT", async function () {
      let newContract = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setBukNFT(newContract)).to.not.be
        .reverted;
      expect(await marketplaceContract.getBukNFT()).to.equal(newContract);
    });
    it("Should reverted with error Buk NFT contract", async function () {
      let newContract = "0x0000000000000000000000000000000000000000";
      await expect(
        marketplaceContract.setBukNFT(newContract),
      ).to.be.revertedWith("Invalid address");
    });

    it("Should set the Buk NFT contract and emit event", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setBukNFT(newAddress))
        .to.emit(marketplaceContract, "BukNFTSet")
        .withArgs(newAddress);
    });

    it("Should reverted with admin error Buk NFT contract", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";

      await expect(
        marketplaceContract.connect(account1).setBukNFT(newAddress),
      ).to.be.revertedWith(
        `AccessControl: account ${account1.address.toLowerCase()} is missing role ${await marketplaceContract.ADMIN_ROLE()}`,
      );
    });
  });

  // Test cases for setting stable token
  describe("Set Stable token for marketplace", function () {
    it("Should set the Stable token", async function () {
      let newContract = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setStableToken(newContract)).to.not
        .be.reverted;
      expect(await marketplaceContract.getStableToken()).to.equal(newContract);
    });
    it("Should reverted with error Stable token", async function () {
      let newContract = "0x0000000000000000000000000000000000000000";
      await expect(
        marketplaceContract.setStableToken(newContract),
      ).to.be.revertedWith("Invalid address");
    });

    it("Should set the Stable token and emit event", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setStableToken(newAddress))
        .to.emit(marketplaceContract, "StableTokenSet")
        .withArgs(newAddress);
    });

    it("Should reverted with admin error Stable token", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";

      await expect(
        marketplaceContract.connect(account1).setStableToken(newAddress),
      ).to.be.revertedWith(
        `AccessControl: account ${account1.address.toLowerCase()} is missing role ${await marketplaceContract.ADMIN_ROLE()}`,
      );
    });
  });

  // Test cases for getting listed status
  describe("Listed status marketplace", function () {
    it("Should get listed status for not listed tokeId", async function () {
      await expect(await marketplaceContract.isBookingListed(0)).to.equal(
        false,
      );
    });

    it("Should book and mint and get details", async function () {
      let tokenId = 1;
      let price = 100;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = date.setDate(date.getDate() + 2);
      let checkout = date.setDate(date.getDate() + 3);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [100000000],
          [80000000],
          [70000000],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          12,
          true,
        ),
      ).not.be.reverted;
      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [1],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      let bookingDetails = await bukProtocolContract.getBookingDetails(1);
      await expect(bookingDetails[8]).to.equal(checkout);
    });

    it("Should book list for sale", async function () {
      let tokenId = 1;
      let price = 100000000;
      let minSalePrice = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = date.setDate(date.getDate() + 2);
      let checkout = date.setDate(date.getDate() + 3);

      //Grant allowance permission
      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account2.getAddress(),
        salePrice,
      );
      await stableTokenContract
        .connect(account1)
        .approve(await marketplaceContract.getAddress(), salePrice);
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [minSalePrice],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          12,
          true,
        ),
      ).not.be.reverted;
      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(marketplaceContract.createListing(tokenId, salePrice)).not.be
        .reverted;
      await expect(await marketplaceContract.isBookingListed(tokenId)).to.equal(
        true,
      );
    });
    it("Should create list allowance check", async function () {
      let tokenId = 1;
      let price = 100000000;
      let minSalePrice = 70000000;
      let salePrice = 120000000;
      let date = new Date();
      let checkin = date.setDate(date.getDate() + 2);
      let checkout = date.setDate(date.getDate() + 3);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [70000000],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          12,
          true,
        ),
      ).not.be.reverted;
      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await expect(
        marketplaceContract.createListing(tokenId, salePrice),
      ).to.be.revertedWith("Approve marketplace for trade");
    });
    it("Should create list minSale check", async function () {
      let tokenId = 1;
      let price = 100000000;
      let minSalePrice = 70000000;
      let salePrice = 50000000;
      let date = new Date();
      let checkin = date.setDate(date.getDate() + 2);
      let checkout = date.setDate(date.getDate() + 3);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [70000000],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          12,
          true,
        ),
      ).not.be.reverted;
      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(
        marketplaceContract.createListing(tokenId, salePrice),
      ).to.be.revertedWith("Minimum price requirement not met");
    });
    it("Create list only confirmed booking check", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = date.setDate(date.getDate() + 2);
      let checkout = date.setDate(date.getDate() + 3);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          12,
          true,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(
        marketplaceContract.createListing(tokenId, salePrice),
      ).to.be.revertedWith("Only tradable if available");
    });
    it("Create list only owner can list", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = date.setDate(date.getDate() + 2);
      let checkout = date.setDate(date.getDate() + 3);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          12,
          true,
        ),
      ).not.be.reverted;
      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      await expect(
        marketplaceContract.connect(account1).createListing(tokenId, salePrice),
      ).to.be.revertedWith("Only owner can list");
    });
    it("Tradable time limit check", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 1) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 1) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          60,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(
        marketplaceContract.createListing(tokenId, salePrice),
      ).to.be.revertedWith("Trade limit time crossed");
    });
    it("Check for already listed NFT", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(marketplaceContract.createListing(tokenId, salePrice)).not.to
        .be.reverted;
      await expect(
        marketplaceContract.createListing(tokenId, salePrice),
      ).to.be.revertedWith("NFT already listed");
    });
    it("Create listing should emit event", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(marketplaceContract.createListing(tokenId, salePrice))
        .to.emit(marketplaceContract, "ListingCreated")
        .withArgs(owner.address, tokenId, salePrice);
    });
  });

  // Test cases for buy booking
  describe("Buy listing on marketplace", function () {
    it("Buy bookings", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 210000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(marketplaceContract.createListing(tokenId, salePrice)).not.to
        .be.reverted;
      //Grant permission to the marketplace
      await expect(
        nftContract.setApprovalForAll(
          await marketplaceContract.getAddress(),
          true,
        ),
      ).not.to.be.reverted;

      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );
      await stableTokenContract
        .connect(account1)
        .approve(await marketplaceContract.getAddress(), transferMoney);
      await expect(marketplaceContract.connect(account1).buyRoom(tokenId)).not
        .to.be.reverted;
      await expect(
        await nftContract.balanceOf(await account1.getAddress(), tokenId),
      ).to.equal(1);
    });
    it("Spender allowance", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 210000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(marketplaceContract.createListing(tokenId, salePrice)).not.to
        .be.reverted;
      //Grant permission to the marketplace
      await expect(
        nftContract.setApprovalForAll(
          await marketplaceContract.getAddress(),
          true,
        ),
      ).not.to.be.reverted;
      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );
      await expect(
        marketplaceContract.connect(account1).buyRoom(tokenId),
      ).to.be.revertedWith("Check the allowance");
    });
    it("Should emit event", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 210000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await expect(marketplaceContract.createListing(tokenId, salePrice)).not.to
        .be.reverted;
      //Grant permission to the marketplace
      await expect(
        nftContract.setApprovalForAll(
          await marketplaceContract.getAddress(),
          true,
        ),
      ).not.to.be.reverted;
      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );
      await stableTokenContract
        .connect(account1)
        .approve(await marketplaceContract.getAddress(), transferMoney);
      await expect(marketplaceContract.connect(account1).buyRoom(tokenId))
        .to.emit(marketplaceContract, "RoomBought")
        .withArgs(tokenId, owner.address, account1.address, salePrice);
    });
  });

  // Test cases for batch buy
  describe("Batch buy listing on marketplace", function () {
    it("Buy bookings", async function () {
      let tokenId1 = 1;
      let tokenId2 = 2;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 410000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        500000000000,
      );

      //Grant permission to the marketplace
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );

      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );

      // Book room and mint NFT 1
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 1
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId1],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // List 1
      await expect(marketplaceContract.createListing(tokenId1, salePrice)).not
        .to.be.reverted;

      // Book room and mint NFT 2
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 2
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId2],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      // List 2
      await expect(marketplaceContract.createListing(tokenId2, salePrice)).not
        .to.be.reverted;

      await stableTokenContract
        .connect(account1)
        .approve(await marketplaceContract.getAddress(), transferMoney);

      await expect(
        marketplaceContract
          .connect(account1)
          .buyRoomBatch([tokenId1, tokenId2]),
      ).not.to.be.reverted;
      await expect(
        await nftContract.balanceOf(await account1.getAddress(), tokenId1),
      ).to.equal(1);
      await expect(
        await nftContract.balanceOf(await account1.getAddress(), tokenId2),
      ).to.equal(1);
    });
    it("Spender allowance", async function () {
      let tokenId1 = 1;
      let tokenId2 = 2;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 410000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        400000000000,
      );
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );

      // Book room and mint NFT 1
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 1
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId1],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      await expect(marketplaceContract.createListing(tokenId1, salePrice)).not
        .to.be.reverted;

      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );
      await expect(
        marketplaceContract.connect(account1).buyRoomBatch([tokenId1]),
      ).to.be.revertedWith("Check the allowance");
    });
    it("Should emit event", async function () {
      let tokenId1 = 1;
      let tokenId2 = 2;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 410000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        400000000000,
      );
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );

      // Book room and mint NFT 1
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 1
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId1],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      await expect(marketplaceContract.createListing(tokenId1, salePrice)).not
        .to.be.reverted;

      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );
      await stableTokenContract
        .connect(account1)
        .approve(await marketplaceContract.getAddress(), transferMoney);
      await expect(
        marketplaceContract.connect(account1).buyRoomBatch([tokenId1]),
      )
        .to.emit(marketplaceContract, "RoomBought")
        .withArgs(tokenId1, owner.address, account1.address, salePrice);
    });
  });

  // Test cases for getting listing details
  describe("Listing details marketplace", function () {
    it("Should get listed details should be zero", async function () {
      let listingDetails = await marketplaceContract.getListingDetails(0);
      await expect(listingDetails[0]).to.equal(0);
      await expect(listingDetails[2]).to.equal(0);
    });
    it("Should get listed details and verify for valid values", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      let listingDetails = await marketplaceContract.getListingDetails(tokenId);
      await expect(listingDetails[0]).to.equal(salePrice);
      await expect(listingDetails[1]).to.equal(await owner.getAddress());
      await expect(listingDetails[2]).to.equal(1);
    });
  });

  // Test cases for delete listing
  describe("Delete listing function marketplace", function () {
    it("Should delete listing ", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(await marketplaceContract.deleteListing(tokenId)).to.not.be
        .reverted;
    });
    it("Should delete listing and verify status", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(await marketplaceContract.deleteListing(tokenId)).to.not.be
        .reverted;
      let listingDetails = await marketplaceContract.getListingDetails(tokenId);
      await expect(listingDetails[0]).to.equal(0);
      await expect(listingDetails[3]).to.equal(0);
    });

    it("Should emit event deleted token ID", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(await marketplaceContract.deleteListing(tokenId))
        .to.emit(marketplaceContract, "DeletedListing")
        .withArgs(tokenId);
    });
    it("Should revert delete listing for not listed token ", async function () {
      let tokenId = 1;
      await expect(
        marketplaceContract.deleteListing(tokenId),
      ).to.be.revertedWith("NFT not listed");
    });
    it("Should revert delete listing for owner", async function () {
      let tokenId = 1;
      let price = 100000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(
        marketplaceContract.connect(account1).deleteListing(tokenId),
      ).to.be.revertedWith("Owner or Buk protocol can delete");
    });
  });

  //Admin role
  describe("Manage Admin Role", function () {
    it("Should add new admin", async function () {
      const DEFAULT_ADMIN_ROLE = keccak256(toUtf8Bytes("DEFAULT_ADMIN_ROLE"));
      //Add new address to Admin role
      expect(
        await marketplaceContract
          .connect(owner)
          .grantRole(DEFAULT_ADMIN_ROLE, account1),
      ).not.be.reverted;

      //Check if the new admin has ADMIN_ROLE
      expect(
        await marketplaceContract.hasRole(DEFAULT_ADMIN_ROLE, account1),
      ).to.equal(true);
    });
    it("Should set new admin and revoke old admin", async function () {
      const DEFAULT_ADMIN_ROLE = keccak256(toUtf8Bytes("DEFAULT_ADMIN_ROLE"));

      //Add new address to Admin role
      expect(
        await marketplaceContract
          .connect(owner)
          .grantRole(DEFAULT_ADMIN_ROLE, account1),
      ).not.be.reverted;

      //Check if the new admin has ADMIN_ROLE
      expect(
        await marketplaceContract
          .connect(owner)
          .hasRole(DEFAULT_ADMIN_ROLE, account1),
      ).to.equal(true);

      //Revoke the new admin's access
      expect(
        await marketplaceContract
          .connect(owner)
          .revokeRole(DEFAULT_ADMIN_ROLE, account1),
      ).not.be.reverted;

      //Check if the new admin still has ADMIN_ROLE
      expect(
        await marketplaceContract
          .connect(owner)
          .hasRole(DEFAULT_ADMIN_ROLE, account1),
      ).to.equal(false);
    });
    it("Should execute function with new admin", async function () {
      const DEFAULT_ADMIN_ROLE = keccak256(toUtf8Bytes("ADMIN_ROLE"));

      //Add new address to Admin role
      expect(
        await marketplaceContract
          .connect(owner)
          .grantRole(DEFAULT_ADMIN_ROLE, account1.address),
      ).not.be.reverted;

      //Check if the new admin has ADMIN_ROLE
      expect(
        await marketplaceContract
          .connect(owner)
          .hasRole(DEFAULT_ADMIN_ROLE, account1.address),
      ).to.equal(true);

      expect(
        await marketplaceContract
          .connect(account1)
          .setBukEventProtocol(await bukProtocolContract.getAddress()),
      ).not.be.reverted;
    });
  });
  // Admin role end

  // Test cases for relist
  describe("Relist listing function marketplace", function () {
    it("Should relist listing ", async function () {
      let tokenId = 1;
      let price = 100000000;
      let newPrice = 120000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(await marketplaceContract.relist(tokenId, newPrice)).to.not
        .be.reverted;
    });
    it("Should revert relist listing for not listed token ", async function () {
      let tokenId = 1;
      let price = 100;
      await expect(
        marketplaceContract.relist(tokenId, price),
      ).to.be.revertedWith("NFT not listed");
    });
    it("Should relist listing and verify status", async function () {
      let tokenId = 1;
      let price = 100000000;
      let newPrice = 120000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(await marketplaceContract.relist(tokenId, newPrice)).to.not
        .be.reverted;
      let listingDetails = await marketplaceContract.getListingDetails(tokenId);
      await expect(listingDetails[0]).to.equal(newPrice);
      await expect(listingDetails[3]).to.equal(1);
    });
    it("Should owner only can relist listing", async function () {
      let tokenId = 1;
      let price = 100000000;
      let newPrice = 120000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(
        marketplaceContract.connect(account1).relist(tokenId, newPrice),
      ).to.be.revertedWith("Only owner can relist");
    });
    it("Should be greater than minSale relist listing", async function () {
      let tokenId = 1;
      let price = 100000000;
      let newPrice = 90000000;
      let salePrice = 100000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(
        marketplaceContract.relist(tokenId, newPrice),
      ).to.be.revertedWith("Minimum price requirement not met");
    });
    it("Should emit event on relist token ID", async function () {
      let tokenId = 1;
      let price = 100000000;
      let newPrice = 120000000;
      let salePrice = 150000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        200000000000,
      );

      // Book room and mint NFT
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      // Approve allowance
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );
      await marketplaceContract.createListing(tokenId, salePrice);
      await expect(await marketplaceContract.relist(tokenId, newPrice))
        .to.emit(marketplaceContract, "Relisted")
        .withArgs(tokenId, salePrice, newPrice);
    });
  });

  // Test cases for indexing
  describe("Indexing for all the listings on marketplace", function () {
    it("Buy bookings", async function () {
      let tokenId1 = 1;
      let tokenId2 = 2;
      let tokenId3 = 3;
      let price = 100000000;
      let salePrice = 110000000;
      let newPrice = 150000000;
      let transferMoney = 410000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        500000000000,
      );

      //Grant permission to the marketplace
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );

      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );

      // Book room and mint NFT 1
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 1
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId1],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      let listingDetails1 = await marketplaceContract.getListingDetails(
        tokenId1,
      );
      await expect(listingDetails1[2]).to.equal(0);

      // List 1
      await expect(marketplaceContract.createListing(tokenId1, salePrice)).not
        .to.be.reverted;

      let listingDetails2 = await marketplaceContract.getListingDetails(
        tokenId1,
      );
      await expect(listingDetails2[2]).to.equal(1);

      await expect(await marketplaceContract.relist(tokenId1, newPrice)).to.not
        .be.reverted;

      let listingDetails3 = await marketplaceContract.getListingDetails(
        tokenId1,
      );
      await expect(listingDetails3[2]).to.equal(2);

      // Book room and mint NFT 2
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 2
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId2],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      // List 2
      await expect(marketplaceContract.createListing(tokenId2, salePrice)).not
        .to.be.reverted;

      // Book room and mint NFT 3
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 3
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId3],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;

      let listingDetails3_1 = await marketplaceContract.getListingDetails(
        tokenId3,
      );
      await expect(listingDetails3_1[2]).to.equal(0);

      // List 3
      await expect(marketplaceContract.createListing(tokenId3, salePrice)).not
        .to.be.reverted;

      let listingDetails3_2 = await marketplaceContract.getListingDetails(
        tokenId3,
      );
      await expect(listingDetails3_2[2]).to.equal(1);

      await expect(await marketplaceContract.deleteListing(tokenId3)).to.not.be
        .reverted;

      let listingDetails3_3 = await marketplaceContract.getListingDetails(
        tokenId3,
      );
      await expect(listingDetails3_3[2]).to.equal(2);

      await expect(marketplaceContract.createListing(tokenId3, salePrice)).not
        .to.be.reverted;

      let listingDetails3_4 = await marketplaceContract.getListingDetails(
        tokenId3,
      );
      await expect(listingDetails3_4[2]).to.equal(3);

      await stableTokenContract
        .connect(account1)
        .approve(await marketplaceContract.getAddress(), transferMoney);

      await expect(
        marketplaceContract
          .connect(account1)
          .buyRoomBatch([tokenId1, tokenId2]),
      ).not.to.be.reverted;
      let listingDetails4 = await marketplaceContract.getListingDetails(
        tokenId1,
      );
      await expect(listingDetails4[2]).to.equal(3);
      await expect(
        await nftContract.balanceOf(await account1.getAddress(), tokenId1),
      ).to.equal(1);
      await expect(
        await nftContract.balanceOf(await account1.getAddress(), tokenId2),
      ).to.equal(1);
    });
  });

  // Add test cases for pause and unpause
  describe("Pause and unpause", function () {
    it("Should pause the contract", async function () {
      await expect(marketplaceContract.pause()).not.to.be.reverted;
      // check paused stauts is true
      expect(await marketplaceContract.paused()).to.equal(true);
    });
    it("Should unpause the contract", async function () {
      await expect(marketplaceContract.pause()).not.to.be.reverted;
      await expect(marketplaceContract.unpause()).not.to.be.reverted;
    });
    it("Should revert create listing when paused", async function () {
      let tokenId = 1;
      let price = 100;
      let salePrice = 150;
      await marketplaceContract.pause();
      await expect(
        marketplaceContract.createListing(tokenId, salePrice),
      ).to.be.revertedWith("Pausable: paused");
    });
    it("Should revert buy listing when paused", async function () {
      let tokenId = 1;
      let price = 100;
      let salePrice = 150;
      await marketplaceContract.pause();
      await expect(
        marketplaceContract.buyRoomBatch([tokenId]),
      ).to.be.revertedWith("Pausable: paused");
    });
    it("Should revert relist listing when paused", async function () {
      let tokenId1 = 1;
      let price = 100000000;
      let salePrice = 110000000;
      let transferMoney = 410000000;
      let date = new Date();
      let propertyId =
        "0x3633666663356135366139343361313561626261336134630000000000000000";
      let checkin = Math.floor(date.setDate(date.getDate() + 2) / 1000);
      let checkout = Math.floor(date.setDate(date.getDate() + 3) / 1000);

      //Grant allowance permission
      const res = await stableTokenContract.approve(
        await bukProtocolContract.getAddress(),
        500000000000,
      );

      //Grant permission to the marketplace
      await nftContract.setApprovalForAll(
        await marketplaceContract.getAddress(),
        true,
      );

      //Approve and transfer amount for transaction for buyer
      await stableTokenContract.transfer(
        await account1.getAddress(),
        transferMoney,
      );

      // Book room and mint NFT 1
      expect(
        await bukProtocolContract.bookRooms(
          [price],
          [price],
          [price],
          [2],
          [0],
          "0x3633666663356135366139343361313561626261336134630000000000000000",
          checkin,
          checkout,
          24,
          true,
        ),
      ).not.be.reverted;

      //Mint 1
      await expect(
        bukProtocolContract.mintBukNFTOwner(
          [tokenId1],
          [
            "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
          ],
          owner.address,
        ),
      ).not.be.reverted;
      await expect(marketplaceContract.createListing(tokenId1, salePrice)).not
        .to.be.reverted;
      await marketplaceContract.pause();
      await expect(
        marketplaceContract.relist(tokenId1, salePrice),
      ).to.be.revertedWith("Pausable: paused");
    });
    it("Should revert pause the contract with other than owner", async function () {
      await expect(
        marketplaceContract.connect(account1).pause(),
      ).to.be.revertedWith(
        `AccessControl: account ${account1.address.toLowerCase()} is missing role ${await marketplaceContract.ADMIN_ROLE()}`,
      );
    });
    it("Should revert buyRoom when paused", async function () {
      let tokenId = 1;
      let price = 100;
      let salePrice = 150;
      await marketplaceContract.pause();
      await expect(
        marketplaceContract.buyRoomBatch([tokenId]),
      ).to.be.revertedWith("Pausable: paused");
    });
    it("Should revert buyRoomBatch when paused", async function () {
      let tokenId = 1;
      let price = 100;
      let salePrice = 150;
      await marketplaceContract.pause();
      await expect(
        marketplaceContract.buyRoomBatch([tokenId]),
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});
// });
