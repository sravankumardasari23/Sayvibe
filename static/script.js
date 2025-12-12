document.addEventListener('DOMContentLoaded', () => {
    const recordButtons = document.querySelectorAll('.record-btn');
    const stopButtons = document.querySelectorAll('.stop-btn');
    const audioElements = document.querySelectorAll('.audio-playback');
    const statusDivs = document.querySelectorAll('.status-message');
    const form = document.querySelector('form');
    let mediaRecorder;
    let audioChunks = [];
    let stream;
    let currentFormId;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support microphone access.');
        return;
    }

    // Get microphone access
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => {
            stream = s;
            recordButtons.forEach(btn => btn.disabled = false);
        })
        .catch(err => {
            alert('Microphone access denied. Please enable it to use this feature.');
            console.error(err);
        });

    function startRecording(button, statusDiv) {
        currentFormId = button.dataset.form; // Get the ID of the form this button belongs to
        
        audioChunks = [];
        const options = { mimeType: 'audio/webm' }; 
        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Create a temporary audio element for playback
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioPlayback = document.querySelector(`#${currentFormId} .audio-playback`);
            audioPlayback.src = audioUrl;
            audioPlayback.controls = true;

            // Attach the Blob to the form as a file input
            const formElement = document.getElementById(currentFormId);
            const existingInput = formElement.querySelector('input[name="audio"]');
            if (existingInput) {
                formElement.removeChild(existingInput);
            }

            const audioInput = document.createElement('input');
            audioInput.type = 'hidden';
            audioInput.name = 'audio';
            
            // Convert the Blob into a File object for submission
            const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
            
            // Use DataTransfer to simulate file upload (required for modern JS form submission with files)
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            audioInput.files = dataTransfer.files;

            formElement.appendChild(audioInput);
            
            statusDiv.textContent = 'Recording ready. Click Submit/Sign Up.';
        };

        mediaRecorder.start();
        statusDiv.textContent = 'Recording... Speak your phrase now.';
        button.disabled = true;
        document.querySelector(`#${currentFormId} .stop-btn`).disabled = false;
    }

    function stopRecording(button, recordButton) {
        mediaRecorder.stop();
        button.disabled = true;
        recordButton.disabled = false;
    }

    recordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const formId = btn.dataset.form;
            const statusDiv = document.querySelector(`#${formId} .status-message`);
            startRecording(btn, statusDiv);
        });
    });

    stopButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const formId = btn.dataset.form;
            const recordButton = document.querySelector(`#${formId} .record-btn`);
            stopRecording(btn, recordButton);
        });
    });

});
