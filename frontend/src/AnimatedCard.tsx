// src/AnimatedCard.tsx
import React from "react";
import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const pulseGradient = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

interface AnimatedCardProps {
  children: React.ReactNode;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children }) => (
  <Box
    position="relative"
    p="3px"
    borderRadius="xl"
    background="linear-gradient(270deg, #ff00cc, #3333ff, #00ffcc)"
    backgroundSize="400% 400%"
    animation={`${pulseGradient} 10s ease infinite`}
    w="220px"
    h="300px"
    boxShadow="2xl"
    display="flex"
    flexDirection="column"
    justifyContent="space-between"
    alignItems="center"
    _hover={{ transform: "scale(1.08)", boxShadow: "dark-lg" }}
    transition="all 0.2s ease"
  >
    <Box
      bg="gray.800"
      borderRadius="xl"
      p={4}
      height="100%"
      width="100%"
      textAlign="center"
    >
      {children}
    </Box>
  </Box>
);

export default AnimatedCard;