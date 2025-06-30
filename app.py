import os
import json
import gspread
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
  """Helper function to convert credentials to a JSON serializable dict."""
  return {'token': credentials.token,
          'refresh_token': credentials.refresh_token,
          'token_uri': credentials.token_uri,
          'client_id': credentials.client_id,
          'client_secret': credentials.client_secret,
          'scopes': credentials.scopes}

def get_gspread_client():
    """সেশনে থাকা ক্রেডেনশিয়াল ব্যবহার করে gspread ক্লায়েন্ট অথোরাইজ করে।"""
    if 'credentials' not in session:
        return None
    
    creds_dict = session['credentials']
    creds = Credentials.from_authorized_user_info(creds_dict)
    
    # gspread কে অথোরাইজ করা
    gc = gspread.authorize(creds)
    
    # ক্রেডেনশিয়াল রিফ্রেশ হলে সেশনে আপডেট করা
    session['credentials'] = credentials_to_dict(creds)
    
    return gc

def get_worksheet():
    """Kaza Tracker Data নামে স্প্রেডশীট খুঁজে বের করে বা তৈরি করে এবং ওয়ার্কশীট রিটার্ন করে।"""
    gc = get_gspread_client()
    if not gc:
        return None
        
    spreadsheet_title = "Kaza Tracker Data"
    try:
        # স্প্রেডশীটটি খোঁজা হচ্ছে
        sh = gc.open(spreadsheet_title)
    except gspread.exceptions.SpreadsheetNotFound:
        # না পাওয়া গেলে, নতুন করে তৈরি করা হচ্ছে
        sh = gc.create(spreadsheet_title)
        # এবং আপনার (ডেভেলপার) গুগল একাউন্টের সাথে শেয়ার করা হচ্ছে (ঐচ্ছিক)
        sh.share('huzaifahossainriyad@gmail.com', perm_type='user', role='writer')
        
    worksheet = sh.sheet1
    
    # ওয়ার্কশীটে হেডার আছে কিনা তা পরীক্ষা করা
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
    return render_template('index.html')

@app.route('/login')
def login():
    flow = Flow.from_client_secrets_file(
        'client_secret.json',
        scopes=SCOPES,
        redirect_uri=url_for('callback', _external=True)
    )
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    session['state'] = state
    return redirect(authorization_url)

@app.route('/callback')
def callback():
    state = session.get('state')
    flow = Flow.from_client_secrets_file(
        'client_secret.json', scopes=SCOPES, state=state,
        redirect_uri=url_for('callback', _external=True)
    )
    flow.fetch_token(authorization_response=request.url)
    
    credentials = flow.credentials
    # ব্যবহারকারীর নাম ও ইমেইল সেশনে সেভ করা
    session['credentials'] = credentials_to_dict(credentials)
    
    # gspread ক্লায়েন্ট ব্যবহার করে নাম ও ইমেইল নেওয়া (বিকল্প পদ্ধতি)
    # gc = gspread.authorize(credentials)
    # session['user_email'] = gc.auth.user_info['email']
    # session['user_name'] = gc.auth.user_info.get('name', 'User')

    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# --- API Endpoints for Kaza Data ---

@app.route('/get_kaza_data')
def get_kaza_data():
    if 'credentials' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
        
    worksheet = get_worksheet()
    if not worksheet:
        return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
        
    records = worksheet.get_all_records()
    return jsonify({'status': 'success', 'data': records})

@app.route('/save_kaza_data', methods=['POST'])
def save_kaza_data():
    if 'credentials' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
        
    worksheet = get_worksheet()
    if not worksheet:
        return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
        
    data = request.json
    # ['Date', 'Prayers Completed', 'Remaining After', 'Note']
    row_to_add = [
        data.get('date'),
        data.get('completed'),
        data.get('remaining'),
        data.get('note', '') # নোট ঐচ্ছিক
    ]
    
    worksheet.append_row(row_to_add)
    
    return jsonify({'status': 'success', 'message': 'Data saved to Google Sheet.'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
