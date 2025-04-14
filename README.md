# Daily Sync

A meeting assistant app for professionals to streamline daily meeting workflows.

## Features

- Google Calendar integration to display your daily meetings
- Record and transcribe meeting audio
- Take notes during meetings
- Generate summaries of meetings using AI
- Save and organize meeting information

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install the native audio capture addon:

```bash
npm run install-audio-capture
```

3. Verify transcription setup:

```bash
npm run verify-transcription
```

## Development

For development with hot-reloading:

```bash
npm run dev
```

## Building & Distribution

### Building

Build the app without packaging:

```bash
npm run build
```

### Packaging

Package the app for your current platform:

```bash
npm run package
```

### Distribution

Create distributable installers/packages:

```bash
# For all platforms
npm run make

# For specific platforms
npm run make:mac    # macOS only
npm run make:win    # Windows only
npm run make:linux  # Linux only
```

See [BUILD.md](BUILD.md) for detailed instructions on building, packaging, and distributing the app.

## Tech Stack

- Electron: Cross-platform desktop app framework
- React: UI framework
- TypeScript: Type-safe JavaScript
- Tailwind CSS: Utility-first CSS framework
- Whisper: ML model for audio transcription
- Google Calendar API: Calendar integration

## Project Structure

- `src/`: Source code
  - `main/`: Electron main process code
  - `preload/`: Preload script for secure IPC
  - `renderer/`: React application code
  - `transcription/`: Audio transcription module
  - `auth/`: Authentication module
  - `storage/`: Data storage module
  - `llm/`: LLM integration for summarization
- `native-addon/`: Native code modules
  - `audio-capture/`: Native addon for audio capture
- `assets/`: Static assets
  - `models/whisper/`: Whisper model for audio transcription
  - `bin/`: Binary executables
- `build/`: Build configuration
- `dist/`: Built renderer application
- `dist-electron/`: Built main and preload processes
- `out/`: Packaged application