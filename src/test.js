import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

async function testGemini() {
  try {
    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Pick a generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Test prompt
    const prompt = "Say hello in one line.";

    const result = await model.generateContent(prompt);

    console.log("Gemini response:", result.response.text());
  } catch (err) {
    console.error("Error calling Gemini:", err);
  }
}

testGemini();
