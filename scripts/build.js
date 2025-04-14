#!/usr/bin/env node
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Directory paths
const srcDir = path.join(__dirname, '../src');
const distDir = path.join(__dirname, '../dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy static files to dist directory
const copyStaticFiles = () => {
  // Copy index.html with modified script tag
  const sourceHtml = path.join(srcDir, 'index.html');
  const targetHtml = path.join(distDir, 'index.html');
  
  let htmlContent = fs.readFileSync(sourceHtml, 'utf8');
  
  // Replace the script reference to use the bundled renderer file
  htmlContent = htmlContent.replace(
    '<script src="../dist/renderer.js"></script>',
    '<script defer src="./renderer.bundle.js"></script>'
  );
  
  fs.writeFileSync(targetHtml, htmlContent);
  
  // Copy CSS file
  const sourceCss = path.join(srcDir, 'styles.css');
  const targetCss = path.join(distDir, 'styles.css');
  
  fs.copyFileSync(sourceCss, targetCss);
  
  // Copy capture-page directory
  const sourceCaptureDir = path.join(srcDir, 'capture-page');
  const targetCaptureDir = path.join(distDir, 'capture-page');
  
  // Ensure the target directory exists
  if (!fs.existsSync(targetCaptureDir)) {
    fs.mkdirSync(targetCaptureDir, { recursive: true });
  }
  
  // Copy all files from capture-page directory
  const capturePageFiles = fs.readdirSync(sourceCaptureDir);
  for (const file of capturePageFiles) {
    const sourceFile = path.join(sourceCaptureDir, file);
    const targetFile = path.join(targetCaptureDir, file);
    
    // Skip if it's a directory (we only need to copy files)
    if (fs.statSync(sourceFile).isDirectory()) continue;
    
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`Copied ${file} to capture-page directory`);
  }
  
  console.log('✅ Static files copied and updated');
};

// Bundle the renderer process code with esbuild
const bundleRenderer = async () => {
  try {
    await esbuild.build({
      entryPoints: [path.join(srcDir, 'renderer.ts')],
      bundle: true,
      platform: 'browser',
      target: 'es2020',
      outfile: path.join(distDir, 'renderer.bundle.js'),
      sourcemap: true,
      format: 'iife',
      external: ['electron', 'googleapis'],
      minify: process.env.NODE_ENV === 'production'
    });
    console.log('✅ Renderer process bundled successfully');
  } catch (error) {
    console.error('❌ Error bundling renderer process:', error);
    process.exit(1);
  }
};

// Execute the build process
(async () => {
  console.log('🚀 Building application...');
  
  // First copy static files (HTML, CSS)
  copyStaticFiles();
  
  // Then bundle the renderer process
  await bundleRenderer();
  
  console.log('✨ Build completed successfully!');
})();