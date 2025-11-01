import { useEffect, useState } from "react";
import { ethers } from "ethers";
import contractJson from "./CardTimerGame.json";
import { ChakraProvider, Box, SimpleGrid, Button, Heading, Text, defaultSystem } from "@chakra-ui/react";
import { Icon } from "@chakra-ui/react";
import { FaEthereum, FaClock } from "react-icons/fa";

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
        duration: i + 1,
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

        {/* Karten-Grid */}
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 6 }} gap={8} justifyItems="center">
          {cards.map((card) => (
            <Box
              key={card.id}
              w="200px"
              h="280px"
              bg="gray.800"
              borderRadius="xl"
              boxShadow="2xl"
              p={5}
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
              alignItems="center"
              _hover={{ transform: "scale(1.08)", boxShadow: "dark-lg" }}
              transition="all 0.2s ease"
            >
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
            </Box>
          ))}
        </SimpleGrid>

      </Box>
    </ChakraProvider>

  );
}

export default App;
