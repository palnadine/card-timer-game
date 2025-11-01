// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CardTimerGame
/// @notice 12 Karten-Spiel mit Timer. Jede Karte kann gekauft werden.
///         Der sichtbare Kartenpreis ist der aktuelle Kaufpreis.
///         Nach dem Kauf verdoppelt sich der Preis, und der Vorbesitzer erhält 150% seines Kaufpreises.
///         Wenn der Timer abläuft, gewinnt der letzte Käufer den gesamten Pot.
contract CardTimerGame {
    struct Card {
        uint256 price;      // aktueller Preis (in Wei) – der Preis, den der Käufer zahlen muss
        address owner;      // aktueller Besitzer
        uint256 duration;   // Dauer (Sekunden) – setzt den globalen Timer bei Kauf zurück
    }

    Card[12] public cards;

    uint256 public endTime;          // Zeitstempel, wann das Spiel endet
    address public lastBuyer;        // letzter Käufer
    uint8 public lastCardId;         // zuletzt gekaufte Karte
    bool public gameActive;          // ob eine Runde läuft

    // Reentrancy-Guard
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "Reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // Events
    event CardBought(
        uint8 indexed cardId,
        address indexed buyer,
        address indexed previousOwner,
        uint256 paidAmount,
        uint256 newPrice,
        uint256 newEndTime
    );
    event PrizeClaimed(address indexed winner, uint256 amount);
    event GameReset();
    event CardPriceSet(uint8 indexed cardId, uint256 price, uint256 duration);

    constructor() payable {
        // Alle Karten starten bei 1 Ether
        uint256 initialPrice = 1 gwei;

        // Timer von 2 bis 12 Minuten gleichmäßig verteilen (120s..720s)
        for (uint8 i = 0; i < 12; i++) {
            uint256 durationSeconds = 60 + (uint256(i) * 60); // 600 = 720 - 120
            cards[i] = Card({
                price: initialPrice,
                owner: address(0),
                duration: durationSeconds
            });
            emit CardPriceSet(i, initialPrice, durationSeconds);
        }

        gameActive = false;
        endTime = 0;
        lastBuyer = address(0);
    }

    /// @notice Karte kaufen (0..11). Man zahlt den aktuellen Preis.
    /// @dev Nach dem Kauf verdoppelt sich der Preis.
    function buyCard(uint8 cardId) external payable nonReentrant {
        require(cardId < 12, "Invalid card id");

        // Wenn Spiel aktiv ist, darf nur gekauft werden, wenn Timer noch läuft
        if (gameActive) {
            require(block.timestamp < endTime, "Timer expired, claim prize first");
        }

        Card storage c = cards[cardId];
        uint256 price = c.price;
        require(msg.value >= price, "Insufficient payment");

        address prevOwner = c.owner;
        uint256 payout = 0;

        // Vorbesitzer bekommt 150% seines damaligen Preises
        if (prevOwner != address(0)) {
            payout = (price * 3) / 2;
            // Wenn zu wenig Balance im Vertrag ist, könnte der neue Käufer das decken (aber hier safe, weil Preis >= payout / 1.5)
            if (address(this).balance >= payout) {
                (bool sent, ) = prevOwner.call{value: payout}("");
                require(sent, "Payout failed");
            }
        }

        // Neuer Besitzer & Preis verdoppeln
        c.owner = msg.sender;
        c.price = price * 2;

        // Timer resetten
        endTime = block.timestamp + c.duration;
        lastBuyer = msg.sender;
        lastCardId = cardId;
        gameActive = true;

        // Überzahlung rückerstatten
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit CardBought(cardId, msg.sender, prevOwner, price, c.price, endTime);
    }

    /// @notice Timer abgelaufen → letzter Käufer kann den gesamten Pot beanspruchen
    function claimPrize() external nonReentrant {
        require(gameActive, "No active game");
        require(block.timestamp >= endTime, "Timer not expired");
        require(lastBuyer != address(0), "No buyer recorded");

        uint256 pot = address(this).balance;
        require(pot > 0, "No funds");

        address winner = lastBuyer;

        // Zustand zurücksetzen, bevor Ether versendet wird
        gameActive = false;
        lastBuyer = address(0);
        endTime = 0;
        lastCardId = 0;

        (bool sent, ) = winner.call{value: pot}("");
        require(sent, "Prize transfer failed");

        emit PrizeClaimed(winner, pot);
    }

    /// @notice Reset des Spiels – setzt Kartenpreise auf 1 Ether und löscht Besitzer
    function resetGame() external nonReentrant {
        require(!gameActive, "Game still active");
        uint256 initialPrice = 1 ether;
        for (uint8 i = 0; i < 12; i++) {
            cards[i].price = initialPrice;
            cards[i].owner = address(0);
        }
        emit GameReset();
    }

    /// @notice Karte abfragen
    function getCard(uint8 cardId)
        external
        view
        returns (uint256 price, address owner, uint256 duration)
    {
        require(cardId < 12, "Invalid card id");
        Card storage c = cards[cardId];
        return (c.price, c.owner, c.duration);
    }

    receive() external payable {}
    fallback() external payable {}
}