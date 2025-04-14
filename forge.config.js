module.exports = {
  packagerConfig: {
    asar: true,
    // Specify files that shouldn't be packed into the asar archive
    asarUnpack: [
      "node_modules/audio-capture-addon/**/*",
      "native-addon/audio-capture/bin/**/*"
    ],
    // Extra resources to include with the app
    extraResource: [
      "assets/main",
      "assets/bin",
      "assets/models/whisper"
    ],
    // Specify the correct entry points for electron-vite
    dir: ".",
    // Set the app icon
    icon: "assets/icon", // no extension needed, will pick the right one for the platform
    // Include all internal dependencies in the final package
    ignore: [
      /^\/node_modules$/,
      /^\/src$/,
      /^\/\.git$/,
      /^\/\.vscode$/,
      /^\/\.github$/,
      /^\/\.DS_Store$/,
      /^\/electron\.vite\.config\.(ts|js)$/,
      /^\/forge\.config\.js$/,
      /^\/prompts$/,
      /^\/temp_logs\.txt$/
    ],
  },
  rebuildConfig: {},
  // Specify which files are part of the app
  files: [
    "dist-electron/**/*",
    "dist/**/*",
    "package.json"
  ],
  makers: [
    // Windows installer
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Windows-specific options
        name: "DailySync",
        setupIcon: "assets/icon.ico"
      },
    },
    // macOS and Linux ZIP packages
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    // Linux Debian package
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          // Debian-specific options
          maintainer: "Daily Sync Team",
          homepage: "https://example.com"
        }
      },
    },
    // macOS DMG package
    {
      name: '@electron-forge/maker-dmg',
      config: {
        // Use ULFO format for better compatibility
        format: 'ULFO',
        // If you add a background image in the future, uncomment this line:
        // background: './assets/dmg-background.png',
        // icon: "assets/icon.icns", // Commented out as icon.icns is missing
        iconSize: 80,
        contents: [
          { x: 448, y: 344, type: 'link', path: '/Applications' },
          { x: 192, y: 344, type: 'file', path: '' } // The application itself
        ],
        window: {
          size: {
            width: 640,
            height: 480
          }
        }
      }
    }
  ],
  // Hooks can be used for custom build steps (optional)
  hooks: {
    packageAfterCopy: async (config, buildPath, electronVersion, platform, arch) => {
      console.log(`Preparing package for ${platform}-${arch}`);
      // Additional post-packaging steps could be added here
    }
  }
};