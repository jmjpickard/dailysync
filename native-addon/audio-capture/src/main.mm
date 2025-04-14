#include <napi.h>
#include "audio_capture.h"

// Wrapper function to start recording
Napi::Boolean StartRecording(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Validate arguments
  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Wrong number of arguments. Expected: micDeviceID, systemAudioOutputPath, micAudioOutputPath")
        .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (!info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
    Napi::TypeError::New(env, "Wrong argument types. Expected all arguments to be strings")
        .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  std::string micDeviceID = info[0].As<Napi::String>().Utf8Value();
  std::string systemAudioOutputPath = info[1].As<Napi::String>().Utf8Value();
  std::string micAudioOutputPath = info[2].As<Napi::String>().Utf8Value();

  // Call the native implementation
  bool success = AudioCapture::GetInstance().StartRecording(
    micDeviceID,
    systemAudioOutputPath,
    micAudioOutputPath
  );

  return Napi::Boolean::New(env, success);
}

// Wrapper function to stop recording
Napi::Boolean StopRecording(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Call the native implementation
  bool success = AudioCapture::GetInstance().StopRecording();
  
  return Napi::Boolean::New(env, success);
}

// Wrapper function to get available audio input devices
Napi::Array GetAudioInputDevices(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Get the devices from the native implementation
  std::vector<Device> devices = AudioCapture::GetInstance().GetAudioInputDevices();
  
  // Create TypeScript array to return the devices
  Napi::Array result = Napi::Array::New(env, devices.size());
  
  for (size_t i = 0; i < devices.size(); i++) {
    Napi::Object device = Napi::Object::New(env);
    device.Set("id", Napi::String::New(env, devices[i].id));
    device.Set("name", Napi::String::New(env, devices[i].name));
    result[i] = device;
  }
  
  return result;
}

// Wrapper function to check if ScreenCaptureKit is supported
Napi::Boolean IsScreenCaptureKitSupported(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Call the native implementation
  bool supported = AudioCapture::GetInstance().IsScreenCaptureKitSupported();
  
  return Napi::Boolean::New(env, supported);
}

// Initialize native add-on
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("startRecording", Napi::Function::New(env, StartRecording));
  exports.Set("stopRecording", Napi::Function::New(env, StopRecording));
  exports.Set("getAudioInputDevices", Napi::Function::New(env, GetAudioInputDevices));
  exports.Set("isScreenCaptureKitSupported", Napi::Function::New(env, IsScreenCaptureKitSupported));
  return exports;
}

NODE_API_MODULE(audio_capture_addon, Init)