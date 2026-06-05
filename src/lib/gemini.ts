import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
  );
}

export const MODEL = "gemini-2.5-flash";

// Configured Gemini client (server-side only).
export const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Calls Gemini in JSON mode and returns the parsed object.
 *
 * @param systemInstruction High-level instructions describing the task and the
 *   expected JSON shape.
 * @param userText The user-provided content to process.
 * @returns The parsed JSON object returned by the model.
 * @throws If the request fails or the response is not valid JSON.
 */
export async function generateJSON(
  systemInstruction: string,
  userText: string,
): Promise<unknown> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userText);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Gemini did not return valid JSON. Raw response: ${text}`,
    );
  }
}

export type ChatMessage = {
  role: "user" | "model";
  text: string;
};

/**
 * Calls Gemini in plain-text mode with a system instruction and a multi-turn
 * message history, returning the reply text.
 *
 * @param systemInstruction Instructions + any context to ground the reply.
 * @param messages The conversation so far (must start with a "user" turn).
 * @returns The model's reply as plain text.
 * @throws If the request fails.
 */
export async function generateText(
  systemInstruction: string,
  messages: ChatMessage[],
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
  });

  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const result = await model.generateContent({ contents });
    return result.response.text();
  } catch (err) {
    throw new Error(
      `Gemini text generation failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
