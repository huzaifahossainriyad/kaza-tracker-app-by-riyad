import os
import json
import gspread
import requests # নতুন ইম্পোর্ট
import datetime # নতুন ইম্পোর্ট
from flask import Flask, redirect, url_for, session, request, render_template, jsonify
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

# লোকাল কম্পিউটারে টেস্টিং এর জন্য
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = 'kaza-tracker-riyad-huzaifa-super-secret-key'

# Google API এর জন্য স্কোপ
SCOPES = ['https://www.googleapis.com/auth/drive.file', 
          'https://www.googleapis.com/auth/userinfo.email', 
          'https://www.googleapis.com/auth/userinfo.profile', 
          'openid',
          'https://www.googleapis.com/auth/spreadsheets']

# --- Helper Functions ---

def credentials_to_dict(credentials):
  return {'token': credentials.token, 'refresh_token': credentials.refresh_token, 'token_uri': credentials.token_uri, 'client_id': credentials.client_id, 'client_secret': credentials.client_secret, 'scopes': credentials.scopes}

def get_gspread_client():
    if 'credentials' not in session: return None
    creds = Credentials.from_authorized_user_info(session['credentials'])
    gc = gspread.authorize(creds)
    session['credentials'] = credentials_to_dict(creds)
    return gc

def get_worksheet():
    gc = get_gspread_client()
    if not gc: return None
    spreadsheet_title = "Kaza Tracker Data"
    try:
        sh = gc.open(spreadsheet_title)
    except gspread.exceptions.SpreadsheetNotFound:
        sh = gc.create(spreadsheet_title)
        sh.share('huzaifahossainriyad@gmail.com', perm_type='user', role='writer')
    worksheet = sh.sheet1
    if not worksheet.get_all_values() or worksheet.row_values(1) != ["Date", "Prayers Completed", "Remaining After", "Note"]:
        worksheet.clear()
        worksheet.append_row(["Date", "Prayers Completed", "Remaining After", "Note"])
        worksheet.format('A1:D1', {'textFormat': {'bold': True}})
    return worksheet

# --- Flask Routes ---

@app.route('/')
def index():
    if 'credentials' not in session:
        return redirect(url_for('login'))
    
    # ইউজারনেম সেশনে সেভ করার জন্য
    if 'user_name' not in session:
        try:
            gc = get_gspread_client()
            if gc:
                session['user_name'] = gc.auth.user_info.get('name', 'User')
        except Exception as e:
            print(f"Could not fetch user name: {e}")
            session['user_name'] = 'User'

    return render_template('index.html')


@app.route('/login')
def login():
    flow = Flow.from_client_secrets_file('client_secret.json', scopes=SCOPES, redirect_uri=url_for('callback', _external=True))
    authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true', prompt='consent')
    session['state'] = state
    return redirect(authorization_url)

@app.route('/callback')
def callback():
    state = session.get('state')
    flow = Flow.from_client_secrets_file('client_secret.json', scopes=SCOPES, state=state, redirect_uri=url_for('callback', _external=True))
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    session['credentials'] = credentials_to_dict(credentials)
    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# --- API Endpoints for Kaza Data ---

@app.route('/get_kaza_data')
def get_kaza_data():
    if 'credentials' not in session: return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    worksheet = get_worksheet()
    if not worksheet: return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
    records = worksheet.get_all_records()
    return jsonify({'status': 'success', 'data': records})

@app.route('/save_kaza_data', methods=['POST'])
def save_kaza_data():
    if 'credentials' not in session: return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    worksheet = get_worksheet()
    if not worksheet: return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
    data = request.json
    row_to_add = [data.get('date'), data.get('completed'), data.get('remaining'), data.get('note', '')]
    worksheet.append_row(row_to_add)
    return jsonify({'status': 'success', 'message': 'Data saved to Google Sheet.'})

# =================================================================
# ############# নিচের অংশটুকু নতুন যোগ করা হয়েছে #############
# =================================================================

@app.route('/get_prayer_times')
def get_prayer_times():
    # আপাতত আমরা ঢাকা, বাংলাদেশ ডিফল্ট হিসেবে ব্যবহার করছি।
    # ভবিষ্যতে এটি ব্যবহারকারীর লোকেশন অনুযায়ী পরিবর্তন করা যাবে।
    city = 'Dhaka'
    country = 'Bangladesh'
    
    try:
        url = f"http://api.aladhan.com/v1/timingsByCity?city={city}&country={country}&method=1"
        response = requests.get(url)
        response.raise_for_status()  # এরর থাকলে exception তৈরি করবে
        
        data = response.json()
        return jsonify(data)
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prayer times: {e}")
        return jsonify({"status": "error", "message": "Could not fetch prayer times"}), 500

# =================================================================
# ############# নতুন কোড এই পর্যন্ত #############
# =================================================================

if __name__ == '__main__':
    app.run(debug=True, port=5000)

