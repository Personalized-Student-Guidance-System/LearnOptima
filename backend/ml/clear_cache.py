
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

# Load env from parent dir
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

def clear_cache():
    uri = os.environ.get("MONGO_URI", "")
    if not uri:
        print("MONGO_URI not set. Nothing to clear.")
        return

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        db = client["learnoptima"]
        
        # Clear roadmap cache
        res = db["roadmap_cache_v5"].delete_many({})
        print(f"OK: Cleared {res.deleted_count} entries from roadmap_cache_v5")
        
        # Clear skill analysis cache if any
        res2 = db["skills_analysis_cache"].delete_many({})
        print(f"OK: Cleared {res2.deleted_count} entries from skills_analysis_cache")
        
        print("\nAll caches cleared. Next request will be fresh.")
    except Exception as e:
        print(f"Error clearing cache: {e}")

if __name__ == "__main__":
    clear_cache()
