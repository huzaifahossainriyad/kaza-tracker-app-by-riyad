import os
import json
from flask import Flask, redirect, url_for, session, request, render_template
from google_auth_oauthlib.flow import Flow

# এই লাইনটি লোকাল কম্পিউটারে টেস্টিং এর জন্য খুবই জরুরি
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
# একটি শক্তিশালী এবং ইউনিক সিক্রেট কী ব্যবহার করা হলো
app.secret_key = 'kaza-tracker-riyad-huzaifa-super-secret-key'

# Google API এর জন্য স্কোপ
SCOPES = ['https://www.googleapis.com/auth/drive.file', 
          'https://www.googleapis.com/auth/userinfo.email', 
          'https://www.googleapis.com/auth/userinfo.profile', 
          'openid',
          'https://www.googleapis.com/auth/spreadsheets']

@app.route('/')
def index():
    # সেশনে 'credentials' আছে কিনা তা পরীক্ষা করা হচ্ছে
    if 'credentials' in session:
        # যদি থাকে, তাহলে ব্যবহারকারী লগইন করা আছে
        return render_template('index.html')
    else:
        # যদি না থাকে, তাহলে তাকে হোমপেজ দেখানো হবে যেখানে লগইন বাটন থাকবে
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
    session['credentials'] = credentials_to_dict(credentials)

    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

def credentials_to_dict(credentials):
  """Helper function to convert credentials to a JSON serializable dict."""
  return {'token': credentials.token,
          'refresh_token': credentials.refresh_token,
          'token_uri': credentials.token_uri,
          'client_id': credentials.client_id,
          'client_secret': credentials.client_secret,
          'scopes': credentials.scopes}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
