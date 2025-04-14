#ifndef AUDIO_CAPTURE_H
#define AUDIO_CAPTURE_H

#include <string>
#include <vector>
#include <memory>

// Forward declarations to avoid exposing Objective-C types
class AudioCaptureImpl;

// Device structure to represent audio devices
struct Device {
  std::string id;
  std::string name;
};

class AudioCapture {
public:
  // Singleton pattern
  static AudioCapture& GetInstance();
  
  // Delete copy and move constructors/operators
  AudioCapture(const AudioCapture&) = delete;
  AudioCapture& operator=(const AudioCapture&) = delete;
  AudioCapture(AudioCapture&&) = delete;
  AudioCapture& operator=(AudioCapture&&) = delete;
  
  // Start recording system audio and microphone
  bool StartRecording(
    const std::string& micDeviceID,
    const std::string& systemAudioOutputPath,
    const std::string& micAudioOutputPath
  );
  
  // Stop the recording
  bool StopRecording();
  
  // Get available audio input devices
  std::vector<Device> GetAudioInputDevices();
  
  // Check if ScreenCaptureKit is supported on this macOS version
  bool IsScreenCaptureKitSupported();
  
  // Destructor
  ~AudioCapture();

private:
  // Private constructor for singleton
  AudioCapture();
  
  // Implementation object (pimpl pattern)
  std::unique_ptr<AudioCaptureImpl> pImpl;
};

#endif // AUDIO_CAPTURE_H