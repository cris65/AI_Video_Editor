import os
import sys
import requests
import cv2
from moviepy import VideoFileClip
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
FRAME_IO_TOKEN = os.getenv("FRAME_IO_TOKEN")

if not all([SUPABASE_URL, SUPABASE_KEY, FRAME_IO_TOKEN]):
    print("Error: Missing required environment variables. Check .env file.")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')

def ensure_output_dir():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

def update_task_status(task_id: str, status: str):
    try:
        supabase.table('video_tasks').update({'status': status}).eq('id', task_id).execute()
        print(f"Task {task_id} status updated to: {status}")
    except Exception as e:
        print(f"Failed to update task status in DB: {str(e)}")

def download_frameio_proxy(asset_id: str, dest_path: str) -> bool:
    print(f"Fetching proxy for Frame.io asset: {asset_id}")
    url = f"https://api.frame.io/v2/assets/{asset_id}"
    headers = {
        "Authorization": f"Bearer {FRAME_IO_TOKEN}"
    }
    
    try:
        # Get asset details to find the proxy URL
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        asset_data = response.json()
        
        # We look for the h264 proxy usually found in coverages/h264_1080 or similar
        downloads = asset_data.get('downloads', {})
        h264_url = downloads.get('h264_1080') or downloads.get('h264_720') or downloads.get('h264_360')
        
        if not h264_url:
            print("Error: Could not find H.264 proxy URL for asset.")
            return False
            
        print("Downloading proxy video...")
        vid_response = requests.get(h264_url, stream=True)
        vid_response.raise_for_status()
        
        with open(dest_path, 'wb') as f:
            for chunk in vid_response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        print("Download completed.")
        return True
    except Exception as e:
        print(f"Error downloading from Frame.io: {str(e)}")
        return False

def process_video(task: dict):
    task_id = task['id']
    asset_id = task['frame_io_asset_id']
    start_sec = task['start_sec']
    end_sec = task['end_sec']
    
    print(f"Processing task {task_id}...")
    
    ensure_output_dir()
    
    input_vid_path = os.path.join(OUTPUT_DIR, f"input_{task_id}.mp4")
    output_vid_path = os.path.join(OUTPUT_DIR, f"output_{task_id}.mp4")
    thumb_path = os.path.join(OUTPUT_DIR, f"thumb_{task_id}.jpg")
    
    try:
        # 1. Download or use local file
        if os.path.exists(input_vid_path):
            print(f"🎬 File locale trovato ({input_vid_path}). Salto il download dalle API bloccate!")
        else:
            success = download_frameio_proxy(asset_id, input_vid_path)
            if not success:
                print(f"\n⚠️ L'API di Frame.io è bloccata. Per testare l'engine, scarica il video manualmente e salvalo come:\n👉 {input_vid_path}\nE poi rilancia questo script!\n")
                raise Exception("Failed to download proxy from Frame.io")
            
        # 2. Edit with MoviePy
        print(f"Cutting video from {start_sec}s to {end_sec}s...")
        with VideoFileClip(input_vid_path) as video:
            edited = video.subclip(start_sec, end_sec)
            edited.write_videofile(output_vid_path, codec="libx264", audio_codec="aac", logger=None)
            
        # 3. Extract Thumbnail with OpenCV
        print("Extracting thumbnail...")
        cap = cv2.VideoCapture(output_vid_path)
        # Read the first frame
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(thumb_path, frame)
        cap.release()
        
        # Cleanup input file
        if os.path.exists(input_vid_path):
            os.remove(input_vid_path)
            
        print(f"Processing complete! Outputs saved to {OUTPUT_DIR}")
        
        # 4. Mark Completed
        update_task_status(task_id, 'completed')
        
    except Exception as e:
        print(f"Error during video processing: {str(e)}")
        update_task_status(task_id, 'failed')

def main():
    try:
        # Fetch first pending task
        response = supabase.table('video_tasks').select('*').eq('status', 'pending').limit(1).execute()
        tasks = response.data
        
        if not tasks:
            print("No pending tasks found. Exiting cleanly.")
            sys.exit(0)
            
        task = tasks[0]
        process_video(task)
        
    except Exception as e:
        print(f"Database connection or fetch error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
