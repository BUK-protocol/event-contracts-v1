import { expect } from "chai";
import { ethers } from "hardhat";

describe("EventProtocol Bookings", function () {
  // get current epoch time and add 10 days to it
  const now = Math.floor(Date.now() / 1000);
  const fiveDays = 5 * 24 * 60 * 60;
  const startFromNow = now + fiveDays;
  const endFromNow = startFromNow + fiveDays;

  let stableTokenContract;
  let bukEventProtocolContract;
  let marketplaceContract;
  let signatureVerifierContract;
  let royaltiesContract;
  let deployerContract;
  let owner;
  let account1;
  let account2;
  let adminWallet;
  let bukWallet;
  let bukTreasuryContract;
  let nftContract;
  let sellerWallet;
  let buyerWallet;
  let eventDetails;
  let eventAddress;
  let eventNFTContract;
  beforeEach("deploy the contract instance first", async function () {
    [
      adminWallet,
      owner,
      account1,
      account2,
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
      100000000000,
    );

    //BukTreasury
    const BukTreasury = await ethers.getContractFactory("BukTreasury");
    bukTreasuryContract = await BukTreasury.deploy(
      stableTokenContract.getAddress(),
    );

    //Deploy SignatureVerifier contract
    const SignatureVerifier =
      await ethers.getContractFactory("SignatureVerifier");
    signatureVerifierContract = await SignatureVerifier.deploy();

    //Deploy BukRoyalties contract
    const BukRoyalties = await ethers.getContractFactory("BukRoyalties");
    royaltiesContract = await BukRoyalties.deploy();

    //EventProtocol
    const EventProtocol = await ethers.getContractFactory("BukEventProtocol");
    bukEventProtocolContract = await EventProtocol.deploy(
      bukTreasuryContract.getAddress(),
      stableTokenContract.getAddress(),
      bukWallet.getAddress(),
      signatureVerifierContract.getAddress(),
      royaltiesContract.getAddress(),
    );

    // BukNFT
    const BukNFT = await ethers.getContractFactory("BukNFTs");
    nftContract = await BukNFT.deploy(
      "BUK_NFT",
      bukEventProtocolContract.getAddress(),
      bukTreasuryContract.getAddress(),
    );

    //Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplaceContract = await Marketplace.deploy(
      bukEventProtocolContract.getAddress(),
      stableTokenContract.getAddress(),
    );

    // Deployer
    const BukEventDeployerFactory =
      await ethers.getContractFactory("BukEventDeployer");
    deployerContract = await BukEventDeployerFactory.deploy(
      await bukEventProtocolContract.getAddress(),
    );

    //Set Buk Royalty Info in BukRoyalties
    await royaltiesContract.setBukRoyaltyInfo(bukTreasuryContract, 200);
    //Set Hotel Royalty Info in BukRoyalties
    await royaltiesContract.setHotelRoyaltyInfo(bukTreasuryContract, 200);
    //Set First Owner Royalty Info in BukRoyalties
    await royaltiesContract.setFirstOwnerRoyaltyInfo(200);
    //Set Buk Treasury in BukNFTs
    await nftContract.setBukTreasury(await bukTreasuryContract.getAddress());

    // Set deployer contract
    await bukEventProtocolContract.setEventDeployerContract(
      await deployerContract.getAddress(),
    );

    //Grant allowance permission
    const res = await stableTokenContract
      .connect(owner)
      .approve(await bukEventProtocolContract.getAddress(), 150000000);

    // Create event
    const now = Math.floor(Date.now() / 1000);
    const tenDays = 10 * 24 * 60 * 60;
    const tenDaysFromNow = now + tenDays;
    const eventName = "Web3 Carnival";
    const refId =
      "0x3633666663356135366139343361313561626261336134630000000000000000";
    const _eventType = 1;
    const _start = startFromNow;
    const _end = endFromNow;
    const _noOfTickets = 10000;
    const _total = 100000000;
    const _baseRate = 80000000;
    const _tradeTimeLimit = 24;
    const _tradeable = true;

    await bukEventProtocolContract.createEvent(
      eventName,
      refId,
      _eventType,
      _start,
      _end,
      _noOfTickets,
      _tradeTimeLimit,
      account1.address,
    );
    eventDetails = await bukEventProtocolContract.getEventDetails(1);
    eventAddress = eventDetails[9];
    eventNFTContract = await ethers.getContractAt("BukNFTs", eventAddress);

    let eventId = 1;
    let bookingRefId = [
      "0x3633666663356135366139343361313561626261336134630000000000000000",
    ];
    let total = [100000000];
    let baseRate = [80000000];
    let start = [startFromNow];
    let end = [endFromNow];
    let tradeable = [true];
    let nftIds = [1];
    let urls = [
      "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
    ];

    await bukEventProtocolContract
      .connect(owner)
      .bookEvent(eventId, bookingRefId, total, baseRate, start, end, tradeable);

    await bukEventProtocolContract.mintBukNFTOwner(eventId, nftIds, urls);
  });

  describe("Deployment marketplace", function () {
    it("Should check configured the BUK event protocol address", async function () {
      expect(await marketplaceContract.getBukEventProtocol()).to.equal(
        await bukEventProtocolContract.getAddress(),
      );
    });

    it("Should check configured the stable token", async function () {
      expect(await marketplaceContract.getStableToken()).to.equal(
        await stableTokenContract.getAddress(),
      );
    });

    it("Should set the buk event protocol contract", async function () {
      await marketplaceContract.setBukEventProtocol(
        await account2.getAddress(),
      );
      expect(await marketplaceContract.getBukEventProtocol()).to.equal(
        await account2.getAddress(),
      );
    });

    it("Should set the stable token contract", async function () {
      await marketplaceContract.setStableToken(await account2.getAddress());
      expect(await marketplaceContract.getStableToken()).to.equal(
        await account2.getAddress(),
      );
    });

    it("Should set the Buk protocol contract and emit event", async function () {
      let newAddress = "0xa9a1C7be37Cb72811A6C4C278cA7C403D6459b78";
      await expect(await marketplaceContract.setBukEventProtocol(newAddress))
        .to.emit(marketplaceContract, "BukEventProtocolSet")
        .withArgs(newAddress);
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
      await expect(
        await marketplaceContract.isBookingListed(eventDetails[9], 0),
      ).to.equal(false);
    });

    it("Should book list for sale", async function () {
      // Approve allowance
      await eventNFTContract
        .connect(owner)
        .setApprovalForAll(await marketplaceContract.getAddress(), true);
      await expect(
        marketplaceContract
          .connect(owner)
          .createListing(eventAddress, 1, 100000000),
      ).not.be.reverted;
      await expect(
        await marketplaceContract.isBookingListed(eventAddress, 1),
      ).to.equal(true);
    });
    it("Should create list allowance check", async function () {
      let eventAddress = eventDetails[9];
      // Approve allowance
      await expect(
        marketplaceContract
          .connect(owner)
          .createListing(eventAddress, 1, 100000000),
      ).to.be.revertedWith("Approve marketplace for trade");
    });

    it("Create list only confirmed booking check", async function () {
      let eventId = 1;
      let bookingRefId = [
        "0x3633666663356135366139343361313561626261336134630000000000000000",
      ];
      let total = [100000000];
      let baseRate = [80000000];
      let start = [startFromNow];
      let end = [endFromNow];
      let tradeable = [true];

      await stableTokenContract
        .connect(owner)
        .approve(await bukEventProtocolContract.getAddress(), 200000000000);

      await bukEventProtocolContract
        .connect(owner)
        .bookEvent(eventId, bookingRefId, total, baseRate, start, end, [false]);

      await bukEventProtocolContract.mintBukNFTOwner(
        eventId,
        [2],
        [
          "https://ipfs.io/ipfs/bafyreigi54yu7sosbn4b5kipwexktuh3wpescgc5niaejiftnuyflbe5z4/metadata.json",
        ],
      );

      // Approve allowance
      await eventNFTContract
        .connect(owner)
        .setApprovalForAll(await marketplaceContract.getAddress(), true);
      await expect(
        marketplaceContract
          .connect(owner)
          .createListing(eventAddress, 2, 100000000),
      ).to.be.revertedWith("Non tradeable NFT");
    });

    it("Check for already listed NFT", async function () {
      // Approve allowance
      await eventNFTContract
        .connect(owner)
        .setApprovalForAll(await marketplaceContract.getAddress(), true);

      await expect(
        marketplaceContract
          .connect(owner)
          .createListing(eventAddress, 1, 100000000),
      ).not.to.be.reverted;

      await expect(
        marketplaceContract
          .connect(owner)
          .createListing(eventAddress, 1, 100000000),
      ).to.be.revertedWith("NFT already listed");
    });
    it("Create listing should emit event", async function () {
      // Approve allowance
      await eventNFTContract
        .connect(owner)
        .setApprovalForAll(await marketplaceContract.getAddress(), true);

      await expect(
        marketplaceContract
          .connect(owner)
          .createListing(eventAddress, 1, 100000000),
      )
        .to.emit(marketplaceContract, "ListingCreated")
        .withArgs(eventAddress, 1, owner.address, 100000000);
    });
  });
});
