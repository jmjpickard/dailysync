// Types for global dependencies
declare module 'audio-capture-addon' {
  export function getAudioInputDevices(): Array<{ id: string; name: string }>;
  export function startRecording(micDeviceID: string, systemAudioPath: string, micAudioPath: string): boolean;
  export function stopRecording(): boolean;
  export function isScreenCaptureKitSupported(): boolean;
}