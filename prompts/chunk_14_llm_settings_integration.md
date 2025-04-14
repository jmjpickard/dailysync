# Chunk 14: LLM Integration - Settings and API Calls

**Goal:** Implement the Settings UI for managing LLM API keys (Ollama, Claude, Gemini) and create the backend logic to send a transcript to the selected LLM API for summarization.

**Context:** This enables the core summarization feature by allowing users to configure their preferred LLM services and providing the mechanism to interact with their APIs.

**Requirements:**

1.  **LLM API Key Settings UI (Renderer - Settings Page):**

    - Create a dedicated "LLM" or "Summarization" section within the application's Settings page/modal (to be fully built in Chunk 16, but define the elements here).
    - Include input fields for:
      - Ollama Base URL (e.g., `http://localhost:11434`) and Model Name (e.g., `llama3`).
      - Anthropic (Claude) API Key.
      - Google (Gemini) API Key.
    - Use input type `password` for API keys.
    - Add "Save" button for this section.

2.  **Saving/Loading API Keys (Main Process & Renderer):**

    - When "Save" is clicked in the Settings UI: Send the key values via IPC to the main process (`invoke('save-llm-settings', { ollamaUrl, ollamaModel, claudeKey, geminiKey })`).
    - **Main Process Handler (`save-llm-settings`):**
      - Use the secure storage mechanism (from Chunk 12, e.g., `electron-store` or `keytar`) to save the keys/URL. Example using `electron-store`: `store.set('settings.llmApiKeys', keysObject)`.
    - **Loading:** On app startup (or when opening Settings), load saved keys using the storage mechanism and populate the Settings UI fields.

3.  **LLM API Call Logic (Main Process or dedicated module):**

    - Create an asynchronous function `generateSummary(transcriptText, serviceType, apiKeyOrUrl, modelName = null)`.
    - **Input:** Full transcript text, target service ('ollama', 'claude', 'gemini'), the corresponding key/URL, and model name (required for Ollama, optional/default for others).
    - **Logic (using `axios` or Node's `Workspace`):**
      - **Ollama:**
        - Construct the request body (e.g., `{ model: modelName, prompt: "Summarize this meeting transcript:\n\n" + transcriptText, stream: false }`).
        - Make a POST request to `ollamaUrl + '/api/generate'`.
        - Parse the response (e.g., `response.data.response`).
      - **Claude (Anthropic API):**
        - Install Anthropic SDK: `npm install @anthropic-ai/sdk`.
        - Use the SDK: `const anthropic = new Anthropic({ apiKey }); await anthropic.messages.create({ model: "claude-3-opus-20240229", max_tokens: 1024, messages: [{ role: "user", content: "Summarize this meeting transcript:\n\n" + transcriptText }] });` (Adjust model name).
        - Extract summary from response (e.g., `response.content[0].text`).
      - **Gemini (Google AI API):**
        - Install Google AI SDK: `npm install @google/generative-ai`.
        - Use the SDK: `const genAI = new GoogleGenerativeAI(apiKey); const model = genAI.getGenerativeModel({ model: "gemini-pro"}); const result = await model.generateContent("Summarize this meeting transcript:\n\n" + transcriptText); const response = await result.response; return response.text();` (Adjust model name).
      - **Error Handling:** Wrap API calls in try/catch blocks. Handle network errors, authentication errors (invalid key), rate limits, etc. Return a meaningful error message on failure.
    - Return the summary text on success or throw/return an error object on failure.

4.  **IPC Channel for Summarization:**
    - Create an IPC channel `invoke('generate-summary', eventId, serviceType)`.
    - **Main Process Handler:**
      - Retrieve the transcript for the `eventId` (either load text from file path stored in Chunk 12, or assume it's passed).
      - Load the appropriate API key/URL/model from settings (Chunk 12).
      - If key/URL is missing, return an error ("API key not configured").
      - Call the `generateSummary` function.
      - Return the result (summary text or error object) to the renderer.

**Acceptance Criteria:**

- Settings UI contains fields for Ollama URL/Model, Claude Key, Gemini Key.
- Entered keys/URL are saved securely using the local storage mechanism.
- Saved keys/URL are loaded and displayed when opening Settings.
- A function exists to make API calls to Ollama, Claude, and Gemini for summarization, handling basic request/response structure and authentication.
- API call function includes error handling for common issues.
- An IPC channel allows the renderer to request a summary for a given transcript using a specified service.

**Technologies:** Electron (Main/Renderer), Node.js, HTML, CSS, TypeScript, IPC, `electron-store`/`keytar`, `axios`/`Workspace`, `@anthropic-ai/sdk`, `@google/generative-ai`.
