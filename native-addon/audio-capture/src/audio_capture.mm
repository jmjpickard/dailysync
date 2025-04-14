#include "audio_capture.h"

#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreMedia/CoreMedia.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

// Mac OS version detection utility
bool MacOSVersionAtLeast(int major, int minor) {
    NSOperatingSystemVersion version = NSProcessInfo.processInfo.operatingSystemVersion;
    return (version.majorVersion > major || 
           (version.majorVersion == major && version.minorVersion >= minor));
}

// Check if macOS 13.0 or later (Ventura)
bool MacOSVenturaOrLater() {
    return MacOSVersionAtLeast(13, 0);
}

// Forward declare the delegate class
@class SCStreamDelegate;

// Implementation class for AudioCapture
class AudioCaptureImpl {
public:
    AudioCaptureImpl() : 
        isRecording(false),
        systemAudioWriter(nil),
        stream(nil),
        streamDelegate(nil),
        micAudioWriter(nil),
        audioEngine(nil) {
    }
    
    ~AudioCaptureImpl() {
        StopRecording();
    }
    
    bool StartRecording(
        const std::string& micDeviceID,
        const std::string& systemAudioOutputPath,
        const std::string& micAudioOutputPath
    );
    
    bool StopRecording();
    
    std::vector<Device> GetAudioInputDevices();
    
    bool IsScreenCaptureKitSupported() {
        return MacOSVersionAtLeast(12, 3);
    }
    
private:
    bool isRecording;
    NSString* micDeviceID;
    NSString* systemAudioPath;
    NSString* micAudioPath;
    
    // System audio recording properties
    AVAssetWriter* systemAudioWriter;
    AVAssetWriterInput* systemAudioWriterInput;
    SCStream* stream;
    SCStreamDelegate* streamDelegate; // Keep reference to delegate
    
    // Microphone recording properties
    AVAssetWriter* micAudioWriter;
    AVAssetWriterInput* micAudioWriterInput;
    AVAudioEngine* audioEngine;
    
    // ScreenCaptureKit setup
    bool SetupScreenCaptureKitAudio();
    
    // AVAudioEngine setup for microphone
    bool SetupMicrophoneAudio(const std::string& deviceID);
    
    // Create audio file writers
    bool SetupAudioFileWriters();
};

// AudioCapture singleton implementation
AudioCapture& AudioCapture::GetInstance() {
    static AudioCapture instance;
    return instance;
}

AudioCapture::AudioCapture() : pImpl(std::make_unique<AudioCaptureImpl>()) {}

AudioCapture::~AudioCapture() = default;

bool AudioCapture::StartRecording(
    const std::string& micDeviceID,
    const std::string& systemAudioOutputPath,
    const std::string& micAudioOutputPath
) {
    return pImpl->StartRecording(micDeviceID, systemAudioOutputPath, micAudioOutputPath);
}

bool AudioCapture::StopRecording() {
    return pImpl->StopRecording();
}

std::vector<Device> AudioCapture::GetAudioInputDevices() {
    return pImpl->GetAudioInputDevices();
}

bool AudioCapture::IsScreenCaptureKitSupported() {
    return pImpl->IsScreenCaptureKitSupported();
}

// Get available audio input devices
std::vector<Device> AudioCaptureImpl::GetAudioInputDevices() {
    std::vector<Device> devices;
    
    // Get audio input devices using AVCaptureDevice
    NSArray<AVCaptureDevice *> *audioDevices = [AVCaptureDevice devicesWithMediaType:AVMediaTypeAudio];
    
    for (AVCaptureDevice *device in audioDevices) {
        Device dev;
        dev.id = std::string([[device uniqueID] UTF8String]);
        dev.name = std::string([[device localizedName] UTF8String]);
        devices.push_back(dev);
    }
    
    return devices;
}

// Stream output delegate (note: not a full delegate implementation)
@interface SCStreamDelegate : NSObject <SCStreamOutput>
@property (nonatomic, strong) AVAssetWriterInput* audioWriterInput;
@property (nonatomic, assign) BOOL isActive;
@end

@implementation SCStreamDelegate

- (instancetype)init {
    self = [super init];
    if (self) {
        self.isActive = YES;
    }
    return self;
}

- (void)dealloc {
    self.isActive = NO;
    [super dealloc];
}

- (void)stream:(SCStream *)stream didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer ofType:(SCStreamOutputType)type {
    // Safety check - if delegate was released but still called
    if (!self.isActive) {
        return;
    }
    
    if (@available(macOS 13.0, *)) {
        if (type == SCStreamOutputTypeAudio && self.audioWriterInput && sampleBuffer) {
            // Verify that the sample buffer is ready and valid
            if (CMSampleBufferDataIsReady(sampleBuffer) && CMSampleBufferIsValid(sampleBuffer)) {
                if (self.audioWriterInput.isReadyForMoreMediaData) {
                    @try {
                        [self.audioWriterInput appendSampleBuffer:sampleBuffer];
                    } @catch (NSException *exception) {
                        NSLog(@"Exception appending sample buffer: %@", exception);
                        NSLog(@"Exception reason: %@", [exception reason]);
                    }
                }
            }
        }
    }
}
@end

// Start recording implementation
bool AudioCaptureImpl::StartRecording(
    const std::string& micDeviceID,
    const std::string& systemAudioOutputPath,
    const std::string& micAudioOutputPath
) {
    @try {
        // Check if already recording
        if (isRecording) {
            NSLog(@"Already recording, stop current recording first");
            return false;
        }
        
        // Check if ScreenCaptureKit is supported
        if (!IsScreenCaptureKitSupported()) {
            NSLog(@"ScreenCaptureKit requires macOS 12.3 or later");
            return false;
        }
        
        // Check if macOS version supports ScreenCaptureKit
        // Note: we can't directly check permission status before trying
        NSLog(@"Will attempt screen capture, which may trigger permission prompt");
        
        // Store parameters
        this->micDeviceID = micDeviceID.empty() ? nil : [NSString stringWithUTF8String:micDeviceID.c_str()];
        this->systemAudioPath = [NSString stringWithUTF8String:systemAudioOutputPath.c_str()];
        this->micAudioPath = [NSString stringWithUTF8String:micAudioOutputPath.c_str()];
        
        // Setup audio file writers
        if (!SetupAudioFileWriters()) {
            NSLog(@"Failed to setup audio file writers");
            StopRecording();
            return false;
        }
        
        // Setup microphone recording
        if (!SetupMicrophoneAudio(micDeviceID)) {
            NSLog(@"Failed to setup microphone recording");
            StopRecording();
            return false;
        }
        
        // Setup system audio recording with ScreenCaptureKit
        if (!SetupScreenCaptureKitAudio()) {
            NSLog(@"Failed to setup system audio recording - likely a permission issue");
            StopRecording();
            return false;
        }
        
        isRecording = true;
        return true;
    } @catch (NSException *exception) {
        NSLog(@"Exception during StartRecording: %@", exception);
        NSLog(@"Exception reason: %@", [exception reason]);
        NSLog(@"Exception callstack: %@", [exception callStackSymbols]);
        StopRecording();
        return false;
    } @catch (...) {
        NSLog(@"Unknown exception during StartRecording");
        StopRecording();
        return false;
    }
}

// Stop recording implementation
bool AudioCaptureImpl::StopRecording() {
    @try {
        // If not recording, nothing to do
        if (!isRecording) {
            return true;
        }
        
        // First, notify the stream delegate that we're stopping, to prevent any callbacks
        if (streamDelegate) {
            streamDelegate.isActive = NO;
        }
        
        // Stop screen capture stream
        if (stream) {
            // Disable callbacks first
            SCStream* tempStream = stream;
            stream = nil;
            
            [tempStream stopCaptureWithCompletionHandler:^(NSError * _Nullable error) {
                if (error) {
                    NSLog(@"Error stopping SCStream: %@", error);
                }
            }];
        }
        
        // Release stream delegate (after stopping stream to prevent crash from callback)
        streamDelegate = nil;
        
        // Stop audio engine for microphone
        if (audioEngine) {
            [audioEngine stop];
            audioEngine = nil;
        }
        
        // Finalize system audio writer
        if (systemAudioWriter) {
            @try {
                if (systemAudioWriter.status == AVAssetWriterStatusWriting) {
                    [systemAudioWriterInput markAsFinished];
                    [systemAudioWriter finishWritingWithCompletionHandler:^{
                        NSLog(@"System audio writer finished with status: %ld", (long)systemAudioWriter.status);
                    }];
                }
            } @catch (NSException *exception) {
                NSLog(@"Exception finalizing system audio writer: %@", exception);
            }
            systemAudioWriterInput = nil;
            systemAudioWriter = nil;
        }
        
        // Finalize microphone audio writer
        if (micAudioWriter) {
            @try {
                if (micAudioWriter.status == AVAssetWriterStatusWriting) {
                    [micAudioWriterInput markAsFinished];
                    [micAudioWriter finishWritingWithCompletionHandler:^{
                        NSLog(@"Microphone audio writer finished with status: %ld", (long)micAudioWriter.status);
                    }];
                }
            } @catch (NSException *exception) {
                NSLog(@"Exception finalizing microphone audio writer: %@", exception);
            }
            micAudioWriterInput = nil;
            micAudioWriter = nil;
        }
        
        isRecording = false;
        return true;
    } @catch (NSException *exception) {
        NSLog(@"Exception during StopRecording: %@", exception);
        NSLog(@"Exception reason: %@", [exception reason]);
        NSLog(@"Exception callstack: %@", [exception callStackSymbols]);
        // Reset state even if there was an exception
        isRecording = false;
        return false;
    } @catch (...) {
        NSLog(@"Unknown exception during StopRecording");
        isRecording = false;
        return false;
    }
}

// Setup audio file writers
bool AudioCaptureImpl::SetupAudioFileWriters() {
    // Audio format settings for both writers
    AudioChannelLayout stereoChannelLayout = {
        .mChannelLayoutTag = kAudioChannelLayoutTag_Stereo,
        .mChannelBitmap = 0,
        .mNumberChannelDescriptions = 0
    };
    
    NSDictionary *audioSettings = @{
        AVFormatIDKey: @(kAudioFormatMPEG4AAC),
        AVSampleRateKey: @(44100),
        AVNumberOfChannelsKey: @(2),
        AVChannelLayoutKey: [NSData dataWithBytes:&stereoChannelLayout length:sizeof(AudioChannelLayout)]
    };
    
    // Setup system audio writer
    NSError *error = nil;
    NSURL *systemAudioURL = [NSURL fileURLWithPath:systemAudioPath];
    systemAudioWriter = [[AVAssetWriter alloc] initWithURL:systemAudioURL fileType:AVFileTypeMPEG4 error:&error];
    if (error) {
        NSLog(@"Error creating system audio writer: %@", error);
        return false;
    }
    
    systemAudioWriterInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeAudio outputSettings:audioSettings];
    systemAudioWriterInput.expectsMediaDataInRealTime = YES;
    
    if (![systemAudioWriter canAddInput:systemAudioWriterInput]) {
        NSLog(@"Cannot add system audio input to writer");
        return false;
    }
    
    [systemAudioWriter addInput:systemAudioWriterInput];
    [systemAudioWriter startWriting];
    [systemAudioWriter startSessionAtSourceTime:CMTimeMake(0, 44100)];
    
    // Setup microphone audio writer
    error = nil;
    NSURL *micAudioURL = [NSURL fileURLWithPath:micAudioPath];
    micAudioWriter = [[AVAssetWriter alloc] initWithURL:micAudioURL fileType:AVFileTypeMPEG4 error:&error];
    if (error) {
        NSLog(@"Error creating microphone audio writer: %@", error);
        return false;
    }
    
    micAudioWriterInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeAudio outputSettings:audioSettings];
    micAudioWriterInput.expectsMediaDataInRealTime = YES;
    
    if (![micAudioWriter canAddInput:micAudioWriterInput]) {
        NSLog(@"Cannot add microphone audio input to writer");
        return false;
    }
    
    [micAudioWriter addInput:micAudioWriterInput];
    [micAudioWriter startWriting];
    [micAudioWriter startSessionAtSourceTime:CMTimeMake(0, 44100)];
    
    return true;
}

// Setup microphone recording using AVAudioEngine
bool AudioCaptureImpl::SetupMicrophoneAudio(const std::string& deviceID) {
    audioEngine = [[AVAudioEngine alloc] init];
    
    // Configure input node
    AVAudioInputNode *inputNode = audioEngine.inputNode;
    
    // Set specific input device if provided
    if (!deviceID.empty()) {
        // Use AVCaptureDevice to select microphone device instead of AVAudioSession
        // (AVAudioSession is iOS-only and not available on macOS)
        NSString *deviceIdStr = [NSString stringWithUTF8String:deviceID.c_str()];
        NSLog(@"Using microphone device ID: %@", deviceIdStr);
        
        // For now, we don't have a way to select the input device on macOS
        // We'll just log that we're using the default device
        NSLog(@"Note: Using system default microphone on macOS - device selection not implemented");
    }
    
    // Tap the input node to get microphone audio
    [inputNode installTapOnBus:0 bufferSize:4096 format:[inputNode outputFormatForBus:0]
                       block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
        // Convert AVAudioPCMBuffer to CMSampleBufferRef
        const AudioBufferList *audioBufferList = buffer.audioBufferList;
        CMSampleBufferRef sampleBuffer = NULL;
        
        // Create audio sample buffer
        AudioStreamBasicDescription asbd = *buffer.format.streamDescription;
        CMFormatDescriptionRef format = NULL;
        OSStatus status = CMAudioFormatDescriptionCreate(kCFAllocatorDefault, &asbd, 0, NULL, 0, NULL, NULL, &format);
        
        if (status == noErr) {
            CMSampleTimingInfo timing = {
                CMTimeMake(1, (int)asbd.mSampleRate), 
                CMTimeMake((CMTimeValue)when.audioTimeStamp.mSampleTime, (int)asbd.mSampleRate),
                CMTimeMake((CMTimeValue)when.audioTimeStamp.mSampleTime, (int)asbd.mSampleRate)
            };
            
            status = CMSampleBufferCreate(kCFAllocatorDefault, NULL, false, NULL, NULL, format, (CMItemCount)buffer.frameLength, 1, &timing, 0, NULL, &sampleBuffer);
            
            if (status == noErr) {
                status = CMSampleBufferSetDataBufferFromAudioBufferList(sampleBuffer, kCFAllocatorDefault, kCFAllocatorDefault, 0, audioBufferList);
                
                AVAssetWriterInput *input = micAudioWriterInput;
                if (status == noErr && sampleBuffer && input && input.isReadyForMoreMediaData) {
                    [input appendSampleBuffer:sampleBuffer];
                }
                
                if (sampleBuffer) {
                    CFRelease(sampleBuffer);
                }
            }
            
            if (format) {
                CFRelease(format);
            }
        }
    }];
    
    // Start the audio engine
    NSError *error = nil;
    if (![audioEngine startAndReturnError:&error]) {
        NSLog(@"Error starting audio engine: %@", error);
        return false;
    }
    
    return true;
}

// Setup system audio recording with ScreenCaptureKit
bool AudioCaptureImpl::SetupScreenCaptureKitAudio() {
    NSLog(@"DEBUG: Entering SetupScreenCaptureKitAudio"); // Log Entry

    // Create a stream configuration
    SCStreamConfiguration *config = [[SCStreamConfiguration alloc] init];
    if (!config) {
         NSLog(@"DEBUG: Failed to allocate SCStreamConfiguration!");
         return false;
    }
     NSLog(@"DEBUG: SCStreamConfiguration allocated: %p", config);

    // Configure for audio capture, minimize video overhead
    if (@available(macOS 13.0, *)) {
        config.capturesAudio = YES;
        config.excludesCurrentProcessAudio = NO;  // Capture this app's audio too
        NSLog(@"DEBUG: Configured for audio capture (macOS 13+)");
    } else {
         NSLog(@"DEBUG: Audio capture not available before macOS 13");
    }

    // Set minimal video dimensions to reduce overhead
    config.width = 2;
    config.height = 2;
    config.minimumFrameInterval = CMTimeMake(1, 1);  // 1 fps to minimize video overhead
    NSLog(@"DEBUG: Configured minimal video settings (width=%zu, height=%zu, interval=1fps)", config.width, config.height);

    // Get available screen content asynchronously
    __block dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block SCShareableContent *content = nil;
    __block NSError *contentError = nil;

    NSLog(@"DEBUG: Calling SCShareableContent getShareableContentWithCompletionHandler...");
    // Note: On macOS there's no direct API to check permission status before trying
    // We will proceed with the attempt, which will trigger the permission prompt if needed
    NSLog(@"Attempting screen recording, which may trigger permission prompt if not already granted");

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable shareableContent, NSError * _Nullable error) {
        NSLog(@"DEBUG: getShareableContent completion handler entered."); // Log inside handler
        content = shareableContent;
        contentError = error;
        dispatch_semaphore_signal(semaphore);
        NSLog(@"DEBUG: getShareableContent completion handler exiting."); // Log inside handler
    }];

    // Wait for content with a timeout (increased from 5 to 10 seconds for production environment)
    NSLog(@"DEBUG: Waiting for getShareableContent semaphore...");
    dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC));
    NSLog(@"DEBUG: Semaphore wait finished for getShareableContent.");

    // Log the completion status
    NSLog(@"getShareableContent completed: contentError=%@, content=%@", contentError, content ? @"Available" : @"Nil"); // <<< THIS WAS SEEN IN PREVIOUS LOG

    // --- Start of the block where the previous crash occurred ---

    if (contentError) {
        NSLog(@"Error getting shareable content: %@", contentError);
        // Check error domain for permission issues
        if ([contentError.domain isEqualToString:@"com.apple.screencapture.SCStreamErrorDomain"]) {
            NSLog(@"Permission error or API requirement not met - error code: %ld", (long)contentError.code);
        }
        return false;
    }

    if (!content) {
        NSLog(@"Content is nil, likely a permission issue or API failure.");
        return false;
    }

    NSLog(@"DEBUG: Content is valid."); // Log 1

    @try {
        NSLog(@"DEBUG: Inspecting content object: %@", content); // Log 1a: Inspect object
        if ([content respondsToSelector:@selector(displays)]) { // Log 1b: Check selector
            NSLog(@"DEBUG: Content responds to selector 'displays'.");
        } else {
            NSLog(@"DEBUG: ERROR - Content does NOT respond to selector 'displays'!");
            // Maybe return false here if it doesn't respond?
            return false;
        }
    } @catch (NSException *exception) {
        NSLog(@"DEBUG: EXCEPTION while inspecting content or checking selector: %@", exception);
        // Treat this as a failure
        return false;
    }


    NSArray<SCDisplay *> *displays = content.displays;
    if (!displays || displays.count == 0) {
        NSLog(@"No displays available for capture. Permission may have been denied or no displays found.");
        return false;
    }

    NSLog(@"DEBUG: Found %lu displays.", (unsigned long)displays.count); // Log 2

    SCDisplay *display = displays.firstObject;
    if (!display) {
        NSLog(@"Failed to get first display object from displays array.");
        return false;
    }

    NSLog(@"DEBUG: Got first display: %@", display); // Log 3

    // --- Check before creating filter ---
    NSLog(@"DEBUG: Creating filter with display: %p (%@)", display, display); // Log 4
    SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display excludingApplications:@[] exceptingWindows:@[]];
    if (!filter) {
        NSLog(@"Failed to create content filter.");
        return false;
    }
    NSLog(@"DEBUG: Filter created: %p", filter); // Log 5

    // --- Check before creating delegate ---
    NSLog(@"DEBUG: Creating stream delegate..."); // Log 6
    streamDelegate = [[SCStreamDelegate alloc] init];
    if (!streamDelegate) {
        NSLog(@"Failed to create stream delegate (allocation failed).");
        return false;
    }
    NSLog(@"DEBUG: Delegate created: %p", streamDelegate); // Log 7
    // Ensure systemAudioWriterInput is valid before assigning
    if (!systemAudioWriterInput) {
         NSLog(@"DEBUG: ERROR - systemAudioWriterInput is nil before assigning to delegate!");
         // Handle this error appropriately, maybe return false?
         // For now, just log, but this shouldn't happen if SetupAudioFileWriters succeeded.
    }
    streamDelegate.audioWriterInput = systemAudioWriterInput;
    NSLog(@"DEBUG: Assigned writer input (%p) to delegate.", systemAudioWriterInput); // Log 8


    // --- Check before creating stream ---
    NSLog(@"DEBUG: Creating stream with filter: %p, config: %p", filter, config); // Log 9
    stream = [[SCStream alloc] initWithFilter:filter configuration:config delegate:nil]; // Delegate is added later via addStreamOutput
    if (!stream) {
        NSLog(@"Failed to create stream (SCStream alloc/init failed).");
        // Clean up delegate if stream creation fails
        streamDelegate = nil;
        return false;
    }
    NSLog(@"DEBUG: Stream created: %p", stream); // Log 10

    // --- Original debug logs (should be reached now if abort was earlier) ---
    NSLog(@"DEBUG: Before adding output: stream=%p, streamDelegate=%p", stream, streamDelegate);
    NSLog(@"DEBUG: Before adding output: systemAudioWriterInput=%p", systemAudioWriterInput);

    // Add audio output
    NSError *error = nil;
    bool outputAdded = false;
    if (@available(macOS 13.0, *)) {
        NSLog(@"DEBUG: Attempting to add audio stream output..."); // Log before addStreamOutput
        if (![stream addStreamOutput:streamDelegate type:SCStreamOutputTypeAudio sampleHandlerQueue:dispatch_get_main_queue() error:&error]) {
            NSLog(@"Error adding audio output: %@", error);
            // Clean up stream and delegate if adding output fails
            stream = nil;
            streamDelegate = nil;
            return false;
        }
        NSLog(@"DEBUG: Successfully added audio stream output."); // Log after addStreamOutput
        outputAdded = true;
    } else {
        // On older macOS versions, we might still attempt video if desired, but log audio isn't supported
        NSLog(@"DEBUG: Audio capture requires macOS 13.0 or later. Cannot add audio output.");
        // If you wanted video fallback:
        // if (![stream addStreamOutput:streamDelegate type:SCStreamOutputTypeScreen ...]) { ... }
        // outputAdded = true; // If video fallback was added
    }

    // Only proceed if an output was successfully added (either audio or video fallback if implemented)
    if (!outputAdded) {
         NSLog(@"DEBUG: No stream output was added (either due to version or error).");
         stream = nil; // Clean up stream
         streamDelegate = nil; // Clean up delegate
         return false;
    }

    // Start the stream
    __block bool streamStarted = false;
    __block dispatch_semaphore_t startSemaphore = dispatch_semaphore_create(0);

    NSLog(@"DEBUG: Calling startCaptureWithCompletionHandler...");
    [stream startCaptureWithCompletionHandler:^(NSError * _Nullable error) {
        NSLog(@"DEBUG: startCapture completion handler entered."); // Log inside handler
        if (error) {
            NSLog(@"Error starting capture: %@", error);
            if ([error.domain isEqualToString:@"com.apple.screencapture.SCStreamErrorDomain"]) {
                NSLog(@"Screen capture error - code: %ld - likely permission denied", (long)error.code);
            }
        } else {
            streamStarted = true;
        }
        dispatch_semaphore_signal(startSemaphore);
        NSLog(@"DEBUG: startCapture completion handler exiting."); // Log inside handler
    }];

    // Wait for stream to start with a timeout (increased from 5 to 10 seconds for production environment)
    NSLog(@"DEBUG: Waiting for startCapture semaphore...");
    dispatch_semaphore_wait(startSemaphore, dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC));
    NSLog(@"DEBUG: Semaphore wait finished for startCapture.");

    // Log the result of the stream start
    NSLog(@"Stream start result: %@", streamStarted ? @"SUCCESS" : @"FAILED");

    if (!streamStarted) {
        // Clean up if stream failed to start
        NSLog(@"DEBUG: Cleaning up stream and delegate because stream failed to start.");
        stream = nil;
        streamDelegate = nil;
    }

     NSLog(@"DEBUG: Exiting SetupScreenCaptureKitAudio with result: %s", streamStarted ? "true" : "false"); // Log Exit
    return streamStarted;
}