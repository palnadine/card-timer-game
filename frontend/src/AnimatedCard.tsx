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
    animation={`${pulseGradient} 5s ease infinite`}
    w="220px"
    h="300px"
    transition="transform 0.3s ease, box-shadow 0.3s ease"
    _hover={{
      transform: "scale(1.06)",
      boxShadow: "0 0 25px rgba(255, 0, 204, 0.5)",
    }}
  >
    <Box
      bg="gray.800"
      borderRadius="xl"
      h="100%"
      w="100%"
      p={5}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      alignItems="center"
      boxShadow="xl"
      transition="background 0.3s ease, box-shadow 0.3s ease"
      _hover={{
        boxShadow: "0 0 20px rgba(0, 255, 255, 0.4)",
      }}
    >
      {children}
    </Box>
  </Box>
);

export default AnimatedCard;