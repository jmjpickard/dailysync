# Transcription Module

This module handles audio transcription using whisper.cpp for the Daily Sync application.

## Components

1. **paths.js** - Handles resolving paths to binary executables and model files
2. **setup.js** - Provides functions to check if dependencies are properly set up

## Architecture

The transcription system uses:

- **whisper.cpp** - Fast, C++ implementation of OpenAI's Whisper model for speech recognition
- **FFmpeg** - For audio processing and mixing
- Multiple model options - From tiny to large, with English-specific and multilingual variants

## Setup Process

The transcription dependencies are set up by running:

```
npm run setup-transcription
```

This script:
1. Clones and compiles whisper.cpp
2. Downloads whisper model files
3. Downloads FFmpeg

When the app is packaged, these binaries and models are bundled in the application's resources directory.

## Models

Available whisper models:

- **tiny.en** - Fastest, lowest accuracy (English only)
- **base.en** - Fast, moderate accuracy (English only)
- **small.en** - Good balance of speed and accuracy (English only)
- **medium.en** - High accuracy, slower processing (English only)
- **large** - Highest accuracy, slowest processing (Multilingual)

The default model used is **base.en**.

## Integration Points

- **Audio Mixer** - Provides 16kHz mono WAV files optimized for whisper
- **Transcription Queue** - Manages the transcription jobs (implementation in Chunk 10)
- **UI** - Displays transcription results (implementation in Chunk 11)

## License Compliance

- whisper.cpp is released under the MIT license
- FFmpeg is used under the LGPL/GPL license
- The whisper models are subject to OpenAI's usage policies

## Technical Notes

- Whisper works best with 16kHz mono WAV audio
- On macOS, we use a universal binary that works on both Intel and Apple Silicon
- Resource paths are resolved dynamically based on whether the app is packaged or in development