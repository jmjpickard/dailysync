// Audio capture client for Daily Sync
// This runs in the browser and streams captured audio to the Electron app via WebSocket

// Global state variables
let socket = null;
let eventId = null;
let micStream = null;
let displayStream = null;
let micRecorder = null;
let tabRecorder = null;
let isRecording = false;
let tabAudioTracks = [];
let micAudioTracks = [];
let statusElement = null;
let stopButton = null;

// Get DOM elements
document.addEventListener('DOMContentLoaded', () => {
    statusElement = document.getElementById('status');
    stopButton = document.getElementById('stop-btn');
    
    // Setup stop button event listener
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            stopCapture();
        });
    }
    
    // Initialize
    init();
});

// Initialize the page
async function init() {
    try {
        // Get the event ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        eventId = urlParams.get('eventId');
        
        if (!eventId) {
            updateStatus('Error: Missing event ID parameter', 'error');
            console.error('No eventId parameter found in URL');
            return;
        }
        
        // Get the WebSocket port from URL parameters, default to trying the same port as HTTP
        let port = urlParams.get('port') || window.location.port || '3000';
        
        // Connect to WebSocket server
        connectWebSocket(port);
    } catch (error) {
        updateStatus(`Initialization error: ${error.message}`, 'error');
        console.error('Error during initialization:', error);
    }
}

// Connect to the WebSocket server
function connectWebSocket(port) {
    try {
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        const wsUrl = `${protocol}//${host}:${port}`;
        
        updateStatus('Connecting to recording server...', '');
        console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
        
        socket = new WebSocket(wsUrl);
        
        // WebSocket event handlers
        socket.onopen = () => {
            console.log('WebSocket connection established');
            updateStatus('Connected to recording server', 'success');
            
            // Send initial connection message
            socket.send(JSON.stringify({ 
                type: 'status', 
                status: 'connected',
                eventId: eventId,
                message: 'Browser capture page connected' 
            }));
            
            // Start capture automatically
            startCapture();
        };
        
        socket.onclose = (event) => {
            console.log(`WebSocket closed: ${event.code} ${event.reason}`);
            
            if (isRecording) {
                updateStatus('Connection lost. Recording stopped.', 'error');
                stopAllMediaTracks();
            } else {
                updateStatus('Disconnected from recording server', 'error');
            }
            
            // Disable stop button
            if (stopButton) {
                stopButton.disabled = true;
            }
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('Connection error', 'error');
        };
        
        socket.onmessage = handleWebSocketMessage;
    } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        updateStatus(`Connection error: ${error.message}`, 'error');
    }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(event) {
    try {
        console.log('Received message from server:', event.data);
        const message = JSON.parse(event.data);
        
        if (message.command === 'stop' && message.eventId === eventId) {
            console.log('Received stop command from server');
            stopCapture();
        }
    } catch (error) {
        console.error('Error processing WebSocket message:', error);
    }
}

// Start audio capture
async function startCapture() {
    try {
        updateStatus('Requesting permissions...', '');
        
        // Request microphone access
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone access granted');
        } catch (micError) {
            console.error('Error accessing microphone:', micError);
            sendErrorStatus(`Microphone error: ${micError.name}. ${micError.message}`);
            return;
        }
        
        // Request display media (tab) access
        try {
            displayStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true,  // Needed for tab selection UI
                audio: true   // Request tab audio
            });
            console.log('Display media access granted');
            
            // Check if we have audio tracks
            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('No audio tracks found in display stream. Did you select "Share tab audio"?');
                sendErrorStatus('No audio detected from the tab. Please ensure "Share tab audio" is selected.');
                
                // Continue with just microphone as a fallback
                updateStatus('Recording microphone only (no tab audio)', 'warning');
            } else {
                console.log(`Got ${audioTracks.length} audio tracks from display capture`);
                tabAudioTracks = audioTracks;
            }
            
            // Stop video tracks as we only need audio
            const videoTracks = displayStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = false;  // Disable but don't stop yet to keep the capture active
            });
        } catch (displayError) {
            console.error('Error accessing display media:', displayError);
            sendErrorStatus(`Display capture error: ${displayError.name}. ${displayError.message}`);
            
            // Clean up mic stream
            stopAllMediaTracks();
            return;
        }
        
        // Create the mic recorder
        const micOptions = { mimeType: 'audio/webm;codecs=opus' };
        micRecorder = new MediaRecorder(micStream, micOptions);
        
        micRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                // Handle mic audio data
                sendAudioChunk('mic_chunk', event.data);
            }
        };
        
        // Create the tab audio recorder if available
        if (tabAudioTracks.length > 0) {
            // Create a new MediaStream with just the audio tracks
            const tabAudioStream = new MediaStream(tabAudioTracks);
            
            const tabOptions = { mimeType: 'audio/webm;codecs=opus' };
            tabRecorder = new MediaRecorder(tabAudioStream, tabOptions);
            
            tabRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    // Handle tab audio data
                    sendAudioChunk('tab_chunk', event.data);
                }
            };
        }
        
        // Register stop event handler for recorders before starting them
        let micStopped = false;
        let tabStopped = true; // Default to true in case we don't have tab audio
        
        micRecorder.onstop = () => {
            console.log('Mic recorder stopped');
            micStopped = true;
            
            // If both recorders have stopped, notify the server
            if (micStopped && tabStopped) {
                sendStoppedStatus();
            }
        };
        
        if (tabRecorder) {
            tabStopped = false; // We have tab audio, so reset to false
            
            tabRecorder.onstop = () => {
                console.log('Tab recorder stopped');
                tabStopped = true;
                
                // If both recorders have stopped, notify the server
                if (micStopped && tabStopped) {
                    sendStoppedStatus();
                }
            };
        }
        
        // Start the recorders
        micRecorder.start(1000); // Capture in 1-second chunks
        if (tabRecorder) {
            tabRecorder.start(1000);
        }
        
        // Update UI and state
        isRecording = true;
        updateStatus('Recording...', 'recording');
        if (stopButton) {
            stopButton.disabled = false;
        }
        
        // Add recording indicator
        const statusContainer = document.querySelector('.status');
        if (statusContainer) {
            statusContainer.innerHTML = 
                '<span class="recording-indicator"></span>' + 
                statusContainer.textContent;
        }
        
        // Notify the server that recording has started
        socket.send(JSON.stringify({
            type: 'status',
            status: 'recording_started',
            eventId: eventId
        }));
        
    } catch (error) {
        console.error('Error starting capture:', error);
        updateStatus(`Capture error: ${error.message}`, 'error');
        sendErrorStatus(`Capture error: ${error.message}`);
        stopAllMediaTracks();
    }
}

// Stop audio capture
function stopCapture() {
    try {
        if (!isRecording) {
            console.log('Not recording, nothing to stop');
            return;
        }
        
        updateStatus('Stopping recording...', '');
        
        // Disable stop button to prevent multiple clicks
        if (stopButton) {
            stopButton.disabled = true;
        }
        
        // Stop recorders first to trigger ondataavailable for any remaining data
        if (micRecorder && micRecorder.state !== 'inactive') {
            console.log('Stopping mic recorder...');
            micRecorder.stop();
        }
        
        if (tabRecorder && tabRecorder.state !== 'inactive') {
            console.log('Stopping tab recorder...');
            tabRecorder.stop();
        }
        
        // Note: We don't call sendStoppedStatus() here because it will be called
        // by the onstop event handlers after both recorders have stopped
        
        // Stop all media tracks
        stopAllMediaTracks();
        
        // Update state
        isRecording = false;
        
    } catch (error) {
        console.error('Error stopping capture:', error);
        updateStatus(`Error stopping capture: ${error.message}`, 'error');
        
        // Try to notify server of error
        sendErrorStatus(`Error stopping capture: ${error.message}`);
        
        // Clean up anyway
        stopAllMediaTracks();
        isRecording = false;
    }
}

// Send error status to server
function sendErrorStatus(message) {
    try {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'status',
                status: 'error',
                eventId: eventId,
                message: message
            }));
        }
    } catch (error) {
        console.error('Error sending error status:', error);
    }
}

// Send stopped status to server
function sendStoppedStatus() {
    try {
        updateStatus('Recording completed', 'success');
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'status',
                status: 'stopped',
                eventId: eventId
            }));
            
            console.log('Sent stopped status to server');
        }
    } catch (error) {
        console.error('Error sending stopped status:', error);
    }
}

// Send audio chunk to server
async function sendAudioChunk(type, blob) {
    try {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected, cannot send chunk');
            return;
        }
        
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const base64data = arrayBufferToBase64(arrayBuffer);
        
        // Send the chunk via WebSocket
        socket.send(JSON.stringify({
            type: type,
            eventId: eventId,
            data: base64data
        }));
        
    } catch (error) {
        console.error(`Error sending ${type}:`, error);
    }
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
}

// Stop all media tracks
function stopAllMediaTracks() {
    try {
        if (micStream) {
            micStream.getTracks().forEach(track => {
                track.stop();
            });
            micStream = null;
        }
        
        if (displayStream) {
            displayStream.getTracks().forEach(track => {
                track.stop();
            });
            displayStream = null;
        }
        
        console.log('All media tracks stopped');
    } catch (error) {
        console.error('Error stopping media tracks:', error);
    }
}

// Update the status display
function updateStatus(message, className) {
    if (statusElement) {
        statusElement.textContent = message;
        
        // Remove all status classes
        statusElement.classList.remove('recording', 'error', 'success', 'warning');
        
        // Add the new class if provided
        if (className) {
            statusElement.classList.add(className);
        }
    }
}