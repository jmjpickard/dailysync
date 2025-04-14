# Design Overview & Look and Feel

**Date:** 2025-04-04

## 1. High-Level Overview

- **Application Name:** (Placeholder: "Daily Sync" or "Meeting Assistant") - _Final name TBD._
- **Purpose:** To streamline the daily meeting workflow for professionals by providing a single desktop application that integrates with their Google Calendar, allows easy joining of calls, facilitates local recording and transcription of meetings, enables note-taking, and leverages LLMs for summarization.
- **Target User:** Primarily macOS users who frequently participate in virtual meetings (Zoom, Google Meet, Teams, etc.) and need an efficient way to manage meeting logistics, recall discussions, and extract key information, while keeping all data private on their local machine.
- **Core Value Proposition:**
  - **Privacy First:** All data (calendar events cache, recordings, transcripts, notes, summaries, API keys) is stored exclusively on the user's local machine.
  - **Efficiency:** Centralizes viewing the day's schedule, joining calls, recording, transcribing, and note-taking within one interface, reducing context switching.
  - **Intelligence:** Leverages local AI (Whisper.cpp) for accurate transcription and user-configured LLM APIs (Ollama, Claude, Gemini) for powerful summarization.
- **Platform Focus:** macOS (Initial Version). Designed to feel native and integrate well with the macOS environment.

## 2. Look and Feel: Functional & Clean

The overarching design goal is a **functional, clean, and unobtrusive interface** that prioritizes clarity, efficiency, and ease of use. It should feel like a native macOS utility rather than a heavily styled web app.

- **Design Philosophy:**

  - **Minimalist:** Avoid visual clutter, unnecessary decoration, or complex animations. Every element should serve a purpose.
  - **Task-Oriented:** The design should make the primary tasks (viewing schedule, selecting meeting, joining, recording, accessing notes/transcript) intuitive and require minimal clicks.
  - **Low Cognitive Load:** Present information clearly and concisely. Use familiar patterns and predictable layouts.

- **Layout:**

  - **Stable Structure:** Adhere to the defined three-pane layout (Navigation/Calendar | Daily Schedule List | Meeting Details). This provides spatial consistency.
  - **Whitespace:** Utilize ample whitespace to separate elements, improve readability, and create a sense of calm. Avoid cramped interfaces.
  - **Alignment & Padding:** Maintain strict alignment and consistent padding/margins throughout the application for a polished and organized look. Follow standard macOS spacing guidelines where applicable.

- **Color Palette:**

  - **Mode:** Default to a standard macOS **Light Mode** appearance. A **Dark Mode** option is a desirable future enhancement but not essential for V1.
  - **Base:** Neutral base colors (whites, light grays - matching standard macOS window/control backgrounds).
  - **Accent:** A single, muted accent color (e.g., standard macOS blue, or a subtle teal/graphite) for interactive elements like selected items, buttons (optional, could use standard macOS buttons), focus indicators, and links.
  - **Status:** Use color sparingly and purposefully for status:
    - Subtle Red: Recording active indicator, critical errors.
    - Amber/Yellow: Warnings, pending states.
    - Green/Blue: Success indicators (optional, often absence of error is enough).

- **Typography:**

  - **Font:** Use the **system font (San Francisco)** exclusively for a native macOS feel and optimal legibility at all sizes.
  - **Hierarchy:** Establish clear visual hierarchy using font weight (e.g., Medium/Semibold for titles, Regular for body) and size variations. Keep the number of different styles minimal.
  - **Readability:** Ensure comfortable line spacing (leading) and line length, especially within the Notes and Transcript display areas.

- **Iconography:**

  - **Style:** Use **SF Symbols** where possible for native consistency, or a clean, simple, line-based icon set (e.g., Lucide, Feather Icons). Avoid overly detailed or illustrative icons.
  - **Usage:** Employ icons purposefully for:
    - Action Buttons (Join, Record, Settings gear, Retry, Copy).
    - Status Indicators (Recording dot, meeting link presence, error/warning symbols).
    - Navigation (Previous/Next day arrows).
    - Make sure icons have clear associated labels or tooltips if their meaning isn't universally obvious.

- **Interactivity & Feedback:**

  - **Standard Controls:** Utilize standard macOS controls (buttons, text inputs, dropdowns) where feasible to leverage built-in accessibility and user familiarity.
  - **States:** Provide clear visual feedback for element states:
    - Hover: Subtle background change or underline.
    - Focus: Standard macOS focus ring.
    - Selected: Accent color background or border.
    - Disabled: Reduced opacity, non-interactive appearance.
  - **Loading:** Use non-intrusive indicators: subtle spinners (perhaps replacing an icon temporarily), progress bars within the relevant section (e.g., transcription progress). Avoid full-screen overlays for short operations.

- **"Functional" Principles:**

  - **Information Clarity:** Display the most important information prominently. Less critical details (e.g., full attendee list) can be initially collapsed or subtly presented.
  - **Action Accessibility:** Key actions for the selected meeting (Join, Record) should be immediately visible and clickable in the Detail Pane.
  - **Effortless Navigation:** Switching between days or viewing different meetings should feel fluid and immediate.

- **"Clean" Principles:**

  - **Simplicity:** Avoid gradients, drop shadows (beyond standard window shadows), excessive borders, background images, or textures. Flat design principles are generally preferred.
  - **Consistency:** Apply styling (colors, fonts, spacing, component appearance) uniformly across all parts of the application, including the Settings window.

- **Inspiration (macOS):** Draw inspiration from well-regarded functional and clean macOS applications like Things, Fantastical (clean themes), Bear, Ulysses, and Apple's native Calendar, Notes, and Reminders applications. Focus on their clarity, structure, and integration with system conventions.
