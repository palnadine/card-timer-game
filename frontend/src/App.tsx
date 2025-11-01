import { useEffect, useState } from "react";
import { ethers } from "ethers";
import contractJson from "./CardTimerGame.json";

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [message, setMessage] = useState<string>("");
  const [cards, setCards] = useState<{ id: number; price: string; owner: string | null }[]>(
    Array.from({ length: 12 }, (_, i) => ({ id: i, price: "0.000000001", owner: "0x0000..." }))
  );

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask nicht gefunden!");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);

    const signer = await provider.getSigner();
    const gameContract = new ethers.Contract(
      contractAddress,
      contractJson.abi,
      signer
    );
    setContract(gameContract);

    setMessage("Wallet verbunden ✅");
  }

  async function testContract() {
    if (!contract) {
      alert("Bitte zuerst Wallet verbinden!");
      return;
    }

    try {
      const active: boolean = await contract.gameActive();
      const endTime: bigint = await contract.endTime();
      const endDate = new Date(Number(endTime) * 1000).toLocaleString();
      setMessage(`Spiel aktiv: ${active ? "✅ Ja" : "❌ Nein"}\nEnde: ${endDate}`);
     } catch (err) {
      console.error(err);
      setMessage("Fehler beim Aufruf ❌");
    }
  }

  async function loadCards() {
    if (!contract) return;

    const cardArray = [];
    for (let i = 0; i < 12; i++) {
      const card = await contract.getCard(i);
      cardArray.push({
        id: i,
        price: ethers.formatEther(card[0]),
        owner: `${card[1].slice(0, 6)}...`,
      });
    }

    setCards(cardArray);
  }

  async function buyCard(cardId: number, price: string) {
    if (!contract) {
      alert("Bitte zuerst Wallet verbinden!");
      return;
    }

    try {
      // price ist jetzt als String in ETH übergeben, wir müssen es in Wei konvertieren
      const tx = await contract.buyCard(cardId, { value: ethers.parseEther(price) });
      setMessage(`Karte ${cardId} wird gekauft... ⏳`);

      await tx.wait();
      setMessage(`Karte ${cardId} erfolgreich gekauft ✅`);

    } catch (err: any) {
      console.error(err);
      setMessage(`Fehler beim Kauf ❌: ${err.message}`);
    }
  }

  useEffect(() => {
    if (!contract) return;

    loadCards();

    const handleCardBought = (
      cardId: bigint,
      buyer: string,
      previousOwner: string,
      paidAmount: bigint,
      newPrice: bigint,
      newEndTime: bigint
    ) => {
      const id = Number(cardId);

      setCards((prevCards) =>
        prevCards.map((card) =>
          card.id === id
            ? {
                ...card,
                owner: `${buyer.slice(0, 6)}...`,
                price: ethers.formatEther(newPrice),
              }
            : card
        )
      );

      setMessage(
        `🃏 Karte ${id} wurde ${previousOwner} abgekauft von ${buyer.slice(0, 6)}... für ${ethers.formatEther(
          paidAmount
        )} ETH und der Timer auf ${newEndTime} gesetzt`
      );
    };

    contract.on("CardBought", handleCardBought);
    console.log("🎧 Lausche auf CardBought-Events...");

    return () => {
      console.log("🧹 Entferne Event-Listener...");
      try {
        contract.off("CardBought", handleCardBought);
      } catch (err) {
        console.warn("Fehler beim Entfernen des Event-Listeners:", err);
      }
    };
  }, [contract]);

  return (
    <div className="p-6 text-center">
      <h1 className="text-3xl font-bold mb-4">🃏 Card Timer Game</h1>

      <button
        onClick={connectWallet}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {account ? `Verbunden: ${account.slice(0, 6)}...` : "Mit MetaMask verbinden"}
      </button>

      {/* Spielstatus-Button */}
      <div className="mt-4">
        <button
          onClick={testContract}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Spielstatus abrufen
        </button>
      </div>

      {/* Message-Anzeige */}
      <pre className="mt-6 whitespace-pre-wrap">{message}</pre>

      {/* Karten-Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 justify-center">
        {cards.map((card) => (
          <div
            key={card.id}
            className="bg-white border rounded-lg shadow-lg w-32 h-44 p-4 flex flex-col justify-between items-center
                      hover:scale-105 transition-transform duration-200 cursor-pointer"
          >
            <div className="text-3xl">🃏</div>
            <h2 className="text-lg font-semibold mt-2">Karte {card.id}</h2>
            <p className="text-sm mt-1">Preis: {card.price} ETH</p>
            <p className="text-xs text-gray-600 mt-1">
              Besitzer: {card.owner ? card.owner.slice(0, 6) + "..." : "Noch frei"}
            </p>
            <button
              onClick={() => buyCard(card.id, card.price)}
              disabled={card.owner !== null}
              className="mt-2 bg-purple-600 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              Kaufen 💰
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default App;
