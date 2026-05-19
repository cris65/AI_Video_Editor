# Audit: JSON Construction Pipeline (Phase 1 & Phase 2)

This document isolates the exact code blocks responsible for building and merging the JSON dictionaries within the Stringout and LLM Vision pipelines.

## 1. Phase 1 Output (`engine/pancake_editor.py`)

This section handles the initial assembly of the `stringout_timeline` dictionaries, tracking metadata such as the safe zone tag, people count, and motion vectors.

### A. Initialization
When a new clip or trash segment begins, the dictionary is initialized:
```python
                    current_block = {
                        "start": last_timestamp, 
                        "end": timestamp_sec, 
                        "tag": tag, 
                        "best_moment": timestamp_sec, 
                        "people_count": people_count,
                        "_max_lap": lap_var,
                        "_frame_in": small_frame,
                        "_frame_best": small_frame,
                        "_sb_in": sb_frame,
                        "_sb_best": sb_frame,
                        "_motion_samples": [],
                        "_prev_gray_flow": cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY)
                    }
```

### B. Finalization and Injection
When a clip segment is finalized (e.g., transitioning to a different tag or ending), the physical metadata like motion intensity/direction and cinematic palette are calculated and injected before appending to the timeline.
```python
                    current_block["_frame_out"] = cv2.resize(frame, (100, 100))
                    current_block["_sb_out"] = cv2.resize(frame, (480, 270))
                    
                    frames_for_palette = [
                        current_block.get("_frame_in"),
                        current_block.get("_frame_best"),
                        current_block.get("_frame_out")
                    ]
                    current_block["cinematic_palette"] = self.extract_cinematic_palette(frames_for_palette)
                    
                    # ... [Storyboard construction & save logic] ...
                    
                    samples = current_block.get("_motion_samples", [])
                    if samples:
                        avg_intensity = float(np.mean([s[0] for s in samples]))
                        directions = [s[1] for s in samples]
                        dom_dir = max(set(directions), key=directions.count)
                    else:
                        avg_intensity = 0.0
                        dom_dir = "STATIC"
                    current_block["motion"] = {"intensity": round(avg_intensity, 2), "direction": dom_dir}
                    
                    # ... [Cleanup of _keys] ...
                    
                    if duration >= 1.0:
                        current_block["is_usable"] = True
                        timeline.append(current_block)
```

---

## 2. Phase 2 Merge (`engine/mlx_client.py`)

This section handles the synchronous integration of the `semantic_data` extracted by the Gemma 4 LLM. The fields returned by the AI are explicitly merged into the existing dictionary and saved incrementally.

### Semantic Injection
```python
        # CHIAMATA SINCRONA MLX API
        people_count = clip.get("people_count", 0)
        semantic_data = analyze_frame(storyboard_path, people_count)
        
        if semantic_data:
            print(" ✅ OK")
            # Iniezione chiavi forzata
            clip["scene_and_lighting"] = semantic_data.get("scene_and_lighting", "")
            clip["action_continuity"] = semantic_data.get("action_continuity", "")
            clip["visual_quality_score"] = parse_quality_score(semantic_data.get("visual_quality_score", 0))
            clip["technical_flaws"] = semantic_data.get("technical_flaws", "")
            clip["is_usable"] = semantic_data.get("is_usable", True)
            success_count += 1
        else:
            print(" ❌ Fallita")
            clip["scene_and_lighting"] = "ANALYSIS_FAILED"
            clip["action_continuity"] = "ANALYSIS_FAILED"
            clip["visual_quality_score"] = 0
            clip["technical_flaws"] = "ANALYSIS_FAILED"
            clip["is_usable"] = False
```
