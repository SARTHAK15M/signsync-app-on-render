// C:\Users\Sarthak\Desktop\SignSyncProject\static\js\script.js

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const audioPlayer = document.getElementById('audioPlayer');
const audioPlayerMessage = document.getElementById('audioPlayerMessage');
const aslVideoPlayerElement = document.getElementById('aslVideoPlayer');
const aslMessageElement = document.getElementById('aslMessage');

let mediaRecorder;
let audioChunks = [];
let videoQueue = [];
let currentVideoIndex = 0;
let loopTimeoutId;

function playNextVideo() {
    if (videoQueue.length === 0) {
        aslMessageElement.textContent = 'No random videos available. Please add MP4s to static/asl_videos.';
        aslVideoPlayerElement.src = '';
        aslVideoPlayerElement.style.display = 'none';
        return;
    }

    if (currentVideoIndex < videoQueue.length) {
        const videoUrl = videoQueue[currentVideoIndex];
        aslVideoPlayerElement.src = videoUrl;
        aslVideoPlayerElement.style.display = 'block';
        aslVideoPlayerElement.play();
        aslMessageElement.textContent = '';
        currentVideoIndex++;
    } else {
        currentVideoIndex = 0;
        playNextVideo();
    }
}

aslVideoPlayerElement.addEventListener('ended', playNextVideo);

startButton.addEventListener('click', async () => {
    try {
        if (loopTimeoutId) {
            clearTimeout(loopTimeoutId);
        }
        aslVideoPlayerElement.pause();
        aslVideoPlayerElement.src = '';
        aslVideoPlayerElement.style.display = 'none';
        aslMessageElement.textContent = 'Recording...';

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        audioChunks = [];
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            audioPlayerMessage.textContent = 'Recording finished. Click play above to listen.';

            try {
                const formData = new FormData();
                formData.append('audio_data', audioBlob, 'recording.webm');

                aslMessageElement.textContent = "Processing speech...";
                aslVideoPlayerElement.style.display = 'none';

                // Using RELATIVE path as frontend & backend are on the same Render service
                const response = await fetch('/upload_audio', { 
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Backend response (transcribed text - hidden):', data.transcribed_text);

                    try {
                        aslMessageElement.textContent = "Loading signs...";
                        // Using RELATIVE path as frontend & backend are on the same Render service
                        const randomVideosResponse = await fetch('/get_random_asl_videos');

                        if (randomVideosResponse.ok) {
                            const randomVideosData = await randomVideosResponse.json();
                            videoQueue = randomVideosData.videos;
                            currentVideoIndex = 0;

                            if (videoQueue.length > 0) {
                                playNextVideo();
                                aslMessageElement.textContent = 'Translation successful!';
                            } else {
                                aslMessageElement.textContent = 'No random videos found. Please add MP4s to static/asl_videos.';
                                aslVideoPlayerElement.src = '';
                                aslVideoPlayerElement.style.display = 'none';
                            }

                        } else {
                            const errorData = await randomVideosResponse.json();
                            aslMessageElement.textContent = `Error loading signs: ${errorData.error}`;
                            aslVideoPlayerElement.src = '';
                            aslVideoPlayerPlayer.style.display = 'none';
                            console.error('Error fetching random ASL videos:', errorData.error);
                        }
                    } catch (videoError) {
                        aslMessageElement.textContent = `Network error loading signs: ${videoError.message}`;
                        aslVideoPlayerElement.src = '';
                        aslVideoPlayerElement.style.display = 'none';
                        console.error('Network or other error fetching random ASL videos:', videoError);
                    }

                } else {
                    const errorData = await response.json();
                    console.error('Backend error:', errorData.error);
                    aslMessageElement.textContent = `Error processing audio: ${errorData.error}`;
                    aslVideoPlayerElement.src = '';
                    aslVideoPlayerElement.style.display = 'none';
                }
            } catch (error) {
                console.error('Error during fetch:', error);
                aslMessageElement.textContent = `Network error: ${error.message}`;
                aslVideoPlayerElement.src = '';
                aslVideoPlayerElement.style.display = 'none';
            } finally {
                startButton.disabled = false;
                stopButton.disabled = true;
            }
        };

        mediaRecorder.start();
        startButton.disabled = true;
        stopButton.disabled = false;
        audioPlayerMessage.textContent = 'Recording...';
        audioPlayer.src = '';
        aslVideoPlayerElement.src = '';
        aslVideoPlayerElement.style.display = 'none';

    } catch (err) {
        console.error('Error accessing microphone:', err);
        aslMessageElement.textContent = `Error accessing microphone: ${err.message}`;
        startButton.disabled = false;
        stopButton.disabled = true;
    }
});

stopButton.addEventListener('click', () => {
    mediaRecorder.stop();
});

window.onload = () => {
    startButton.disabled = false;
    stopButton.disabled = true;
    aslVideoPlayerElement.style.display = 'none';
    aslMessageElement.textContent = 'Click "Start Recording" to begin.';
};