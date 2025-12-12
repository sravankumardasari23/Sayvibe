document.addEventListener('DOMContentLoaded', () => {
    // We only need the Record button now. The Stop button is functionally replaced by the timer.
    const recordButtons = document.querySelectorAll('.record-btn');
    const forms = document.querySelectorAll('form');
    
    let mediaRecorder;
    let audioChunks = [];
    let stream;
    let currentFormId;
    let timerTimeout; // Used to stop recording after 5 seconds
    let secondsElapsed = 0;
    let timerInterval;

    const RECORD_DURATION = 5; // Set the recording duration to 5 seconds

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support microphone access.');
        return;
    }

    // 1. Get microphone access and enable buttons
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => {
            stream = s;
            recordButtons.forEach(btn => btn.disabled = false);
        })
        .catch(err => {
            alert('Microphone access denied. Please enable it to use this feature.');
            console.error(err);
        });
        
    // Helper function to update the visible timer
    function updateTimer(statusDiv) {
        secondsElapsed = 0;
        statusDiv.textContent = `Recording... Duration: 0:00 / 0:${RECORD_DURATION}`;
        
        timerInterval = setInterval(() => {
            secondsElapsed++;
            const s = String(secondsElapsed % 60).padStart(2, '0');
            statusDiv.textContent = `Recording... Duration: 0:${s} / 0:${RECORD_DURATION}`;
        }, 1000);
    }

    // Function to handle the recorder stopping (manually or by timer)
    function handleStop(formElement, statusDiv) {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            clearInterval(timerInterval);
            clearTimeout(timerTimeout);
            mediaRecorder.stop();
            
            // Re-enable the form submit button and disable recording button
            formElement.querySelector('input[type="submit"]').disabled = false;
            formElement.querySelector('.record-btn').disabled = false;
            
            statusDiv.textContent = 'Recording stopped. Review your audio before saving.';
        }
    }

    function startRecording(button) {
        // Find the elements for this form
        const formElement = button.closest('form');
        const statusDiv = formElement.querySelector('.status-message');
        const audioPlayback = formElement.querySelector('.audio-playback');

        // Reset state
        audioChunks = [];
        currentFormId = formElement.id;
        audioPlayback.style.display = 'none';
        audioPlayback.removeAttribute('src');
        
        // Disable form submission and re-enable the recording button
        formElement.querySelector('input[type="submit"]').disabled = true;
        button.disabled = true;

        // Start MediaRecorder
        const options = { mimeType: 'audio/webm' };
        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Enable playback for review
            audioPlayback.src = audioUrl;
            audioPlayback.style.display = 'block';
            
            // Attach the Blob to the form as a hidden file input for submission
            attachAudioToForm(formElement, audioBlob);
        };

        mediaRecorder.start();
        
        // Start the timer
        updateTimer(statusDiv);
        
        // 🛑 Set timeout to automatically stop after 5 seconds 🛑
        timerTimeout = setTimeout(() => {
            handleStop(formElement, statusDiv);
            statusDiv.textContent = 'Recording complete (5 seconds). Review your audio.';
        }, RECORD_DURATION * 1000); // 5000 milliseconds
    }
    
    // Function to create the hidden input field with the recorded audio file
    function attachAudioToForm(formElement, audioBlob) {
        // Remove old audio input if it exists
        const existingInput = formElement.querySelector('input[name="audio"]');
        if (existingInput) {
            formElement.removeChild(existingInput);
        }

        const audioInput = document.createElement('input');
        audioInput.type = 'hidden';
        audioInput.name = 'audio';
        
        // Convert the Blob into a File object (needed for Flask request.files)
        const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        audioInput.files = dataTransfer.files;

        formElement.appendChild(audioInput);
    }

    // 2. Attach Start Recording to the button
    recordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            startRecording(btn);
        });
    });

    // 3. Form Submission Logic
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const audioInput = form.querySelector('input[name="audio"]');
            
            // Check if recording is still running OR if no audio file is attached
            if ((mediaRecorder && mediaRecorder.state === 'recording') || !audioInput || !audioInput.files.length) {
                
                // If recording is running, stop it and attach the file
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    handleStop(form, form.querySelector('.status-message'));
                }
                
                // Prevent submission until file is attached or user confirms
                e.preventDefault(); 
                
                // If the file is still missing after stop, alert the user and wait 
                // for the file attachment (mediaRecorder.onstop).
                
                // We submit the form only after a short delay to guarantee file attachment
                if (!audioInput || !audioInput.files.length) {
                     setTimeout(() => {
                        // Check again after the wait
                        if (form.querySelector('input[name="audio"]') && form.querySelector('input[name="audio"]').files.length > 0) {
                             form.submit();
                        } else {
                            // If still missing (a rare browser error)
                            alert("Audio file failed to attach. Please try recording again.");
                        }
                    }, 500); // Wait 500ms for onstop to complete
                }

            }
            // ELSE: Audio is already attached (from a previous recording) and ready to go.
        });
    });
});
