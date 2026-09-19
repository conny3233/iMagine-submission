// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ConsentRegistry
/// @notice 동의 영수증의 해시를 봉인한다. 특정 기관에 묶이지 않는 범용 레지스트리 —
///         어느 기관이든 자기 주소로 기록하고, 누구나 지갑 없이 조회·대조할 수 있다.
///         이름·연락처·원문·상세 답변은 올리지 않는다. 한 번 기록된 영수증은 덮어쓸 수 없다.
contract ConsentRegistry {
    struct Receipt {
        bytes32 recordHash;   // 영수증 payload 의 정규화 SHA-256
        bytes32 documentHash; // 동의 당시 문서 버전(content)의 정규화 SHA-256
        string documentRef;   // 사람이 읽는 문서 식별자 (예: "privacy-complaint@v1")
        uint64 recordedAt;    // 블록 시각. 기록자가 보낸 값이 아니다
        address issuer;       // 기록한 기관의 주소
    }

    mapping(bytes32 => Receipt) private _receipts;

    event ConsentRecorded(
        bytes32 indexed receiptId,
        bytes32 recordHash,
        bytes32 documentHash,
        string documentRef,
        address indexed issuer
    );

    error AlreadyRecorded(bytes32 receiptId);
    error NotFound(bytes32 receiptId);
    error EmptyHash();

    /// @notice 영수증을 봉인한다. 같은 receiptId 로 두 번 기록할 수 없다 (기록자가 달라도).
    function record(
        bytes32 receiptId,
        bytes32 recordHash,
        bytes32 documentHash,
        string calldata documentRef
    ) external {
        if (recordHash == bytes32(0) || documentHash == bytes32(0)) {
            revert EmptyHash();
        }
        if (_receipts[receiptId].recordedAt != 0) {
            revert AlreadyRecorded(receiptId);
        }
        _receipts[receiptId] = Receipt({
            recordHash: recordHash,
            documentHash: documentHash,
            documentRef: documentRef,
            recordedAt: uint64(block.timestamp),
            issuer: msg.sender
        });
        emit ConsentRecorded(receiptId, recordHash, documentHash, documentRef, msg.sender);
    }

    /// @notice 봉인된 기록을 조회한다. 없으면 revert.
    function get(bytes32 receiptId) external view returns (Receipt memory) {
        Receipt memory r = _receipts[receiptId];
        if (r.recordedAt == 0) revert NotFound(receiptId);
        return r;
    }

    /// @notice 기록 존재 여부.
    function exists(bytes32 receiptId) external view returns (bool) {
        return _receipts[receiptId].recordedAt != 0;
    }

    /// @notice 손에 든 영수증의 해시가 봉인된 값과 같은지.
    function verify(bytes32 receiptId, bytes32 recordHash) external view returns (bool) {
        Receipt storage r = _receipts[receiptId];
        return r.recordedAt != 0 && r.recordHash == recordHash;
    }

    /// @notice 지금 문서의 해시가 동의 당시 문서와 같은지. 다르면 약관이 달라진 것이다.
    function verifyDocument(bytes32 receiptId, bytes32 documentHash) external view returns (bool) {
        Receipt storage r = _receipts[receiptId];
        return r.recordedAt != 0 && r.documentHash == documentHash;
    }
}
