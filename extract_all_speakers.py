#!/usr/bin/env python3
import os
import json
import wave
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed

def coalesce_segments(segments, max_gap=0.5):
    """Merge overlapping or close segments."""
    if not segments:
        return []
    segments.sort(key=lambda x: x[0])
    merged = [segments[0]]
    for current in segments[1:]:
        prev = merged[-1]
        if current[0] <= prev[1] + max_gap:
            # Merge
            merged[-1] = (prev[0], max(prev[1], current[1]))
        else:
            merged.append(current)
    return merged

def reconstruct_speaker_wav(full_wav_path: Path, segments: list, output_path: Path, max_duration_sec: float):
    if not full_wav_path.exists():
        return 0.0

    try:
        with wave.open(str(full_wav_path), 'rb') as src:
            pcm_data = src.readframes(src.getnframes())
            channels = src.getnchannels()
            sample_width = src.getsampwidth()
            sample_rate = src.getframerate()
            bytes_per_sec = sample_rate * sample_width * channels
    except Exception as e:
        print(f"Error reading {full_wav_path}: {e}")
        return 0.0

    buf_len = len(pcm_data)
    output_frames = bytearray()
    total_duration = 0.0

    for start_time, end_time in segments:
        if total_duration >= max_duration_sec:
            break

        start_byte = (int(start_time * bytes_per_sec) // (sample_width * channels)) * (sample_width * channels)
        end_byte = (int(end_time * bytes_per_sec) // (sample_width * channels)) * (sample_width * channels)

        if start_byte >= buf_len:
            continue
        end_byte = min(end_byte, buf_len)
        if end_byte <= start_byte:
            continue

        seg_duration = (end_byte - start_byte) / bytes_per_sec
        remaining = max_duration_sec - total_duration
        if seg_duration > remaining:
            end_byte = start_byte + int(remaining * bytes_per_sec) // (sample_width * channels) * (sample_width * channels)
            seg_duration = remaining

        output_frames.extend(pcm_data[start_byte:end_byte])
        total_duration += seg_duration

    if not output_frames:
        return 0.0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output_path), 'wb') as dst:
        dst.setnchannels(channels)
        dst.setsampwidth(sample_width)
        dst.setframerate(sample_rate)
        dst.writeframes(bytes(output_frames))

    return total_duration

def process_session(folder_path: Path, output_dir: Path):
    dg_dir = folder_path / "deepgram_responses"
    
    # Audio might be in s3/ or we fallback to recordings/ if it was recorded locally
    full_wav = folder_path / "audio" / "full.wav"
    if not full_wav.exists():
        full_wav = Path("recordings") / folder_path.name / "audio" / "full.wav"
        
    if not dg_dir.exists():
        return
        
    if not full_wav.exists():
        print(f"Skipping {folder_path.name}: No full.wav found (expected at {full_wav})")
        return
        
    print(f"Processing session: {folder_path.name}")
    speaker_segments = defaultdict(list)
    
    for file_path in sorted(dg_dir.glob("dg_*.json")):
        try:
            with open(file_path, "r") as f:
                content = f.read().strip()
                # Some files have concatenated json objects
                if "\n{" in content:
                    content = content.split("\n{")[0]
                data = json.loads(content)
        except Exception:
            continue

        if data.get("type") == "Results" and data.get("is_final", False):
            alt = data.get("channel", {}).get("alternatives", [{}])[0]
            words = alt.get("words", [])
            
            # Group words by speaker to create segments
            current_spk = None
            start_time = None
            end_time = None
            
            for w in words:
                spk = str(w.get("speaker", "0"))
                if current_spk is None:
                    current_spk = spk
                    start_time = w["start"]
                    end_time = w["end"]
                elif spk == current_spk:
                    end_time = w["end"]
                else:
                    speaker_segments[current_spk].append((start_time, end_time))
                    current_spk = spk
                    start_time = w["start"]
                    end_time = w["end"]
            
            if current_spk is not None:
                speaker_segments[current_spk].append((start_time, end_time))
    
    if not speaker_segments:
        print(f"  No speaker segments found in {folder_path.name}")
        return

    for spk, segments in speaker_segments.items():
        merged_segments = coalesce_segments(segments, max_gap=0.5)
        out_file = output_dir / f"{folder_path.name}_speaker_{spk}.wav"
        
        if out_file.exists():
            print(f"  Exists: {out_file.name}")
            continue
            
        duration = reconstruct_speaker_wav(full_wav, merged_segments, out_file, max_duration_sec=60.0)
        if duration > 0:
            print(f"  Saved {out_file.name} ({duration:.1f}s)")

def main():
    s3_dir = Path("s3")
    output_dir = Path("speakers.wav")
    output_dir.mkdir(exist_ok=True)
    
    if not s3_dir.exists():
        print(f"{s3_dir} directory not found.")
        return
        
    folders = [
        d for d in s3_dir.iterdir() 
        if d.is_dir() and not any(sport in d.name.lower() for sport in ("mlb", "nhl", "nba"))
    ]
    
    # Using max_workers defaults to number of processors on the machine
    with ProcessPoolExecutor() as executor:
        futures = {executor.submit(process_session, folder, output_dir): folder for folder in folders}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"Error processing {futures[future].name}: {e}")

if __name__ == "__main__":
    main()
