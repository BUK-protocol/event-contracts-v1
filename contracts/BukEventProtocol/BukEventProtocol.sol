// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import { IBukNFTs } from "../BukNFTs/IBukNFTs.sol";
import { IBukTreasury } from "../BukTreasury/IBukTreasury.sol";
import { ISignatureVerifier } from "../SignatureVerifier/ISignatureVerifier.sol";
import { IBukRoyalties } from "../BukRoyalties/IBukRoyalties.sol";
import { IBukEventProtocol } from "../BukEventProtocol/IBukEventProtocol.sol";
import { IBukEventDeployer } from "../BukEventDeployer/IBukEventDeployer.sol";
import "hardhat/console.sol";

/**
 * @title BUK Protocol Contract
 * @author BUK Technology Inc
 * @dev Contract to manage operations of the BUK protocol to manage BukNFTs tokens and underlying sub-contracts.
 */
contract BukEventProtocol is ReentrancyGuard, IBukEventProtocol, Pausable {
    // Using safeERC20
    using SafeERC20 for IERC20;
    /**
     * @dev address _bukWallet        Address of the Buk wallet.
     * @dev address _stableToken          Address of the stable token.
     * @dev address _bukTreasury          Address of the Buk treasury contract.
     * @dev address nftContract Address of the Buk NFT contract.
     * @dev address royaltiesContract  Address of the Buk Royalties Contract.
     */
    address private _admin;
    address private _bukWallet;
    IERC20 private _stableToken;
    IBukTreasury private _bukTreasury;
    IBukEventDeployer private _bukEventDeployer;
    ISignatureVerifier private _signatureVerifier;
    IBukNFTs private _nftContract; // FIXME : We might not need this
    IBukRoyalties private _royaltiesContract;

    /// @dev Commission charged on bookings.
    uint256 public commission = 5;

    /// @dev Counters.Counter Event Ids    Counter for event IDs.
    uint256 private _eventIds;

    /// @dev Counters.Counter bookingIds    Counter for booking IDs.
    uint256 private _bookingIds;

    /**
     * @dev mapping(uint256 => uint256) _eventbookingIds  Mapping of Counters.Counter bookingIds    Counter for Each event booking IDs.
     */
    mapping(uint256 => uint256) private _eventbookingIds; //bookingID -> Booking Details

    /// @dev Max booking limit per transaction.
    uint256 public constant MAX_BOOKING_LIMIT = 25;

    /**
     * @dev mapping(uint256 => Event) _eventDetails   Mapping of Event IDs to event details.
     */
    mapping(uint256 => Event) private _eventDetails; //eventID -> Event Details

    /**
     * @dev mapping(uint256 => Booking) _bookingDetails   Mapping of booking IDs to booking details.
     */
    mapping(uint256 => Booking) private _bookingDetails; //bookingID -> Booking Details

    /**
     * @dev Mapping of event contract address to booking.
     * @dev Each event address maps to another mapping, which maps booking IDs to booking.
     */
    mapping(address => mapping(uint256 => Booking)) private _eventBookings; // eventID -> (bookingID -> Booking)

    /**
     * @dev Modifier onlyAdmin
     * Ensures that the function can only be accessed by the admin.
     * Throws an exception with a custom error message if the calling address is not the admin.
     */
    modifier onlyAdmin() {
        require(
            (msg.sender == _admin),
            "Only admin has access to this function"
        );
        _;
    }

    /**
     * @dev Constructor to initialize the contract
     * @param _bukTreasuryContract Address of the treasury.
     * @param _stableTokenAddr Address of the stable token.
     * @param _bukWalletAddr Address of the Buk wallet.
     * @param _signVerifierContract Address of the signature verifier contract.
     * @param _royaltiesContractAddr Address of the Buk royalties contract.
     */
    constructor(
        address _bukTreasuryContract,
        address _stableTokenAddr,
        address _bukWalletAddr,
        address _signVerifierContract,
        address _royaltiesContractAddr
    ) {
        _setRoyaltiesContract(_royaltiesContractAddr);
        _setAdmin(msg.sender);
        _setBukTreasury(_bukTreasuryContract);
        _setStableToken(_stableTokenAddr);
        _setBukWallet(_bukWalletAddr);
        _setSignatureVerifier(_signVerifierContract);
    }

    /// @dev See {IBukEventProtocol-setAdmin}.
    function setAdmin(address _adminAddr) external onlyAdmin {
        _setAdmin(_adminAddr);
    }

    /// @dev See {IBukEventProtocol-setSignatureVerifier}.
    function setSignatureVerifier(
        address __signatureVerifier
    ) external onlyAdmin {
        _setSignatureVerifier(__signatureVerifier);
    }

    /// @dev See {IBukEventProtocol-setBukTreasury}.
    function setBukTreasury(address _bukTreasuryContract) external onlyAdmin {
        _setBukTreasury(_bukTreasuryContract);
    }

    /// @dev See {IBukEventProtocol-setBukWallet}.
    function setBukWallet(address _bukWalletAddr) external onlyAdmin {
        _setBukWallet(_bukWalletAddr);
    }

    /// @dev See {IBukEventProtocol-setStableToken}.
    function setStableToken(address _stableTokenAddress) external onlyAdmin {
        _setStableToken(_stableTokenAddress);
    }

    /// @dev See {IBukEventProtocol-setBukNFTs}.
    // FIXME
    function setBukNFTs(address _nftContractAddr) external onlyAdmin {
        _nftContract = IBukNFTs(_nftContractAddr);
        emit SetBukNFTs(_nftContractAddr);
    }

    /// @dev See {IBukEventProtocol-setRoyalties}.
    function setRoyaltiesContract(
        address _royaltiesContractAddr
    ) external onlyAdmin {
        _setRoyaltiesContract(_royaltiesContractAddr);
    }

    /// @dev See {IBukEventProtocol-setEventDeployer}.
    function setEventDeployerContract(
        address _deployerContractAddr
    ) external onlyAdmin {
        _setDeployerContract(_deployerContractAddr);
    }

    /// @dev See {IBukEventProtocol-setCommission}.
    function setCommission(
        uint256 _newCommission
    ) external onlyAdmin whenNotPaused {
        require(_newCommission <= 100, "Commission is more than 100");
        commission = _newCommission;
        emit SetCommission(_newCommission);
    }

    /// @dev See {IBukEventProtocol-toggleTradeability}.
    // FIXME
    function toggleTradeability(uint256 _tokenId) external onlyAdmin {
        require(
            _bookingDetails[_tokenId].status != BookingStatus.nil,
            "Check the Booking status"
        );
        _bookingDetails[_tokenId].tradeable = !_bookingDetails[_tokenId]
            .tradeable;
        emit ToggleTradeability(_tokenId, _bookingDetails[_tokenId].tradeable);
    }

    /// @dev See {IBukEventProtocol-pause}.
    function pause() external onlyAdmin {
        _pause();
    }

    /// @dev See {IBukEventProtocol-unpause}.
    function unpause() external onlyAdmin {
        _unpause();
    }

    /// @dev See {IBukEventProtocol-unpause}.
    function createEvent(
        string calldata _name,
        uint256 _referenceId,
        EventType _eventType,
        uint256 _start,
        uint256 _end,
        uint256 _noOfTickets,
        uint256 _tradeTimeLimit,
        bool _tradeable,
        address _owner
    ) external onlyAdmin whenNotPaused returns (uint256) {
        require(
            (_start > block.timestamp && _end > block.timestamp),
            "Dates, Must be in the future"
        );
        require((_end > _start), "End date must be after start date");
        require((_noOfTickets > 0), "Number of tickets must be greater than 0");

        ++_eventIds;
        address eventAddress = _bukEventDeployer.deployEventNFT(
            _name,
            address(this),
            address(_bukTreasury)
        );
        _eventDetails[_eventIds] = Event(
            _eventIds,
            _name,
            _referenceId,
            _eventType,
            _start,
            _end,
            _noOfTickets,
            _tradeTimeLimit,
            _tradeable,
            _owner,
            address(eventAddress)
        );
        emit CreateEvent(
            _name,
            _eventType,
            _start,
            _end,
            _noOfTickets,
            _tradeable,
            address(eventAddress)
        );
        return _eventIds;
    }

    /// @dev See {IBukEventProtocol-bookEvent}.
    function bookEvent(
        uint256 _eventId,
        uint256[] memory _referenceId,
        uint256[] memory _total,
        uint256[] memory _baseRate,
        uint256[] memory _start,
        uint256[] memory _end,
        bool[] memory _tradeable
    ) external nonReentrant whenNotPaused returns (bool) {
        address[] memory users = new address[](1);
        users[0] = msg.sender;
        BookingList memory _params = BookingList(
            _eventId,
            _referenceId,
            _total,
            _baseRate,
            _start,
            _end,
            _tradeable,
            users
        );
        (uint commissionTotal, uint256 total) = _booking(_params);
        return _bookingPayment(commissionTotal, total);
    }

    /// @dev See {IBukEventProtocol-bookEventOwner}.
    function bookEventOwner(
        uint256 _eventId,
        uint256[] memory _referenceId,
        uint256[] memory _total,
        uint256[] memory _baseRate,
        uint256[] memory _start,
        uint256[] memory _end,
        bool[] memory _tradeable,
        address[] memory _user
    ) external onlyAdmin nonReentrant whenNotPaused returns (bool) {
        BookingList memory _params = BookingList(
            _eventId,
            _referenceId,
            _total,
            _baseRate,
            _start,
            _end,
            _tradeable,
            _user
        );
        _booking(_params);
        return true;
    }

    /// @dev See {IBukEventProtocol-bookingRefund}.
    function bookingRefund(
        uint256[] memory _ids,
        address _owner
    ) external whenNotPaused onlyAdmin nonReentrant {
        uint256 len = _ids.length;
        require((len > 0), "Array is empty");
        for (uint256 i = 0; i < len; ++i) {
            require(
                _bookingDetails[_ids[i]].firstOwner == _owner,
                "Check the booking owner"
            );
            require(
                _bookingDetails[_ids[i]].status == BookingStatus.booked,
                "Check the Booking status"
            );
        }
        uint total;
        for (uint256 i = 0; i < len; ++i) {
            _bookingDetails[_ids[i]].status = BookingStatus.cancelled;
            total +=
                _bookingDetails[_ids[i]].total +
                _bookingDetails[_ids[i]].commission;
        }
        _bukTreasury.stableRefund(total, _owner);
        (total, _owner);
        emit BookingRefund(total, _owner);
    }

    /// @dev See {IBukEventProtocol-mintBukNFTOwner}.
    function mintBukNFTOwner(
        uint256[] memory _ids,
        string[] memory _uri,
        address _user
    ) external whenNotPaused nonReentrant onlyAdmin {
        _mintBukNFT(_ids, _uri, _user);
    }

    /// @dev See {IBukEventProtocol-checkin}.
    function checkin(uint256[] memory _ids) external {
        uint256 len = _ids.length;
        for (uint256 i = 0; i < len; ++i) {
            require(
                (_admin == msg.sender) ||
                    (_nftContract.balanceOf(msg.sender, _ids[i]) > 0),
                "Admin or NFT owner can access booking"
            );
            require(
                _bookingDetails[_ids[i]].status == BookingStatus.confirmed,
                "Check the Booking status"
            );
        }
        require(
            ((len > 0) && (len < MAX_BOOKING_LIMIT)),
            "Not in max-min booking limit"
        );
        for (uint256 i = 0; i < len; ++i) {
            _bookingDetails[_ids[i]].status = BookingStatus.checkedin;
            _bookingDetails[_ids[i]].tradeable = false;
        }
        emit CheckinRooms(_ids, true);
    }

    /// @dev See {IBukEventProtocol-checkout}.
    function checkout(
        uint256[] memory _ids,
        address[] memory _recipients
    ) external onlyAdmin whenNotPaused {
        uint256 len = _ids.length;
        require(
            ((len > 0 && _recipients.length > 0) &&
                (len == _recipients.length) &&
                (len < MAX_BOOKING_LIMIT)),
            "Not in max-min booking limit"
        );
        for (uint256 i = 0; i < len; ++i) {
            require(
                _bookingDetails[_ids[i]].status == BookingStatus.checkedin,
                "Check the Booking status"
            );
            require(
                (_bookingDetails[_ids[i]].end < block.timestamp),
                "Checkout date must be before today"
            );
            require(
                (_nftContract.balanceOf(_recipients[i], _ids[i]) > 0),
                "Check NFT owner balance"
            );
        }
        for (uint256 i = 0; i < len; ++i) {
            _bookingDetails[_ids[i]].status = BookingStatus.checkedout;
            _bookingDetails[_ids[i]].tradeable = false;
            _nftContract.burn(_recipients[i], _ids[i], 1);
        }
        emit CheckoutRooms(_ids, true);
    }

    /// @dev See {IBukEventProtocol-cancelRooms}.
    function cancelRooms(
        uint256[] memory _ids,
        uint256[] memory _penalties,
        uint256[] memory _refunds,
        uint256[] memory _charges,
        address _bookingOwner,
        bytes memory _signature
    ) external whenNotPaused onlyAdmin nonReentrant {
        uint256 len = _ids.length;
        require(
            (len == _penalties.length) && (len == _refunds.length),
            "Validate IDs and amounts"
        );
        uint totalPenalty;
        uint totalRefund;
        uint totalCharges;
        for (uint256 i = 0; i < len; ++i) {
            require(
                ((_bookingDetails[_ids[i]].status == BookingStatus.confirmed) ||
                    (_bookingDetails[_ids[i]].status ==
                        BookingStatus.checkedin)),
                "Not a confirmed or checkedin Booking"
            );
            require(
                (_bookingDetails[_ids[i]].start > block.timestamp),
                "Checkin date must be in the future"
            );
            require(
                _nftContract.balanceOf(_bookingOwner, _ids[i]) > 0,
                "Check the booking owner balance"
            );
            require(
                ((_penalties[i] + _refunds[i] + _charges[i]) <
                    (_bookingDetails[_ids[i]].total + 1)),
                "Transfer amount exceeds total"
            );
            totalPenalty += _penalties[i];
            totalRefund += _refunds[i];
            totalCharges += _charges[i];
        }
        // Verify the signature using the generateAndVerify function
        address signer = _signatureVerifier.generateAndVerify(
            totalPenalty,
            totalRefund,
            totalCharges,
            _signature
        );
        require(signer == _bookingOwner, "Invalid owner signature");
        for (uint256 i = 0; i < len; ++i) {
            _bookingDetails[_ids[i]].status = BookingStatus.cancelled;
            _nftContract.burn(_bookingOwner, _ids[i], 1);
        }
        if (totalPenalty > 0)
            _bukTreasury.stableRefund(totalPenalty, _bukWallet);
        if (totalRefund > 0)
            _bukTreasury.stableRefund(totalRefund, _bookingOwner);
        if (totalCharges > 0)
            _bukTreasury.stableRefund(totalCharges, _bukWallet);
        emit CancelRoom(_ids, totalRefund, true);
    }

    /// @dev See {IBukEventProtocol-emergencyCancellation}.
    function emergencyCancellation(
        uint256 _id,
        uint256 _refund,
        uint256 _charges,
        address _bookingOwner
    ) external whenNotPaused onlyAdmin nonReentrant {
        require(
            ((_bookingDetails[_id].status == BookingStatus.confirmed) ||
                (_bookingDetails[_id].status == BookingStatus.checkedin)),
            "Not a confirmed or checkedin Booking"
        );
        require(
            (_bookingDetails[_id].start > block.timestamp),
            "Checkin date must be in the future"
        );
        require(
            _nftContract.balanceOf(_bookingOwner, _id) > 0,
            "Check the booking owner"
        );
        require(
            ((_refund + _charges) <
                (_bookingDetails[_id].total +
                    _bookingDetails[_id].commission +
                    1)),
            "Transfer amount exceeds total"
        );
        _bookingDetails[_id].status = BookingStatus.cancelled;
        _bukTreasury.stableRefund(_refund, _bookingOwner);
        _bukTreasury.stableRefund(_charges, _bukWallet);
        _nftContract.burn(_bookingOwner, _id, 1);
        emit EmergencyCancellation(_id, true);
    }

    /// @dev See {IBukEventProtocol-getEventDetails}.
    function getEventDetails(
        uint256 _eventId
    ) external view returns (Event memory) {
        return _eventDetails[_eventId];
    }

    // TODO - enable it again
    /// @dev See {IBukEventProtocol-getBookingDetails}.
    // function getEventBookingDetails(
    //     uint256 _eventId,
    //     uint256 _tokenId
    // ) external view returns (Booking memory) {
    //     return _eventBookings[_eventId][_tokenId];
    // }

    /// @dev See {IBukEventProtocol-getBookingDetails}.
    function getBookingDetails(
        uint256 _tokenId
    ) external view returns (Booking memory) {
        return _bookingDetails[_tokenId];
    }

    /// @dev See {IBukEventProtocol-getRoyaltyInfo}.
    function getRoyaltyInfo(
        uint256 _tokenId
    ) external view returns (IBukRoyalties.Royalty[] memory) {
        IBukRoyalties.Royalty[] memory royalties = _royaltiesContract
            .getRoyaltyInfo(_tokenId);
        return royalties;
    }

    /// @dev See {IBukEventProtocol-getWallets}.
    function getWallets()
        external
        view
        returns (
            address nftContract,
            address royaltiesContract,
            address signatureVerifier,
            address bukTreasury,
            address stableToken,
            address bukWallet,
            address admin
        )
    {
        return (
            address(_nftContract),
            address(_royaltiesContract),
            address(_signatureVerifier),
            address(_bukTreasury),
            address(_stableToken),
            address(_bukWallet),
            address(_admin)
        );
    }

    /**
     * Private function to set the Admin Wallet address
     * @param _adminAddr The address of the Admin Wallet
     */
    function _setAdmin(address _adminAddr) private {
        require(_adminAddr != address(0), "Invalid address");
        _admin = _adminAddr;
        emit SetAdminWallet(_adminAddr);
    }

    /**
     * Private function to set the Signature Verifier contract address
     * @param _signatureVerifierContract The address of the Signature Verifier contract
     */
    function _setSignatureVerifier(address _signatureVerifierContract) private {
        _signatureVerifier = ISignatureVerifier(_signatureVerifierContract);
        emit SetSignerVerifier(_signatureVerifierContract);
    }

    /**
     * Private function to set the Royalty contract address
     * @param _royaltiesContractAddr The address of the Royalties contract
     */
    function _setRoyaltiesContract(address _royaltiesContractAddr) private {
        _royaltiesContract = IBukRoyalties(_royaltiesContractAddr);
        emit SetRoyaltiesContract(_royaltiesContractAddr);
    }

    /**
     * Private function to set the BukTreasury contract address
     * @param _bukTreasuryContract The address of the BukTreasury contract
     */
    function _setBukTreasury(address _bukTreasuryContract) private {
        require(_bukTreasuryContract != address(0), "Invalid address");
        _bukTreasury = IBukTreasury(_bukTreasuryContract);
        emit SetBukTreasury(_bukTreasuryContract);
    }

    /**
     * Private function to set the BukWallet contract address
     * @param _bukWalletAddr The address of the BukWallet contract
     */
    function _setBukWallet(address _bukWalletAddr) private {
        require(_bukWalletAddr != address(0), "Invalid address");
        _bukWallet = _bukWalletAddr;
        emit SetBukWallet(_bukWalletAddr);
    }

    /**
     * Private function to set the Buk Event Deployer contract address
     * @param _deployerContractAddr The address of the Buk Event Deployer contract
     */
    function _setDeployerContract(address _deployerContractAddr) private {
        require(_deployerContractAddr != address(0), "Invalid address");
        _bukEventDeployer = IBukEventDeployer(_deployerContractAddr);
        emit SetEventDeployerContract(_deployerContractAddr);
    }

    /**
     * Private function to set the stable token contract address
     * @param _stableTokenAddress The address of the stable token contract
     */
    function _setStableToken(address _stableTokenAddress) private {
        require(_stableTokenAddress != address(0), "Invalid address");
        _stableToken = IERC20(_stableTokenAddress);
        emit SetStableToken(_stableTokenAddress);
    }

    /**
     * @dev Function to do the booking payment.
     * @param _commission Total BUK commission.
     * @param _total Total Booking Charge Excluding BUK commission.
     */
    function _bookingPayment(
        uint256 _commission,
        uint256 _total
    ) private returns (bool) {
        require(
            _stableToken.balanceOf(msg.sender) >= _total + _commission,
            "Insufficient balance for booking"
        );

        _stableToken.safeTransferFrom(msg.sender, _bukWallet, _commission);
        _stableToken.safeTransferFrom(
            msg.sender,
            address(_bukTreasury),
            _total
        );
        return true;
    }

    /**
     * Function to capture booking details.
     * @param _bookingData It contains the booking details.
     * @return commissionTotal Total BUK commission.
     */
    function _booking(
        BookingList memory _bookingData
    ) private returns (uint, uint256) {
        // add validation to check event exists
        uint256 eventId = _bookingData.eventId;
        require(
            _eventDetails[eventId].eventId == eventId,
            "Event does not exist"
        );
        uint totalLen = _bookingData.total.length;
        require(
            ((totalLen == _bookingData.baseRate.length) &&
                (totalLen == _bookingData.referenceId.length) &&
                (totalLen == _bookingData.start.length) &&
                (totalLen == _bookingData.user.length) &&
                (totalLen == _bookingData.end.length) &&
                (totalLen > 0)),
            "Array sizes mismatch"
        );
        require(
            _bookingData.total.length <= MAX_BOOKING_LIMIT,
            "Exceeded max ticket per booking"
        );

        uint256 totalAmount;
        uint commissionTotal;
        for (uint256 i = 0; i < _bookingData.total.length; ++i) {
            require(
                (_bookingData.start[i] > block.timestamp),
                "Start date must be in the future"
            );
            require(
                (_bookingData.end[i] > _bookingData.start[i]),
                "End date must be after start"
            );
            console.log(
                "Booking current event id: ",
                _eventbookingIds[eventId]
            );
            _eventbookingIds[eventId] = _eventbookingIds[eventId] + 1;
            uint256 bukCommission = (_bookingData.baseRate[i] * commission) /
                100;

            address eventAddr = _eventDetails[_bookingData.eventId]
                .eventAddress;
            _eventBookings[eventAddr][_eventbookingIds[eventId]] = Booking(
                _eventbookingIds[eventId],
                0,
                eventId,
                _bookingData.referenceId[i],
                _bookingData.total[i],
                _bookingData.baseRate[i],
                bukCommission,
                _bookingData.start[i],
                _bookingData.end[i],
                BookingStatus.booked,
                _bookingData.user[i],
                _bookingData.tradeable[i]
            );
            totalAmount += _bookingData.total[i];
            commissionTotal += bukCommission;
            emit EventBooked(
                eventId,
                _eventbookingIds[eventId],
                _bookingData.user[i],
                _bookingData.referenceId[i],
                _bookingData.start[i],
                _bookingData.end[i]
            );
        }
        return (commissionTotal, totalAmount);
    }

    /// @dev See {IBukEventProtocol-mintBukNFT}.
    function _mintBukNFT(
        uint256[] memory _ids,
        string[] memory _uri,
        address _user
    ) private {
        uint256 len = _ids.length;
        require((len == _uri.length), "Check Ids and URIs size");
        require(((len > 0) && (len < 11)), "Not in max - min booking limit");
        for (uint256 i = 0; i < len; ++i) {
            require(
                _bookingDetails[_ids[i]].status == BookingStatus.booked,
                "Check the Booking status"
            );
            require(
                _bookingDetails[_ids[i]].firstOwner == _user,
                "Only booking owner can mint"
            );
        }
        for (uint256 i = 0; i < len; ++i) {
            _bookingDetails[_ids[i]].status = BookingStatus.confirmed;
            _nftContract.mint(
                _ids[i],
                _bookingDetails[_ids[i]].firstOwner,
                1,
                "",
                _uri[i]
            );
            _bookingDetails[_ids[i]].tokenId = _ids[i];
        }
        emit MintedBookingNFT(_ids, true);
    }
}
