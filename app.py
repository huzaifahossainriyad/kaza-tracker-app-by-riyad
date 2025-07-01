import os
import json
import gspread
import requests
import datetime
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
  return {'token': credentials.token, 'refresh_token': credentials.refresh_token, 'token_uri': credentials.token_uri, 'client_id': credentials.client_id, 'client_secret': credentials.client_secret, 'scopes': credentials.scopes}

def get_gspread_client():
    """সেশনে থাকা ক্রেডেনশিয়াল ব্যবহার করে gspread ক্লায়েন্ট অথোরাইজ করে।"""
    if 'credentials' not in session: return None
    creds = Credentials.from_authorized_user_info(session['credentials'])
    gc = gspread.authorize(creds)
    session['credentials'] = credentials_to_dict(creds) # রিফ্রেশ হলে সেশন আপডেট করার জন্য
    return gc

def get_worksheet():
    """Kaza Tracker Data নামে স্প্রেডশীট খুঁজে বের করে বা তৈরি করে এবং নতুন হেডার সেট করে।"""
    gc = get_gspread_client()
    if not gc:
        return None
        
    spreadsheet_title = "Kaza Tracker Data"
    try:
        sh = gc.open(spreadsheet_title)
    except gspread.exceptions.SpreadsheetNotFound:
        user_email = session.get('user_email')
        sh = gc.create(spreadsheet_title)
        if user_email:
            sh.share(user_email, perm_type='user', role='writer')

    worksheet = sh.sheet1
    
    # ফিচার ১৬: নোটের সাথে ট্যাগ যুক্ত করার জন্য নতুন হেডার
    new_headers = [
        "Date", "Note", "Tags", "Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Witr",
        "FajrSunnah", "DhuhrSunnah", "AsrSunnah", "MaghribSunnah", "IshaSunnah"
    ]
    
    # হেডার চেক করা এবং না থাকলে বা ভুল থাকলে নতুন করে সেট করা
    if not worksheet.get_all_values() or worksheet.row_values(1) != new_headers:
        worksheet.clear()
        worksheet.append_row(new_headers)
        worksheet.format('A1:N1', {'textFormat': {'bold': True}})

    return worksheet

# --- Flask Routes ---

@app.route('/')
def index():
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

    try:
        userinfo_endpoint = 'https://www.googleapis.com/oauth2/v3/userinfo'
        userinfo_response = requests.get(userinfo_endpoint, headers={'Authorization': f'Bearer {credentials.token}'})
        userinfo = userinfo_response.json()
        
        session['user_name'] = userinfo.get('name', 'User')
        session['user_email'] = userinfo.get('email')

    except Exception as e:
        print(f"Error fetching user info: {e}")
        session['user_name'] = 'User'

    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# --- API Endpoints ---

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
    
    # ফিচার ১৬: ট্যাগ সহ ডেটা প্রস্তুত করা
    row_to_add = [
        data.get('date', ''),
        data.get('note', ''),
        data.get('tags', ''), # নতুন ট্যাগ ফিল্ড
        data.get('Fajr', 0), data.get('Dhuhr', 0), data.get('Asr', 0),
        data.get('Maghrib', 0), data.get('Isha', 0), data.get('Witr', 0),
        data.get('FajrSunnah', 0), data.get('DhuhrSunnah', 0), data.get('AsrSunnah', 0),
        data.get('MaghribSunnah', 0), data.get('IshaSunnah', 0)
    ]
    
    worksheet.append_row(row_to_add)
    return jsonify({'status': 'success', 'message': 'Data saved to Google Sheet.'})

@app.route('/get_prayer_times')
def get_prayer_times():
    city = request.args.get('city', 'Dhaka')
    country = request.args.get('country', 'Bangladesh')
    
    try:
        today = datetime.date.today().strftime("%d-%m-%Y")
        url = f"http://api.aladhan.com/v1/timingsByCity/{today}?city={city}&country={country}&method=1"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if data.get("code") == 200:
            data['data']['location'] = {'city': city, 'country': country}
        
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prayer times: {e}")
        return jsonify({"code": 500, "status": "error", "message": "Could not fetch prayer times"}), 500

@app.route('/delete_kaza_log', methods=['POST'])
def delete_kaza_log():
    if 'credentials' not in session: return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    worksheet = get_worksheet()
    if not worksheet: return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
    
    data = request.json
    row_id_to_delete = data.get('row_id')

    if not row_id_to_delete: return jsonify({'status': 'error', 'message': 'Row ID is missing.'}), 400

    try:
        worksheet.delete_rows(int(row_id_to_delete) + 1)
        return jsonify({'status': 'success', 'message': 'Log deleted successfully.'})
    except Exception as e:
        print(f"Error deleting row: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to delete log from Google Sheet.'}), 500

@app.route('/update_kaza_log', methods=['POST'])
def update_kaza_log():
    if 'credentials' not in session: return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    worksheet = get_worksheet()
    if not worksheet: return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
    
    data = request.json
    row_id = data.get('row_id')
    updated_data = data.get('updated_data')

    if not row_id or not updated_data: return jsonify({'status': 'error', 'message': 'Required data is missing.'}), 400

    try:
        # ফিচার ১৬: ট্যাগ সহ ডেটা আপডেট করা
        row_to_update = [
            updated_data.get('Date', ''),
            updated_data.get('Note', ''),
            updated_data.get('Tags', ''), # নতুন ট্যাগ ফিল্ড
            updated_data.get('Fajr', 0), updated_data.get('Dhuhr', 0), updated_data.get('Asr', 0),
            updated_data.get('Maghrib', 0), updated_data.get('Isha', 0), updated_data.get('Witr', 0),
            updated_data.get('FajrSunnah', 0), updated_data.get('DhuhrSunnah', 0), updated_data.get('AsrSunnah', 0),
            updated_data.get('MaghribSunnah', 0), updated_data.get('IshaSunnah', 0)
        ]
        
        cell_range = f'A{int(row_id) + 1}:N{int(row_id) + 1}' # রেঞ্জ N পর্যন্ত বাড়ানো হয়েছে
        worksheet.update(cell_range, [row_to_update])
        
        return jsonify({'status': 'success', 'message': 'Log updated successfully.'})
    except Exception as e:
        print(f"Error updating row: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to update log in Google Sheet.'}), 500

# ফিচার ১৮: ডেটা ইমপোর্ট করার জন্য নতুন API এন্ডপয়েন্ট
@app.route('/import_kaza_data', methods=['POST'])
def import_kaza_data():
    if 'credentials' not in session: return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    worksheet = get_worksheet()
    if not worksheet: return jsonify({'status': 'error', 'message': 'Could not connect to Google Sheets.'}), 500
    
    logs_to_import = request.json.get('data')
    if not logs_to_import: return jsonify({'status': 'error', 'message': 'No data to import.'}), 400

    try:
        rows_to_append = []
        for log in logs_to_import:
            row = [
                log.get('Date', ''), log.get('Note', ''), log.get('Tags', ''),
                log.get('Fajr', 0), log.get('Dhuhr', 0), log.get('Asr', 0),
                log.get('Maghrib', 0), log.get('Isha', 0), log.get('Witr', 0),
                log.get('FajrSunnah', 0), log.get('DhuhrSunnah', 0), log.get('AsrSunnah', 0),
                log.get('MaghribSunnah', 0), log.get('IshaSunnah', 0)
            ]
            rows_to_append.append(row)
        
        worksheet.append_rows(rows_to_append)
        return jsonify({'status': 'success', 'message': f'{len(rows_to_append)} logs imported successfully.'})
    except Exception as e:
        print(f"Error importing data: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to import data to Google Sheet.'}), 500

# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)
