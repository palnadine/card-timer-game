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

  async function buyFirstCard() {
    if (!contract) {
      alert("Bitte zuerst Wallet verbinden!");
      return;
    }

    try {
      const card = await contract.getCard(0);
      const price = card[0];
      console.log("Kartenpreis:", ethers.formatEther(price), "ETH");

      const tx = await contract.buyCard(0, { value: price });
      setMessage("Transaktion wird gesendet... ⏳");

      const receipt = await tx.wait();
      console.log("Tx bestätigt ✅", receipt);
      setMessage("Karte erfolgreich gekauft ✅");
    } catch (err: any) {
      console.error(err);
      setMessage(`Fehler beim Kauf ❌: ${err.message}`);
    }
  }

  useEffect(() => {
    if (!contract) return;

    const handleCardBought = (
      cardId: number,
      buyer: string,
      previousOwner: string,
      paidAmount: bigint,
      newPrice: bigint,
      newEndTime: bigint
    ) => {
      console.log("Event erkannt:", { cardId, buyer, previousOwner, paidAmount, newPrice, newEndTime });
      setMessage(
        `🃏 Karte ${cardId} gekauft von ${buyer.slice(0, 6)}...\nNeuer Preis: ${ethers.formatEther(newPrice)} ETH`
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

      <div className="mt-4">
        <button
          onClick={testContract}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Spielstatus abrufen
        </button>
      </div>

      <div className="mt-4">
        <button
          onClick={buyFirstCard}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Erste Karte kaufen 💰
        </button>
      </div>

      <pre className="mt-6 whitespace-pre-wrap">{message}</pre>
    </div>
  );
}

export default App;
