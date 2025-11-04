import { useEffect, useState } from "react";
import { ethers } from "ethers";
import contractJson from "./CardTimerGame.json";
import { ChakraProvider, Box, SimpleGrid, Button, Heading, Text, defaultSystem } from "@chakra-ui/react";
import { Icon } from "@chakra-ui/react";
import { FaEthereum, FaClock } from "react-icons/fa";
import AnimatedCard from "./AnimatedCard";

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
  const [cards, setCards] = useState<{ id: number; price: string; owner: string | null; duration: number }[]>(
    Array.from({ length: 12 }, (_, i) => ({ id: i, price: "0.000000001", owner: "0x0000...", duration: i + 1 }))
  );
  // global game state
  const [gameActiveState, setGameActiveState] = useState<boolean | null>(null);
  const [lastBuyerState, setLastBuyerState] = useState<string | null>(null);
  // Timer
  const [endTime, setEndTime] = useState<number | null>(null); // Sekunden (Unix)
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // verbleibende Sekunden

  async function checkWalletConnection() {
    if (!window.ethereum) return null;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_accounts", []);
    return accounts.length > 0 ? accounts[0] : null;
  }

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
      const end = Number(endTime) * 1000;
      const endDate = new Date(end).toLocaleString();

      setMessage(`Spiel aktiv: ${active ? "✅ Ja" : "❌ Nein"}\nEnde: ${endDate}`);

      if (active && end > Date.now()) {
        setTimeLeft(Math.floor((end - Date.now()) / 1000));
      } else {
        setTimeLeft(null);
      }

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
        duration: i + 1,
      });
    }

    setCards(cardArray);
  }

  // Lädt den globalen Spielzustand einmalig (async)
  async function updateGameStateOnce() {
    if (!contract) return;

    const active = await contract.gameActive();
    const endTimeBn = await contract.endTime();
    const lastBuyer = await contract.lastBuyer();

    const end = Number(endTimeBn);
    setGameActiveState(active);
    setLastBuyerState(lastBuyer);
    setEndTime(end); // richtige Zahl
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

      tx.w

      await tx.wait();
      setMessage(`Karte ${cardId} erfolgreich gekauft ✅`);

    } catch (err: any) {
      console.error(err);
      setMessage(`Fehler beim Kauf ❌: ${err.message}`);
    }
  }

  async function claimPrize() {
    if (!contract) {
      alert("Bitte zuerst Wallet verbinden!");
      return;
    }
    try {
      setMessage("Claim wird gesendet... ⏳");
      const tx = await contract.claimPrize();
      await tx.wait();
      setMessage("Claim erfolgreich ✅");
      // nach claim: Status neu laden
      await updateGameStateOnce();
      // evtl. cards neu laden, weil balances sich ändern
      await loadCards();
    } catch (err: any) {
      console.error(err);
      setMessage(`Fehler beim Claim ❌: ${err?.message || err}`);
    }
  }

  async function resetGameUI() {
    if (!contract) {
      alert("Bitte zuerst Wallet verbinden!");
      return;
    }
    try {
      setMessage("Reset wird gesendet... ⏳");
      const tx = await contract.resetGame();
      await tx.wait();
      setMessage("Game zurückgesetzt ✅");
      await updateGameStateOnce();
      await loadCards();
    } catch (err: any) {
      console.error(err);
      setMessage(`Fehler beim Reset ❌: ${err?.message || err}`);
    }
  }

  useEffect(() => {
    if (!contract) return;

    loadCards();
    updateGameStateOnce();

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

      // ⏳ Timer mit neuem Endzeitpunkt aktualisieren
      setEndTime(Number(newEndTime)); // Timer sofort auf neue Zeit synchronisieren

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

  // ⏱ Stabiler Countdown basierend auf endTime (unabhängig vom Browser-Fokus)
  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor(endTime - Date.now() / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  useEffect(() => {
    checkWalletConnection().then(account => {
      if (account) {
        connectWallet();
      }
    });
  }, []);

  // Account Changed
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setMessage(`Account gewechselt`);
      
      if (accounts.length === 0) {
        // Nutzer hat alle Accounts getrennt
        setAccount(null);
        setContract(null);
        setMessage("Wallet getrennt");
      } else {
        connectWallet();
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return ( 
  
    <ChakraProvider value={defaultSystem}> 
      <Box minH="100vh" bg="gray.900" color="white" p={6} textAlign="center">

        {/* Header */}
        <Heading as="h1" size="2xl" mb={4}>
          🃏 Card Timer Game
        </Heading>

        {/* Wallet verbinden Button */}
        <Button bg="blue.500" color="white" _hover={{ bg: "blue.600" }} onClick={connectWallet} mb={4}>
          {account ? `Verbunden: ${account.slice(0, 6)}...` : "Mit MetaMask verbinden"}
        </Button>

        {/* Spielstatus-Button */}
        <Box mb={4}>
          <Button bg="green.500" color="white" _hover={{ bg: "green.600" }} onClick={testContract}>
            Spielstatus abrufen
          </Button>
        </Box>

        {/* Message-Anzeige */}
        <Box mb={6} whiteSpace="pre-wrap">
          {message}
        </Box>

        {/* Globaler Spiel-Status / Timer / Claim / Reset */}
        <Box mb={6} textAlign="center">
          {gameActiveState === null ? (
            <Text>Lade Spielstatus...</Text>
          ) : gameActiveState ? (
            timeLeft !== null && timeLeft > 0 ? (
              // Timer läuft
              <Box>
                <Text fontSize="lg" fontWeight="semibold" color="blue.300">
                  Runde läuft — Zeit verbleibend:
                </Text>
                <Heading size="md" mt={2} color="blue.200">
                  {String(Math.floor((timeLeft || 0) / 60)).padStart(2, "0")}:
                  {String((timeLeft || 0) % 60).padStart(2, "0")}
                </Heading>
                <Text fontSize="sm" color="gray.400" mt={1}>
                  Letzter Käufer: {lastBuyerState ? `${lastBuyerState.slice(0, 6)}...` : "—"}
                </Text>
              </Box>
            ) : (
              // Runde abgelaufen -> Claim möglich
              <Box>
                <Text fontSize="lg" fontWeight="semibold" color="yellow.300">
                  Runde abgelaufen — Claim verfügbar
                </Text>
                <Text fontSize="sm" color="gray.400" mt={1}>
                  Gewinner (letzter Käufer): {lastBuyerState ? `${lastBuyerState}` : "—"}
                </Text>
                <Button bg="yellow.500" color="white" mt={3} size="lg" fontWeight="bold" _hover={{ bg: "yellow.600" }} onClick={claimPrize}>
                  💰 Claim Prize
                </Button>
              </Box>
            )
          ) : (
            // Spiel inaktiv -> Reset möglich
            <Box>
              <Text fontSize="lg" fontWeight="semibold" color="red.300">
                Keine aktive Runde
              </Text>
              <Text fontSize="sm" color="gray.400" mt={1}>
                Wenn Runde bereits geclaimed wurde, kannst du das Spiel zurücksetzen.
              </Text>
              <Button
                bg="red.500" mt={3} size="lg" fontWeight="bold" _hover={{ bg: "red.600" }} onClick={resetGameUI}>
                🔄 Reset Game
              </Button>
            </Box>
          )}
        </Box>

        {/* Karten-Grid */}
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 6 }} gap={8} justifyItems="center">
          {cards.map((card) => (
            <AnimatedCard key={card.id}>
              <Text fontSize="4xl">🃏</Text>
              <Heading size="md" mt={2}>
                Karte {card.id + 1}
              </Heading>
              <Box textAlign="center" fontSize="md" mt={3}>
                <Text display="flex" alignItems="center" justifyContent="center">
                  <Icon as={FaEthereum} color="teal.300" mr={2} />
                  {card.price} ETH
                </Text>
                <Text display="flex" alignItems="center" justifyContent="center" mt={1}>
                  <Icon as={FaClock} color="yellow.400" mr={2} />
                  {card.duration} min
                </Text>
                <Text color="gray.400" mt={2}>
                  👤 Besitzer: {card.owner ? card.owner.slice(0, 6) + "..." : "Noch frei"}
                </Text>
              </Box>

              <Button
                mt={3}
                colorScheme="purple"
                size="sm"
                width="100%"
                onClick={() => buyCard(card.id, card.price)}
              >
                Kaufen 💰
              </Button>
            </AnimatedCard>
          ))}
        </SimpleGrid>

      </Box>
    </ChakraProvider>

  );
}

export default App;
