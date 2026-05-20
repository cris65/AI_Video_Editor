import json
from engine.mlx_client import process_stringout_batch

dummy_json = "dummy.json"
with open(dummy_json, "w") as f:
    json.dump({"metadata": {"vlm_model_id": "google/gemma-4-E4B-it"}, "stringout_timeline": [{"storyboard_paths": ["dummy.jpg"]}]}, f)

process_stringout_batch(dummy_json)
