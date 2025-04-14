# Building Daily Sync

This document explains how to build, package, and distribute Daily Sync.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- For macOS builds: Xcode Command Line Tools
- For Windows builds: Visual Studio Build Tools with Windows SDK

## Development

Run the app in development mode:

```bash
npm run dev
```

## Building

Build the app without packaging:

```bash
npm run build
```

This will:
1. Compile all TypeScript code
2. Bundle the renderer with Vite
3. Create the main and preload bundles
4. Verify the transcription setup

## Packaging

Package the app for your current platform:

```bash
npm run package
```

This will create an unpacked app in the `out` directory.

## Distribution

Create distributable installers/packages:

```bash
# For all platforms
npm run make

# For specific platforms
npm run make:mac    # macOS only
npm run make:win    # Windows only
npm run make:linux  # Linux only
```

Distributable files will be created in the `out/make` directory.

## Configuration

### Forge Configuration

The packaging and distribution configuration is defined in `forge.config.js`. This file includes:

- packagerConfig: Defines how the app is packaged, including:
  - asar: Whether to package app source code into an archive
  - asarUnpack: Files that shouldn't be in the asar archive (native modules)
  - extraResource: Additional files to include with the app
  - icon: The app icon

- makers: Defines the distribution formats to create:
  - maker-squirrel: Windows installer
  - maker-zip: ZIP archives for macOS and Linux
  - maker-deb: Debian package for Linux
  - maker-dmg: macOS disk image

### Electron Vite Configuration

The bundling configuration is defined in `electron.vite.config.ts`. This includes:

- main: Configuration for the main process
- preload: Configuration for the preload script
- renderer: Configuration for the renderer process (React application)

## Code Signing

### macOS Code Signing

For macOS distribution, you need to sign the app with an Apple Developer ID:

1. Get an Apple Developer ID certificate
2. Set the following environment variables:
   ```
   export CSC_IDENTITY_AUTO_DISCOVERY=true
   export APPLE_ID=your_apple_id@example.com
   export APPLE_ID_PASSWORD=your_app_specific_password
   ```
3. Use the `--sign` option with Electron Forge:
   ```
   npm run make:mac -- --sign
   ```

### Windows Code Signing

For Windows distribution, you need a code signing certificate:

1. Get a Windows code signing certificate
2. Set the following environment variables:
   ```
   set CSC_LINK=path/to/certificate.pfx
   set CSC_KEY_PASSWORD=your_certificate_password
   ```
3. Use the `--sign` option with Electron Forge:
   ```
   npm run make:win -- --sign
   ```

## Troubleshooting

### Native Addons

If you have issues with the native audio-capture addon:

1. Rebuild the addon:
   ```
   npm run install-audio-capture
   npm run rebuild
   ```

2. Verify the audio-capture addon was properly built:
   ```
   cd native-addon/audio-capture
   npm test
   ```

### Audio Transcription

If you have issues with the audio transcription:

1. Verify the transcription setup:
   ```
   npm run verify-transcription
   ```

2. Make sure the Whisper model file is in the correct location:
   ```
   assets/models/whisper/ggml-base.en.bin
   ```