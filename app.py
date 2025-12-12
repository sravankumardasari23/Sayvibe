from flask import Flask, render_template, request, redirect, url_for, session, flash
import sqlite3
import os
import numpy as np
import librosa
import soundfile as sf
import random

# --- FLASK SETUP & CONFIGURATION ---
app = Flask(__name__)
# IMPORTANT: Change this key to a complex, secret string in a production environment
app.secret_key = "voice_secret_key" 

UPLOAD_FOLDER = "uploads"
# Ensure the uploads directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

DB_PATH = "database.db"


# --- FUN PHRASES (For Success and Failure) ---
PHRASES_SUCCESS = [
    "You sound perfect! Welcome aboard! 🎉",
    "Spot on! Voice verified and you're in! 😎",
    "Hello superstar! You made it! Time to shine!",
    "Your voice unlocks the dashboard! Access granted!",
    "Awesome tone! Voice approved!",
    "Success! Your voiceprint is unique!",
    "Ahoy, Captain! Welcome back to the treasure chest!",
    "That was quick! You're logged in!",
    "Voice match achieved! Proceed to fun!",
    "The system loves your voice! Welcome!",
]

PHRASES_FAIL = [
    "Hmm... try again, superstar! Was that your evil twin?",
    "Voice did not match. Keep going, you’ll get it!",
    "Not quite! Are you a secret agent? Try your phrase again.",
    "Almost there! Maybe speak a little louder next time?",
    "Oops! Try to match the recording phrase exactly.",
    "Verification failed. Don't give up!",
    "Sound check failed! Let's hear it one more time.",
    "The voice print is blurry. Please speak clearly.",
    "The microphone caught static. Try re-recording!",
    "Intruder alert! Just kidding. Try the passphrase again.",
]


# --- DATABASE INITIALIZATION ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # CRITICAL: Added the four survey columns (tool, trend, color, recharge)
    c.execute("""CREATE TABLE IF NOT EXISTS users (
                 username TEXT PRIMARY KEY,
                 voice_file TEXT,
                 tool TEXT,       
                 trend TEXT,      
                 color TEXT,      
                 recharge TEXT
                 )""")
    conn.commit()
    conn.close()

# Initialize the database structure on startup
init_db()


# --- VOICE FEATURE EXTRACTION AND MATCHING ---
def extract_features(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        # Load audio using librosa
        y, sr = librosa.load(file_path, sr=None)
        # Extract MFCCs (13 coefficients)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        # Return the mean of the MFCCs across all frames
        return np.mean(mfccs.T, axis=0)
    except Exception as e:
        print(f"Error extracting features from {file_path}: {e}")
        return None

def match_voice(file1, file2, threshold=0.4):
    f1 = extract_features(file1)
    f2 = extract_features(file2)
    
    if f1 is None or f2 is None:
        return False
        
    # Calculate Euclidean distance between the feature vectors
    dist = np.linalg.norm(f1 - f2)
    # Match is successful if the distance is below the threshold
    return dist < threshold


# --- FLASK ROUTES ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        audio_blob = request.files.get('audio')
        
        if not username or not audio_blob:
            flash(random.choice(PHRASES_FAIL) + " (Missing input)")
            return redirect(url_for('signup'))
        
        # 1. Save the received webm audio blob temporarily
        temp_audio_path = os.path.join(app.config['UPLOAD_FOLDER'], username + "_temp.webm")
        audio_blob.save(temp_audio_path)
        
        final_wav_path = os.path.join(app.config['UPLOAD_FOLDER'], username + ".wav")
        
        try:
            # 2. Convert webm to wav (required by librosa for stable feature extraction)
            y, sr = librosa.load(temp_audio_path, sr=None)
            sf.write(final_wav_path, y, sr)
            
            # 3. Save user info and voice file path to DB
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO users (username, voice_file) VALUES (?,?)", (username, final_wav_path))
            conn.commit()
            conn.close()
            
            # 4. Cleanup temporary file
            os.remove(temp_audio_path)
            
            flash("Signup successful! Try logging in now.")
            return redirect(url_for('login'))
        
        except Exception as e:
            flash(f"Error processing audio: Try again! ({e})")
            # Cleanup on failure
            if os.path.exists(temp_audio_path): os.remove(temp_audio_path)
            if os.path.exists(final_wav_path): os.remove(final_wav_path)
            return redirect(url_for('signup'))

    return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        audio_blob = request.files.get('audio')
        
        if not username or not audio_blob:
            flash(random.choice(PHRASES_FAIL) + " (Missing input)")
            return redirect(url_for('login'))

        # 1. Fetch saved voiceprint file path
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT voice_file FROM users WHERE username=?", (username,))
        row = c.fetchone()
        conn.close()
        
        if row:
            saved_voice_path = row[0]
            temp_path_webm = os.path.join(app.config['UPLOAD_FOLDER'], "temp_login.webm")
            temp_path_wav = os.path.join(app.config['UPLOAD_FOLDER'], "temp_login.wav")
            audio_blob.save(temp_path_webm)
            
            try:
                # 2. Convert login audio to wav for matching
                y, sr = librosa.load(temp_path_webm, sr=None)
                sf.write(temp_path_wav, y, sr)
                
                # 3. Perform voice verification
                if match_voice(saved_voice_path, temp_path_wav):
                    session['username'] = username
                    feedback_message = random.choice(PHRASES_SUCCESS)
                    flash(feedback_message)
                    
                    # Cleanup temp files
                    if os.path.exists(temp_path_webm): os.remove(temp_path_webm)
                    if os.path.exists(temp_path_wav): os.remove(temp_path_wav)

                    return redirect(url_for('dashboard'))
                else:
                    feedback_message = random.choice(PHRASES_FAIL)
                    flash(feedback_message)
                
            except Exception as e:
                feedback_message = f"Error processing audio: Try again! ({e})"
                flash(feedback_message)
            
            # Final cleanup
            if os.path.exists(temp_path_webm): os.remove(temp_path_webm)
            if os.path.exists(temp_path_wav): os.remove(temp_path_wav)
            
        else:
            feedback_message = random.choice(PHRASES_FAIL) + " (Username not found)"
            flash(feedback_message)
            
        return redirect(url_for('login'))
        
    return render_template('login.html')

@app.route('/submit_survey', methods=['POST'])
def submit_survey():
    if 'username' not in session:
        flash("Please log in first.")
        return redirect(url_for('login'))
        
    username = session['username']
    
    # Get answers from the submitted form (4 questions total)
    tool = request.form.get('tool')
    trend = request.form.get('trend')
    color = request.form.get('color')
    recharge = request.form.get('recharge') 

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # CRITICAL FIX APPLIED: Ensure the variable list matches the placeholders
    c.execute("""UPDATE users SET tool=?, trend=?, color=?, recharge=?
                 WHERE username=?""", 
              (tool, trend, color, recharge, username))
    conn.commit()
    conn.close()
    
    flash("Thank you for sharing your insights! Your voice data is now complete.")
    return redirect(url_for('dashboard'))


@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('login'))
    
    username = session['username']
    
    # 1. Get the latest flash message for TTS speaking
    flashed_messages = session.get('_flashes', [])
    last_message = flashed_messages[-1][1] if flashed_messages and flashed_messages[-1][0] == 'message' else ""

    # 2. Fetch survey results
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Fetch all four survey columns
    c.execute("SELECT tool, trend, color, recharge FROM users WHERE username=?", (username,))
    results = c.fetchone()
    conn.close()
    
    # Check if survey has been completed (if the first column is not null)
    survey_complete = bool(results and results[0])
    user_survey = {
        'tool': results[0],
        'trend': results[1],
        'color': results[2],
        'recharge': results[3]
    } if survey_complete else None
    
    return render_template('dashboard.html', 
                           username=username, 
                           login_message=last_message, 
                           survey_complete=survey_complete,
                           user_survey=user_survey)


@app.route('/logout')
def logout():
    session.pop('username', None)
    flash("Logged out. We hope your voice rests well!")
    return redirect(url_for('index'))


# --- APPLICATION RUNNER (For Heroku Deployment) ---
if __name__ == '__main__':
    # CRITICAL: This ensures the application binds to the port provided by Heroku
    port = int(os.environ.get("PORT", 5000)) 
    app.run(host='0.0.0.0', port=port)
