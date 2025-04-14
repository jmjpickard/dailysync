// src/types/audio-capture-addon.d.ts (Corrected)

declare module "audio-capture-addon" {
  // Define the shape of the object that is default exported
  interface AudioCaptureAddon {
    /**
     * Check if ScreenCaptureKit is supported on this macOS version
     * @returns Boolean indicating if ScreenCaptureKit is supported
     */
    isScreenCaptureKitSupported(): boolean;

    /**
     * Get a list of available audio input devices
     * @returns Array of audio input devices with id and name
     */
    getAudioInputDevices():
      | Array<{ id: string; name: string }>
      | { error: string };

    /**
     * Start recording both system audio and microphone input
     * @param micDeviceID - ID of the microphone device to use (empty string uses default)
     * @param systemAudioOutputPath - Path to save system audio to
     * @param micAudioOutputPath - Path to save microphone audio to
     * @returns Boolean indicating if recording started successfully
     */
    startRecording(
      micDeviceID: string,
      systemAudioOutputPath: string,
      micAudioOutputPath: string
    ): boolean;

    /**
     * Stop the current audio recording
     * @returns Boolean indicating if recording stopped successfully
     */
    stopRecording(): boolean;
  }

  // Declare that the module exports this object as the default
  const addon: AudioCaptureAddon;
  export default addon;
}
