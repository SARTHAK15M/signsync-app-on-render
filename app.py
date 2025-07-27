# C:\Users\Sarthak\Desktop\SignSyncProject\app.py

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import speech_recognition as sr
import io
from pydub import AudioSegment
import os
import tempfile
import random

app = Flask(__name__, static_folder='static', static_url_path='/static')

CORS(app)

r = sr.Recognizer()

# --- FFmpeg Path Configuration for pydub ---
try:
    AudioSegment.converter = os.environ.get('FFMPEG_PATH', 'ffmpeg')
    print(f"Pydub converter attempting to use system PATH or env var: {AudioSegment.converter}")
except Exception as e:
    print(f"CRITICAL ERROR SETTING Pydub converter: {e}")
    print("Ensure FFmpeg is installed and accessible in the system PATH on your deployment environment.")

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    if 'audio_data' not in request.files:
        return jsonify({"error": "No audio_data file part in the request"}), 400

    audio_file = request.files['audio_data']

    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    audio_bytes = audio_file.read()
    print(f"Received audio stream length (bytes): {len(audio_bytes)}")

    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio_file:
            temp_audio_file.write(audio_bytes)
            temp_file_path = temp_audio_file.name

        print(f"Saved received audio to temporary file: {temp_file_path}")

        print("Attempting to load audio with pydub FROM TEMP FILE (WebM)...")
        audio_segment = AudioSegment.from_file(temp_file_path, format="webm")

        print("Attempting to export to WAV for SpeechRecognition...")
        wav_stream = io.BytesIO()
        audio_segment.export(wav_stream, format="wav")
        wav_stream.seek(0)

    except Exception as e:
        print(f"Pydub audio conversion failed (via temp file): {e}")
        return jsonify({"error": f"Audio conversion failed on backend: {e}"}), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            print(f"Cleaned up temporary file: {temp_file_path}")

    try:
        with sr.AudioFile(wav_stream) as source:
            print("Reading WAV audio for recognition with SpeechRecognition...")
            audio = r.record(source)

        print("Attempting to recognize speech using Sphinx...")
        text = r.recognize_sphinx(audio)
        print(f"Recognized text (Sphinx): '{text}'")

        return jsonify({"message": "Audio processed successfully with Sphinx!", "transcribed_text": text}), 200

    except sr.UnknownValueError:
        print("Sphinx Speech Recognition could not understand audio")
        return jsonify({"error": "Sphinx could not understand audio. Please speak clearly."}), 400
    except sr.RequestError as e:
        print(f"Could not request results from Sphinx service; {e}")
        return jsonify({"error": f"Sphinx service communication error: {e}"}), 500
    except Exception as e:
        print(f"An unexpected error occurred during Sphinx recognition: {e}")
        return jsonify({"error": f"An unexpected error occurred during speech recognition: {e}"}), 500

@app.route('/get_random_asl_videos')
def get_random_asl_videos():
    asl_video_dir = os.path.join(app.root_path, 'static', 'asl_videos')

    if not os.path.exists(asl_video_dir):
        print("ASL videos directory not found:", asl_video_dir)
        return jsonify({"error": "ASL videos directory not found. Please ensure 'static/asl_videos' exists and is correctly placed."}), 500

    all_videos = [f for f in os.listdir(asl_video_dir) if f.endswith('.mp4')]

    if not all_videos:
        print("No ASL videos found in the directory:", asl_video_dir)
        return jsonify({"error": "No ASL videos found in the 'static/asl_videos' directory. Please add MP4 files."}), 500

    num_videos_to_select = random.randint(2, min(3, len(all_videos)))
    random_videos = random.sample(all_videos, num_videos_to_select)

    video_urls = [f'/static/asl_videos/{video}' for video in random_videos]

    print(f"Serving random ASL videos: {video_urls}")
    return jsonify({"videos": video_urls})


if __name__ == '__main__':
    print("\n--- Running Flask App in LOCAL DEVELOPMENT Mode ---")
    print("WARNING: Do NOT use this for production deployment. Use a WSGI server like Gunicorn.")
    app.run(debug=True, port=5001)