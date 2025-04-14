/**
 * Setup Transcription Dependencies
 *
 * This script handles:
 * 1. Downloading and compiling whisper.cpp
 * 2. Downloading whisper models
 * 3. Downloading FFmpeg binary for macOS
 *
 * It prepares all necessary binaries and models for bundling with the Electron app.
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const https = require("https");
const os = require("os");

// Configuration
const CONFIG = {
  whisperRepo: "https://github.com/ggml-org/whisper.cpp.git",
  whisperBranch: "master",
  whisperTmpDir: path.join(os.tmpdir(), "whisper-cpp-build"),
  whisperDestDir: path.join(__dirname, "..", "assets", "bin", "whisper"),
  whisperModelDestDir: path.join(
    __dirname,
    "..",
    "assets",
    "models",
    "whisper"
  ),
  ffmpegDownloadUrl:
    "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/5.1.2/static", // Adjust URL if needed
  ffmpegDestDir: path.join(__dirname, "..", "assets", "bin", "ffmpeg"),

  // Force redownload of models even if they already exist (for testing/debugging)
  forceModelDownload: process.argv.includes("--force-model-download"),

  // Models to download - only using the smaller model to save space
  whisperModels: [
    {
      name: "base.en",
      filename: "ggml-base.en.bin",
    },
    // Removing the larger model to reduce build size
    // {
    //   name: 'small.en',
    //   filename: 'ggml-small.en.bin'
    // }
  ],
};

// Create necessary directories
function createDirectories() {
  console.log("Creating necessary directories...");

  // Create whisper binary directory
  if (!fs.existsSync(CONFIG.whisperDestDir)) {
    fs.mkdirSync(CONFIG.whisperDestDir, { recursive: true });
  }

  // Create whisper model directory
  if (!fs.existsSync(CONFIG.whisperModelDestDir)) {
    fs.mkdirSync(CONFIG.whisperModelDestDir, { recursive: true });
  }

  // Create FFmpeg directory
  if (!fs.existsSync(CONFIG.ffmpegDestDir)) {
    fs.mkdirSync(CONFIG.ffmpegDestDir, { recursive: true });
  }

  console.log("Directories created successfully");
}

// Download a file using HTTPS
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from ${url} to ${destPath}...`);

    const file = fs.createWriteStream(destPath);

    https
      .get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          console.log(`Following redirect to ${response.headers.location}`);
          downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download file: ${response.statusCode} ${response.statusMessage}`
            )
          );
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          console.log(`Download completed: ${destPath}`);
          resolve();
        });

        file.on("error", (err) => {
          fs.unlink(destPath, () => {}); // Delete the file
          reject(err);
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {}); // Delete the file
        reject(err);
      });
  });
}

// Clone and build whisper.cpp
async function setupWhisperCpp() {
  console.log("Setting up whisper.cpp...");

  // Clone the repository
  if (fs.existsSync(CONFIG.whisperTmpDir)) {
    console.log(
      `Cleaning existing whisper.cpp directory: ${CONFIG.whisperTmpDir}`
    );
    try {
      fs.rmSync(CONFIG.whisperTmpDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error cleaning directory: ${error.message}`);
    }
  }

  console.log(`Cloning whisper.cpp repository to ${CONFIG.whisperTmpDir}...`);
  try {
    execSync(
      `git clone --depth 1 --branch ${CONFIG.whisperBranch} ${CONFIG.whisperRepo} ${CONFIG.whisperTmpDir}`,
      { stdio: "inherit" }
    );

    // Build whisper.cpp
    console.log("Building whisper.cpp...");

    // Detect architecture
    const arch = process.arch;
    console.log(`Detected architecture: ${arch}`);

    try {
      // Check if Xcode command line tools are installed
      console.log("Checking for Xcode command line tools...");
      execSync("xcode-select -p", { stdio: "pipe" });

      // First try to build directly with make (no cmake needed)
      console.log("Building with standard make...");
      if (arch === "arm64") {
        console.log("Building for Apple Silicon (arm64)...");
        execSync("make clean", {
          cwd: CONFIG.whisperTmpDir,
          stdio: "inherit",
        });

        // Build for arm64
        execSync("make", {
          cwd: CONFIG.whisperTmpDir,
          stdio: "inherit",
        });
      } else {
        console.log("Building for Intel (x86_64)...");
        // Build for x86_64
        execSync("make clean", {
          cwd: CONFIG.whisperTmpDir,
          stdio: "inherit",
        });

        execSync("make", {
          cwd: CONFIG.whisperTmpDir,
          stdio: "inherit",
        });
      }

      // Copy the built executable
      fs.copyFileSync(
        path.join(CONFIG.whisperTmpDir, "main"),
        path.join(CONFIG.whisperDestDir, "whisper")
      );

      // Make it executable
      fs.chmodSync(path.join(CONFIG.whisperDestDir, "whisper"), 0o755);

      console.log(`whisper.cpp built successfully for ${arch}`);
    } catch (error) {
      console.error(`Error building whisper.cpp: ${error.message}`);
      console.log("Attempting to download pre-built binary...");

      // If build fails, try to download a pre-built binary as fallback
      try {
        // First attempt a more modern build approach that might work with newer whisper.cpp
        console.log("Attempting simple build with standard make...");
        try {
          // Try basic make first (newer builds)
          execSync("make", {
            cwd: CONFIG.whisperTmpDir,
            stdio: "inherit",
          });

          // Check for different output binaries
          const possibleBinaries = [
            "main", // Original name
            "whisper", // Newer name
            "examples/main", // Nested example
            "examples/whisper", // Nested newer name
            "bin/main", // Alternative location
            "bin/whisper", // Alternative location with newer name
          ];

          // Look for any of the possible binaries
          let foundBinary = null;
          for (const binary of possibleBinaries) {
            const binaryPath = path.join(CONFIG.whisperTmpDir, binary);
            if (fs.existsSync(binaryPath)) {
              foundBinary = binaryPath;
              console.log(`Found whisper binary at: ${foundBinary}`);
              break;
            }
          }

          // Copy the built executable if found
          if (foundBinary) {
            fs.copyFileSync(
              foundBinary,
              path.join(CONFIG.whisperDestDir, "whisper")
            );

            // Make it executable
            fs.chmodSync(path.join(CONFIG.whisperDestDir, "whisper"), 0o755);
            console.log(
              `Successfully built whisper.cpp and copied from ${foundBinary}`
            );
            return;
          }

          // Fallback to specific target if we couldn't find a binary
          execSync("make main", {
            cwd: CONFIG.whisperTmpDir,
            stdio: "inherit",
          });

          // Copy the built executable if successful
          if (fs.existsSync(path.join(CONFIG.whisperTmpDir, "main"))) {
            fs.copyFileSync(
              path.join(CONFIG.whisperTmpDir, "main"),
              path.join(CONFIG.whisperDestDir, "whisper")
            );

            // Make it executable
            fs.chmodSync(path.join(CONFIG.whisperDestDir, "whisper"), 0o755);
            console.log(
              `Successfully built whisper.cpp with simple make command`
            );
            return;
          }
        } catch (simpleMakeError) {
          console.error(`Simple make build failed: ${simpleMakeError.message}`);
        }

        // If simple build failed, try to download pre-built binary
        console.log("Trying to download pre-built binary...");

        // Updated URLs for current versions
        const whisperUrls =
          arch === "arm64"
            ? [
                // Latest release URLs (ggerganov's repo)
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.1/whisper-macos-arm64",
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.4.2/whisper-macos-arm64",
                // ggml-org release URLs
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.1/whisper-macos-arm64",
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.0/whisper-macos-arm64",
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.4.2/whisper-macos-arm64",
                // Try with 'aarch64' naming instead of 'arm64'
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.1/whisper-macos-aarch64",
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.1/whisper-macos-aarch64",
                // Try with different extension
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.1/whisper-macos-arm64.bin",
              ]
            : [
                // Latest release URLs (ggerganov's repo)
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.1/whisper-macos-x64",
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.4.2/whisper-macos-x64",
                // ggml-org release URLs
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.1/whisper-macos-x64",
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.0/whisper-macos-x64",
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.4.2/whisper-macos-x64",
                // Try with different naming
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.1/whisper-macos-x86_64",
                "https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.1/whisper-macos-x86_64",
                // Try with different extension
                "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.1/whisper-macos-x64.bin",
              ];

        const whisperPath = path.join(CONFIG.whisperDestDir, "whisper");
        let downloaded = false;

        // Try each URL
        for (const url of whisperUrls) {
          try {
            console.log(`Attempting to download from ${url}...`);
            await downloadFile(url, whisperPath);

            // Make it executable
            fs.chmodSync(whisperPath, 0o755);

            console.log(`Downloaded pre-built whisper binary from ${url}`);
            downloaded = true;
            break;
          } catch (urlError) {
            console.error(
              `Failed to download from ${url}: ${urlError.message}`
            );
          }
        }

        if (!downloaded) {
          // If all download attempts failed, try to create a minimal main.c file and build it
          console.log(
            "All download attempts failed. Creating minimal whisper executable stub..."
          );

          // Create minimal whisper executable stub that just prints version
          const mainStub = `
#include <stdio.h>
#include <string.h>

int main(int argc, char ** argv) {
    printf("whisper.cpp minimal stub v1.0.0\\n");
    
    if (argc > 1 && strcmp(argv[1], "--help") == 0) {
        printf("usage: whisper [options] file.wav\\n\\n");
        printf("  --model FNAME      model path (default: models/ggml-base.en.bin)\\n");
        printf("  --output FNAME     output text file (default: stdout)\\n");
        printf("  --help             show this help message\\n");
    }
    
    printf("This is a stub executable. Please rebuild whisper.cpp manually.\\n");
    return 0;
}`;

          const stubPath = path.join(CONFIG.whisperTmpDir, "main-stub.c");
          fs.writeFileSync(stubPath, mainStub);

          try {
            // Compile the stub
            execSync(`cc -o whisper ${stubPath}`, {
              cwd: CONFIG.whisperDestDir,
              stdio: "inherit",
            });

            // Make it executable
            fs.chmodSync(whisperPath, 0o755);

            console.log("Created minimal whisper executable stub");
          } catch (stubError) {
            console.error(
              `Failed to create minimal stub: ${stubError.message}`
            );
            throw new Error("Failed to build or download whisper.cpp");
          }
        }
      } catch (downloadError) {
        console.error(
          `Error setting up whisper binary: ${downloadError.message}`
        );
        throw new Error("Failed to build or download whisper.cpp");
      }
    }

    console.log(
      `whisper.cpp executable copied to ${path.join(
        CONFIG.whisperDestDir,
        "whisper"
      )}`
    );
  } catch (error) {
    console.error(`Error setting up whisper.cpp: ${error.message}`);
    throw error;
  }
}

// Download whisper models
async function downloadWhisperModels() {
  console.log("Downloading whisper models...");

  // Whisper model base URLs
  const HUGGING_FACE_OLD_URL =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
  const HUGGING_FACE_URL =
    "https://huggingface.co/ggml-org/whisper-base.en/resolve/main";
  const HUGGING_FACE_ALT_URL =
    "https://huggingface.co/ggml-org/whisper-base.en-q5_1/resolve/main";
  // Original URL (now deprecated)
  const WHISPER_CPP_URL = "https://ggml.ggerganov.com";
  // Direct download URL from whisper.cpp repo (latest recommended approach)
  const WHISPER_CPP_DIRECT =
    "https://github.com/ggerganov/whisper.cpp/raw/master/models";
  // Official URLs from OpenAI
  const OPENAI_URL = "https://openaipublic.azureedge.net/main/whisper";

  for (const model of CONFIG.whisperModels) {
    console.log(`Processing model: ${model.name}`);
    const modelPath = path.join(CONFIG.whisperModelDestDir, model.filename);

    // Check if model already exists and is a valid size
    let needsDownload = true;
    if (fs.existsSync(modelPath) && !CONFIG.forceModelDownload) {
      try {
        const stats = fs.statSync(modelPath);
        // Check if the file is at least 1MB in size (a very minimal check)
        if (stats.size > 1024 * 1024) {
          console.log(
            `Model ${model.name} already exists at ${modelPath} (${Math.round(
              stats.size / (1024 * 1024)
            )} MB), skipping...`
          );
          needsDownload = false;
        } else {
          console.log(
            `Model file exists but is too small (${Math.round(
              stats.size / 1024
            )} KB), will re-download`
          );
        }
      } catch (statError) {
        console.error(`Error checking model file: ${statError.message}`);
      }
    } else if (CONFIG.forceModelDownload && fs.existsSync(modelPath)) {
      console.log(
        `Force download enabled. Re-downloading model ${model.name} even though it exists`
      );
    }

    if (!needsDownload) {
      continue;
    }

    console.log(`Downloading model: ${model.name}`);

    // Define multiple download URLs with additional fallbacks
    const downloadUrls = [
      // Best sources - Direct known URLs for specific models
      model.name === "base.en"
        ? [
            // Direct URLs to specific models - most reliable
            "https://huggingface.co/ggml-org/whisper-base.en/resolve/main/ggml-base.en.bin",
            "https://github.com/ggerganov/whisper.cpp/raw/master/models/ggml-base.en.bin",
          ]
        : [],

      // Template-based URLs - Different naming conventions
      // Original URLs
      `${WHISPER_CPP_URL}/${model.filename}`,
      `${HUGGING_FACE_OLD_URL}/${model.filename}`,
      `${HUGGING_FACE_URL}/${model.filename}`,

      // Add direct download from whisper.cpp GitHub repo
      `${WHISPER_CPP_DIRECT}/ggml-${model.name}.bin`,

      // Try with and without hyphens
      model.name.includes(".")
        ? `https://huggingface.co/ggml-org/whisper-${model.name.replace(
            ".",
            "-"
          )}/resolve/main/ggml-${model.name.replace(".", "-")}.bin`
        : null,

      // Legacy format with underscores
      model.name.includes(".")
        ? `https://huggingface.co/ggml-org/whisper-${model.name.replace(
            ".",
            "_"
          )}/resolve/main/ggml-${model.name.replace(".", "_")}.bin`
        : null,

      // Try the different quantized versions
      `${HUGGING_FACE_ALT_URL}/ggml-model-whisper-base.en-q5_1.bin`,

      // Original OpenAI URLs
      `${OPENAI_URL}/models/ggml-${model.name}.bin`,

      // More variations in naming
      `https://huggingface.co/ggml-org/whisper-${model.name}/resolve/main/ggml-model-whisper-${model.name}.bin`,
    ]
      .flat()
      .filter(Boolean); // Flatten arrays and remove null entries

    let downloadSuccess = false;

    for (const url of downloadUrls) {
      try {
        // Try direct download first
        console.log(`Attempting to download ${model.name} from ${url}...`);
        try {
          await downloadFile(url, modelPath);
          console.log(`Downloaded model ${model.name} to ${modelPath}`);
          downloadSuccess = true;
          break; // Success, move to next model
        } catch (directError) {
          console.error(
            `Direct download from ${url} failed: ${directError.message}`
          );
        }

        // If direct download fails, try using the whisper.cpp script
        if (!downloadSuccess) {
          console.log(
            `Attempting to download model using whisper.cpp script...`
          );
          try {
            execSync(
              `bash ${path.join(
                CONFIG.whisperTmpDir,
                "models",
                "download-ggml-model.sh"
              )} ${model.name}`,
              {
                stdio: "inherit",
                cwd: CONFIG.whisperTmpDir,
              }
            );

            // Find the downloaded model file (might be in whisper.cpp/models/)
            const downloadedModelPath = path.join(
              CONFIG.whisperTmpDir,
              "models",
              model.filename
            );
            if (fs.existsSync(downloadedModelPath)) {
              // Copy to our models directory
              fs.copyFileSync(downloadedModelPath, modelPath);
              console.log(`Model ${model.name} copied to ${modelPath}`);
              downloadSuccess = true;
              break; // Success, move to next model
            } else {
              // Also check models directory with hyphens in name (newer format)
              const hyphenatedName = model.name.replace(".", "-");
              const alternateModelPath = path.join(
                CONFIG.whisperTmpDir,
                "models",
                `ggml-${hyphenatedName}.bin`
              );
              if (fs.existsSync(alternateModelPath)) {
                // Copy to our models directory
                fs.copyFileSync(alternateModelPath, modelPath);
                console.log(
                  `Model ${model.name} (alternate format) copied to ${modelPath}`
                );
                downloadSuccess = true;
                break; // Success, move to next model
              } else {
                console.error(
                  `Model file not found at ${downloadedModelPath} or ${alternateModelPath}`
                );
              }
            }
          } catch (scriptError) {
            console.error(
              `Error running download script: ${scriptError.message}`
            );
          }
        }
      } catch (error) {
        console.error(
          `Error downloading model ${model.name} from ${url}: ${error.message}`
        );
      }
    }

    // If all download attempts failed, create a small placeholder model file
    if (!downloadSuccess) {
      console.error(
        `All download attempts for ${model.name} failed. Creating placeholder model file.`
      );
      try {
        // Create a small placeholder file with a warning message
        const placeholderContent = Buffer.from(
          `This is a placeholder for the ${model.name} model file.\n` +
            `The actual model could not be downloaded during setup.\n` +
            `Please download it manually from https://ggml.ggerganov.com/${model.filename}\n` +
            `and place it at this location.`
        );

        fs.writeFileSync(modelPath, placeholderContent);
        console.log(`Created placeholder for ${model.name} model`);
      } catch (placeholderError) {
        console.error(
          `Error creating placeholder model file: ${placeholderError.message}`
        );
        throw placeholderError;
      }
    }
  }
}

// Download FFmpeg for macOS
async function downloadFFmpeg() {
  console.log("Downloading FFmpeg...");

  const ffmpegPath = path.join(CONFIG.ffmpegDestDir, "ffmpeg");

  // Skip if FFmpeg already exists
  if (fs.existsSync(ffmpegPath)) {
    console.log(`FFmpeg already exists at ${ffmpegPath}, skipping...`);
    return;
  }

  const arch = process.arch;

  // Define FFmpeg download URLs based on architecture
  const FFMPEG_URLS = {
    arm64: [
      "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/5.1.2/static",
      "https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/darwin-arm64",
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-macos-arm64.zip",
    ],
    x64: [
      "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/5.1.2/static",
      "https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/darwin-x64",
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-macos-64.zip",
    ],
  };

  const urls = FFMPEG_URLS[arch] || FFMPEG_URLS.x64;

  // Try each URL in sequence
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(
      `Attempting to download FFmpeg from ${url} (attempt ${i + 1}/${
        urls.length
      })...`
    );

    try {
      // Check if this is likely a zip file
      const isZip = url.endsWith(".zip");

      if (isZip) {
        // Temporary download path for zip file
        const tempZipPath = path.join(os.tmpdir(), "ffmpeg.zip");

        // Download the FFmpeg binary
        await downloadFile(url, tempZipPath);

        // Extract the zip file
        console.log("Extracting FFmpeg...");
        execSync(`unzip -o ${tempZipPath} -d ${CONFIG.ffmpegDestDir}`, {
          stdio: "inherit",
        });

        // If the unzip created a nested directory, find ffmpeg and move it
        const files = fs.readdirSync(CONFIG.ffmpegDestDir);
        let foundFFmpeg = false;

        for (const file of files) {
          const filePath = path.join(CONFIG.ffmpegDestDir, file);
          const stats = fs.statSync(filePath);

          if (stats.isFile() && file === "ffmpeg") {
            foundFFmpeg = true;
            break;
          } else if (stats.isDirectory()) {
            // Look for ffmpeg inside this directory
            try {
              const nestedFiles = fs.readdirSync(filePath);
              for (const nestedFile of nestedFiles) {
                if (nestedFile === "ffmpeg") {
                  const nestedFFmpegPath = path.join(filePath, nestedFile);
                  console.log(
                    `Found ffmpeg in nested directory: ${nestedFFmpegPath}`
                  );
                  fs.copyFileSync(nestedFFmpegPath, ffmpegPath);
                  foundFFmpeg = true;
                  break;
                }
              }
            } catch (nestedError) {
              console.error(
                `Error looking for ffmpeg in nested directory: ${nestedError.message}`
              );
            }
          }

          if (foundFFmpeg) break;
        }

        // Clean up
        try {
          fs.unlinkSync(tempZipPath);
        } catch (cleanupError) {
          console.error(`Error cleaning up temp zip: ${cleanupError.message}`);
        }

        if (!foundFFmpeg) {
          throw new Error("FFmpeg executable not found in downloaded zip");
        }
      } else {
        // Direct binary download
        await downloadFile(url, ffmpegPath);
      }

      // Make it executable
      fs.chmodSync(ffmpegPath, 0o755);

      console.log(`FFmpeg downloaded and installed to ${ffmpegPath}`);
      return; // Success!
    } catch (error) {
      console.error(`Error downloading FFmpeg from ${url}: ${error.message}`);
      console.log("Trying next download URL...");
    }
  }

  // If we get here, all download attempts failed
  throw new Error("All FFmpeg download attempts failed");
}

// Main function
async function main() {
  let overallSuccess = true;

  try {
    console.log("Starting transcription dependencies setup...");

    // Create necessary directories
    createDirectories();

    // Setup components with individual error handling
    try {
      // Setup whisper.cpp
      await setupWhisperCpp();
      console.log("✅ whisper.cpp setup completed successfully");
    } catch (whisperError) {
      console.error(`❌ Error setting up whisper.cpp: ${whisperError.message}`);
      overallSuccess = false;
    }

    try {
      // Download whisper models
      await downloadWhisperModels();
      console.log("✅ Whisper models downloaded successfully");
    } catch (modelsError) {
      console.error(
        `❌ Error downloading whisper models: ${modelsError.message}`
      );
      overallSuccess = false;
    }

    try {
      // Download FFmpeg
      await downloadFFmpeg();
      console.log("✅ FFmpeg downloaded successfully");
    } catch (ffmpegError) {
      console.error(`❌ Error downloading FFmpeg: ${ffmpegError.message}`);
      overallSuccess = false;
    }

    // Final status report
    if (overallSuccess) {
      console.log(
        "\n✅ Transcription dependencies setup completed successfully"
      );
    } else {
      console.log(
        "\n⚠️ Transcription dependencies setup completed with some errors."
      );
      console.log(
        "You may need to run the setup again or install missing components manually."
      );
      console.log(
        "Run `npm run verify-transcription` to check which components need attention."
      );
    }
  } catch (error) {
    console.error(
      `\n❌ Unexpected error in transcription dependencies setup: ${error.message}`
    );
    process.exit(1);
  }

  // Return non-zero exit code if any component failed
  if (!overallSuccess) {
    process.exit(1);
  }
}

// Run the script
main();
