{
  "targets": [
    {
      "target_name": "audio_capture_addon",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ 
        "src/main.mm",
        "src/audio_capture.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="mac"', {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "12.3",
            "WARNING_CFLAGS": [
              "-Wno-availability"
            ],
            'OTHER_CFLAGS': [
              '-ObjC++',
              '-std=c++17'
            ]
          },
          "link_settings": {
            "libraries": [
              "-framework Foundation",
              "-framework AVFoundation",
              "-framework CoreAudio",
              "-framework CoreMedia",
              "-framework CoreFoundation",
              "-framework ScreenCaptureKit"
            ]
          }
        }]
      ]
    }
  ]
}