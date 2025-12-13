import { GoogleGenAI } from "@google/genai";
import { GameState, Snake } from '../types';

let genAI: GoogleGenAI | null = null;

export const initGemini = () => {
  if (process.env.API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("Gemini API Key missing");
  }
};

export const generateCommentary = async (gameState: GameState): Promise<string> => {
  if (!genAI) return "Commentator mic is off (Check API Key).";

  const s1 = gameState.snakes[0];
  const s2 = gameState.snakes[1];

  const prompt = `
    You are an extremely hyped, fast-talking e-sports commentator for "Neon Snake Rivals".
    
    Current Match Status:
    - ${s1.name} (Cyan): Score ${s1.score}, Status: ${s1.eliminated ? 'ELIMINATED' : 'ALIVE'}
    - ${s2.name} (Magenta): Score ${s2.score}, Status: ${s2.eliminated ? 'ELIMINATED' : 'ALIVE'}
    - Winner: ${gameState.winner ? gameState.winner : 'None yet'}
    
    The game is happening right now on a grid.
    Describe the situation in ONE short, punchy sentence (max 20 words).
    Focus on who is winning, near misses, or aggressive moves.
    If a snake is eliminated, go wild.
    Do not mention coordinates. Use names "Cyan Viper" and "Magenta Python".
  `;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini commentary failed:", error);
    return "The crowd is holding its breath...";
  }
};
