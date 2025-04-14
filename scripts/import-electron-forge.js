#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Importing project into Electron Forge...');

try {
  // Run the import command
  execSync('npx electron-forge import', { stdio: 'inherit' });
  
  console.log('✅ Successfully imported project into Electron Forge!');
  
  // Make sure we have the forge.config.js file
  const forgeConfigPath = path.join(__dirname, '../forge.config.js');
  if (!fs.existsSync(forgeConfigPath)) {
    console.log('⚠️ forge.config.js not found, creating basic config...');
    
    // Create a basic forge config
    const basicForgeConfig = `module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [
      "assets/main",
      "assets/bin",
      "assets/models/whisper",
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        background: './assets/dmg-background.png',
        format: 'ULFO'
      }
    }
  ],
};`;
    
    fs.writeFileSync(forgeConfigPath, basicForgeConfig);
    console.log('✅ Created forge.config.js');
  }
  
  console.log('🎉 Setup complete! You can now run:');
  console.log('  npm run dev     - to start the development server');
  console.log('  npm run package - to package the app');
  console.log('  npm run make    - to build distributables');

} catch (error) {
  console.error('❌ Error importing project into Electron Forge:', error);
  process.exit(1);
}