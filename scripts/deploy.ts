import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "sepolia",
  chainType: "l1",
});

async function main() {

  const CardTimerGame = await ethers.getContractFactory("CardTimerGame");
  const game = await CardTimerGame.deploy();
  await game.waitForDeployment();

  console.log(`Contract deployed at: ${await game.getAddress()}`);
}

main().catch(console.error);
