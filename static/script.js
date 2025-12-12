document.addEventListener('DOMContentLoaded', () => {
    const recordButtons = document.querySelectorAll('.record-btn');
    const stopButtons = document.querySelectorAll('.stop-btn');
    const forms = document.querySelectorAll('form'); 
    
    let mediaRecorder;
    let audioChunks = [];
    let stream;
    let currentFormId;
    let timerInterval;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support microphone access.');
        return;
    }

    // 1. Get microphone access and enable buttons
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => {
            stream = s;
            recordButtons.forEach(btn => btn.disabled = false);
            // Hide the redundant stop buttons initially
            stopButtons.forEach(btn => btn.style.display = 'none');
        })
        .catch(err => {
            alert('Microphone access denied. Please enable it to use this feature.');
            console.error(err);
        });

    // Helper function to update the visible timer
    function updateTimer(statusDiv) {
        let seconds = 0;
        timerInterval = setInterval(() => {
            seconds++;
            const s = String(seconds % 60).padStart(2, '0');
            const m = String(Math.floor(seconds / 60)).padStart(2, '0');
            statusDiv.textContent = `Recording... Duration: ${m}:${s}`;
        }, 1000);
    }

    function startRecording(button, statusDiv) {
        // Reset state
        audioChunks = [];
        currentFormId = button.dataset.form;
        
        // Start MediaRecorder
        const options = { mimeType: 'audio/webm' };
        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Playback element is static/hidden in the new flow, but we keep the logic to create the Blob
            
            // Attach the Blob to the form as a hidden file input for submission
            const formElement = document.getElementById(currentFormId);
            const existingInput = formElement.querySelector('input[name="audio"]');
            if (existingInput) {
                formElement.removeChild(existingInput);
            }

            const audioInput = document.createElement('input');
            audioInput.type = 'hidden';
            audioInput.name = 'audio';
            
            // Convert the Blob into a File object
            const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            audioInput.files = dataTransfer.files;

            formElement.appendChild(audioInput);
            
            statusDiv.textContent = 'Recording complete. Submitting...';
        };

        mediaRecorder.start();
        
        // Start the timer and update the status message
        updateTimer(statusDiv);
        button.disabled = true;
        
        // Hide playback controls during recording for cleaner UI
        document.querySelector(`#${currentFormId} .audio-playback`).style.display = 'none';
    }
    
    // --- NEW: Function to stop recording and prepare for submission ---
    function stopAndPrepareSubmission() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            clearInterval(timerInterval);
            mediaRecorder.stop();
        }
        // Crucially, the form submission should be handled by the event listener below
    }

    // 2. Attach Start Recording to the button
    recordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const formId = btn.dataset.form;
            const statusDiv = document.querySelector(`#${formId} .status-message`);
            startRecording(btn, statusDiv);
            
            // Change button text to reflect new state
            btn.textContent = 'Recording in Progress...';
            btn.style.backgroundColor = '#cc2b1e'; // Change color to red to indicate recording
        });
    });

    // 3. Attach Stop/Submission Logic to the Form's Submit Event
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            // Check if recording is active. If so, stop it before submission.
            stopAndPrepareSubmission();
            
            // The submission will proceed automatically after mediaRecorder.onstop runs,
            // because the mediaRecorder.onstop function finishes synchronously.
            // We use setTimeout to ensure the audio blob is attached before the submission completes.
            
            // Delay the form submission very slightly to allow mediaRecorder.onstop to finish
            e.preventDefault();
            setTimeout(() => {
                form.submit();
            }, 50); // Small delay to guarantee the 'audio' file is attached
        });
    });
    
    // 4. Remove all Stop Button Listeners (since they are hidden/removed)
    // The previous stop button logic is now completely replaced by the form submit listener.

});
