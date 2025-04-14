# macOS Audio Capture Native Addon

This native Node.js addon provides functionality to capture both system audio output (using ScreenCaptureKit) and microphone input simultaneously on macOS.

## Requirements

- macOS 12.3 or later (required for ScreenCaptureKit)
- Node.js 14+
- Xcode 13+ with Command Line Tools installed
- Necessary permissions granted:
  - Microphone access
  - Screen recording access

## Building

The addon is built automatically when installing the main application, but you can also build it manually:

```bash
# From the addon directory
npm install
npm run build

# OR from the project root
npm run rebuild
```

## API

The addon provides the following main functions:

### `startRecording(micDeviceID, systemAudioOutputPath, micAudioOutputPath)`

Starts capturing both system audio and microphone input.

- `micDeviceID`: String ID of the microphone device to use (use empty string for default)
- `systemAudioOutputPath`: Path where system audio will be saved (.m4a format)
- `micAudioOutputPath`: Path where microphone audio will be saved (.m4a format)
- Returns: Boolean indicating success or failure

### `stopRecording()`

Stops the current recording and finalizes the audio files.

- Returns: Boolean indicating success or failure

### `getAudioInputDevices()`

Lists available audio input devices.

- Returns: Array of objects with `id` and `name` properties

### `isScreenCaptureKitSupported()`

Checks if the current macOS version supports ScreenCaptureKit.

- Returns: Boolean indicating support status

## Implementation Details

- Uses ScreenCaptureKit for system audio capture (available on macOS 12.3+)
- Uses AVFoundation for microphone input capture
- Writes two separate audio files (system and mic) in .m4a format
- Utilizes node-addon-api (N-API) for stable ABI compatibility across Node.js versions
- Configures minimal video capture settings to reduce overhead when capturing audio

## Troubleshooting

- If permission errors occur, ensure the application has been granted the necessary permissions in System Settings > Privacy & Security (Microphone and Screen Recording)
- If the addon fails to load, check that your macOS version is 12.3 or later
- If the build fails, ensure Xcode and Command Line Tools are properly installed