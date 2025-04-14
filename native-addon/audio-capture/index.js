'use strict';

let addon;
try {
  // Try the standard way to load the addon
  addon = require('bindings')('audio_capture_addon');
  console.log('Successfully loaded audio_capture_addon via bindings');
} catch (error) {
  console.error('Failed to load audio_capture_addon via bindings:', error);
  
  try {
    // Try alternative path resolution as fallback
    const path = require('path');
    const alternativePath = path.resolve(__dirname, './build/Release/audio_capture_addon.node');
    addon = require(alternativePath);
    console.log('Successfully loaded audio_capture_addon via alternative path:', alternativePath);
  } catch (fallbackError) {
    console.error('Failed to load audio_capture_addon via alternative path:', fallbackError);
    
    // Create dummy functions that log errors instead of crashing
    addon = {
      startRecording: function() {
        console.error('Audio capture addon failed to load, recording functionality unavailable');
        return false;
      },
      stopRecording: function() {
        console.error('Audio capture addon failed to load, recording functionality unavailable');
        return false;
      },
      getAudioInputDevices: function() {
        console.error('Audio capture addon failed to load, cannot get audio devices');
        return [];
      },
      isScreenCaptureKitSupported: function() {
        console.error('Audio capture addon failed to load, cannot check ScreenCaptureKit support');
        return false;
      }
    };
  }
}

/**
 * Starts recording audio from both system audio and microphone
 * @param {string} micDeviceID - The ID of the microphone device to use
 * @param {string} systemAudioOutputPath - Path where the system audio will be saved
 * @param {string} micAudioOutputPath - Path where the microphone audio will be saved
 * @returns {boolean} - True if recording started successfully, false otherwise
 */
function startRecording(micDeviceID, systemAudioOutputPath, micAudioOutputPath) {
  return addon.startRecording(micDeviceID, systemAudioOutputPath, micAudioOutputPath);
}

/**
 * Stops the current recording
 * @returns {boolean} - True if recording stopped successfully, false otherwise
 */
function stopRecording() {
  return addon.stopRecording();
}

/**
 * Lists available audio input devices
 * @returns {Array} - Array of device objects with id and name properties
 */
function getAudioInputDevices() {
  return addon.getAudioInputDevices();
}

/**
 * Checks if the current macOS version supports ScreenCaptureKit
 * @returns {boolean} - True if supported (macOS 12.3+), false otherwise
 */
function isScreenCaptureKitSupported() {
  return addon.isScreenCaptureKitSupported();
}

module.exports = {
  startRecording,
  stopRecording,
  getAudioInputDevices,
  isScreenCaptureKitSupported
};