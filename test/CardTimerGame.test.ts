import { network } from "hardhat";
import { expect } from "chai";

describe("CardTimerGame (Localhost)", function () {
  it("should deploy and have a valid address", async function () {
    // Verbindung zur lokalen Hardhat-Chain herstellen
    const { ethers } = await network.connect({
      network: "hardhatMainnet", // oder "hardhatOp" je nach chainType
      chainType: "l1",
    });

    // Contract holen & deployen
    const CardTimerGame = await ethers.getContractFactory("CardTimerGame");
    const game = await CardTimerGame.deploy();
    await game.waitForDeployment();

    // Adresse prüfen
    const address = await game.getAddress();
    expect(address).to.properAddress;

    console.log("✅ Contract deployed to:", address);
  });
});