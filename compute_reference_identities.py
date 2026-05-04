import os
import json
from pathlib import Path

def main():
    s3_dir = Path("s3")
    if not s3_dir.exists():
        print("Error: s3 directory not found.")
        return

    # Loop through each folder in the s3 directory
    folders = sorted([d for d in s3_dir.iterdir() if d.is_dir()])
    
    results = []

    for folder in folders:
        # Find the non-transcript json file
        json_files = list(folder.glob("*.json"))
        target_file = None
        for f in json_files:
            if f.name != "transcript.json":
                target_file = f
                break
        
        if target_file:
            try:
                with open(target_file, "r") as f:
                    data = json.load(f)
                
                speaker_entities = data.get("speakerEntities", [])
                
                # Filter: Include only non-empty arrays that aren't "announcer", "employee", or "contestant"
                if speaker_entities and not any(
                    "announcer" in s.lower() or "employee" in s.lower() or "contestant" in s.lower()
                    for s in speaker_entities
                ):
                    results.append({
                        "path": str(folder),
                        "identity": speaker_entities[0] if len(speaker_entities) == 1 else speaker_entities
                    })
            except Exception as e:
                print(f"Error reading {target_file}: {e}")

    # Write results to JSON file
    output_file = "reference_identities.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"Successfully wrote {len(results)} entries to {output_file}")

if __name__ == "__main__":
    main()