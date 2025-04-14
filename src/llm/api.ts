/**
 * LLM API Module
 *
 * This module provides functions to interact with various LLM APIs for generating summaries
 * of meeting transcripts. It supports Ollama, Claude (Anthropic), and Gemini (Google AI).
 */

import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadSetting } from "../storage/store";

// Types
export type LLMService = "ollama" | "claude" | "gemini";

export interface LLMSettings {
  ollamaUrl: string;
  ollamaModel: string;
  claudeKey: string;
  geminiKey: string;
}

/**
 * Generate a summary of a transcript using the specified LLM service
 * @param transcriptText The transcript text to summarize
 * @param serviceType The LLM service to use ('ollama', 'claude', 'gemini')
 * @param apiKeyOrUrl The API key or URL for the service
 * @param modelName Optional model name to use (required for Ollama)
 * @returns The generated summary text
 */
export async function generateSummary(
  transcriptText: string,
  serviceType: LLMService,
  apiKeyOrUrl: string,
  modelName: string | null = null
): Promise<string> {
  try {
    let summary: string;

    // Basic input validation
    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new Error("No transcript text provided");
    }

    if (!apiKeyOrUrl || apiKeyOrUrl.trim().length === 0) {
      throw new Error(
        `No ${
          serviceType === "ollama" ? "URL" : "API key"
        } provided for ${serviceType}`
      );
    }

    // Create prompt with consistent instructions
    const basePrompt =
      "Summarize this meeting transcript in a concise way, including the key topics discussed, decisions made, and any action items:\n\n";
    const fullPrompt = basePrompt + transcriptText;

    // Call the appropriate API based on the service type
    switch (serviceType) {
      case "ollama": {
        if (!modelName) {
          throw new Error("Model name is required for Ollama");
        }

        // Ensure URL doesn't have trailing slash
        const baseUrl = apiKeyOrUrl.endsWith("/")
          ? apiKeyOrUrl.slice(0, -1)
          : apiKeyOrUrl;

        // Construct request for Ollama
        const response = await axios.post(`${baseUrl}/api/generate`, {
          model: modelName,
          prompt: fullPrompt,
          stream: false,
        });

        summary = response.data.response;
        break;
      }

      case "claude": {
        // Use Anthropic SDK
        const anthropic = new Anthropic({ apiKey: apiKeyOrUrl });

        const response = await anthropic.messages.create({
          model: "claude-3-opus-20240229", // Using a default model
          max_tokens: 1024,
          messages: [{ role: "user", content: fullPrompt }],
        });

        summary =
          typeof response.content[0] === "object" &&
          "text" in response.content[0]
            ? response.content[0].text
            : JSON.stringify(response.content[0]); // Fallback if it's not a text block
        break;
      }

      case "gemini": {
        // Use Google AI SDK
        const genAI = new GoogleGenerativeAI(apiKeyOrUrl);
        // Updated to use the correct model name for Gemini API v1
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const result = await model.generateContent(fullPrompt);
        summary = result.response.text();
        break;
      }

      default:
        throw new Error(`Unsupported LLM service: ${serviceType}`);
    }

    // Return the summary
    return summary;
  } catch (error: any) {
    console.error(`Error generating summary with ${serviceType}:`, error);

    // Handle specific API error types
    if (error.response) {
      // API responded with an error status code
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401 || status === 403) {
        throw new Error(
          `Authentication error: Invalid ${
            serviceType === "ollama" ? "configuration" : "API key"
          }`
        );
      } else if (status === 429) {
        throw new Error(`Rate limit exceeded for ${serviceType} API`);
      } else {
        throw new Error(
          `${serviceType} API error (${status}): ${JSON.stringify(data)}`
        );
      }
    } else if (error.request) {
      // Request was made but no response received
      throw new Error(
        `No response from ${serviceType} API. Please check your network connection and the API endpoint.`
      );
    }

    // Re-throw the original error with additional context
    throw new Error(
      `Failed to generate summary with ${serviceType}: ${error.message}`
    );
  }
}

/**
 * Convenience function to generate a summary using settings from storage
 * @param transcriptText The transcript text to summarize
 * @param serviceType The LLM service to use
 * @returns The generated summary text
 */
export async function generateSummaryWithStoredSettings(
  transcriptText: string,
  serviceType: LLMService
): Promise<string> {
  // Load the necessary settings based on the service type
  switch (serviceType) {
    case "ollama": {
      const ollamaUrl = loadSetting("llmApiKeys.ollama", "");
      const ollamaModel = loadSetting("ollamaModel", "llama3");

      if (!ollamaUrl) {
        throw new Error(
          "Ollama URL not configured. Please set it in the Settings."
        );
      }

      return generateSummary(
        transcriptText,
        serviceType,
        ollamaUrl,
        ollamaModel
      );
    }

    case "claude": {
      const claudeKey = loadSetting("llmApiKeys.claude", "");

      if (!claudeKey) {
        throw new Error(
          "Claude API key not configured. Please set it in the Settings."
        );
      }

      return generateSummary(transcriptText, serviceType, claudeKey);
    }

    case "gemini": {
      const geminiKey = loadSetting("llmApiKeys.gemini", "");

      if (!geminiKey) {
        throw new Error(
          "Gemini API key not configured. Please set it in the Settings."
        );
      }

      return generateSummary(transcriptText, serviceType, geminiKey);
    }

    default:
      throw new Error(`Unsupported LLM service: ${serviceType}`);
  }
}
