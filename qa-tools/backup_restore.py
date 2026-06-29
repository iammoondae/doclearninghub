import os
import shutil
import json
import datetime
import argparse

# Paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKUPS_DIR = os.path.join(PROJECT_ROOT, 'backups')
INDEX_FILE = os.path.join(BACKUPS_DIR, 'backup_index.json')

FILES_TO_BACKUP = [
    'index.html',
    'app.js',
    'lims.js',
    'index.css',
    'data/manifest.json'
]

def backup():
    # 1. Ask user if current version is working
    working = input("Is the current version of the Department of Chemistry Portal working correctly? (y/n): ").strip().lower()
    if working != 'y':
        print("Backup aborted. Only working versions can be backed up.")
        return

    # Create backups folder if not exists
    if not os.path.exists(BACKUPS_DIR):
        os.makedirs(BACKUPS_DIR)

    # 2. Load existing index
    index_data = []
    if os.path.exists(INDEX_FILE):
        try:
            with open(INDEX_FILE, 'r') as f:
                index_data = json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load backup index: {e}. Reinitializing.")

    # Generate timestamp version name (format: vYYYY.MM.DD_HHMMSS)
    timestamp = datetime.datetime.now().strftime('%Y.%m.%d_%H%M%S')
    version_name = f"v{timestamp}"
    version_dir = os.path.join(BACKUPS_DIR, version_name)

    # Prompt for changelog description
    changelog = input("Enter a short, concise description of the version update (e.g. Added PCO/EMIS Module): ").strip()
    if not changelog:
        changelog = "Manual version update"

    os.makedirs(version_dir)
    # Replicate directory structure for manifest
    os.makedirs(os.path.join(version_dir, 'data'))

    # Copy files
    print(f"Backing up files to {version_name}...")
    for filename in FILES_TO_BACKUP:
        src = os.path.join(PROJECT_ROOT, filename)
        dst = os.path.join(version_dir, filename)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"  Copied: {filename}")
        else:
            print(f"  Warning: File not found: {filename}")

    # Add to index
    new_entry = {
        "version": version_name,
        "date": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "changelog": changelog,
        "status": "Working",
        "files": FILES_TO_BACKUP
    }
    index_data.insert(0, new_entry) # Put at the beginning (latest first)
    # Enforce limit of 30 versions
    while len(index_data) > 30:
        oldest = index_data.pop()
        oldest_dir = os.path.join(BACKUPS_DIR, oldest['version'])
        if os.path.exists(oldest_dir):
            try:
                shutil.rmtree(oldest_dir)
                print(f"Purged oldest backup: {oldest['version']}")
            except Exception as e:
                print(f"Warning: Failed to delete folder {oldest_dir}: {e}")

    # Save index
    try:
        with open(INDEX_FILE, 'w') as f:
            json.dump(index_data, f, indent=2)
        print(f"Backup catalog index updated successfully. Version {version_name} is saved!")
    except Exception as e:
        print(f"Error saving index file: {e}")

def restore(version_name):
    version_dir = os.path.join(BACKUPS_DIR, version_name)
    if not os.path.exists(version_dir):
        print(f"Error: Version '{version_name}' does not exist in backups.")
        return

    confirm_restore = input(f"WARNING: This will overwrite your current active files with backup files from '{version_name}'.\nAre you sure you want to proceed? (y/n): ").strip().lower()
    if confirm_restore != 'y':
        print("Restore operation cancelled.")
        return

    print(f"Restoring from {version_name}...")
    for filename in FILES_TO_BACKUP:
        src = os.path.join(version_dir, filename)
        dst = os.path.join(PROJECT_ROOT, filename)
        if os.path.exists(src):
            # Ensure subdirectories exist in dst
            dst_dir = os.path.dirname(dst)
            if not os.path.exists(dst_dir):
                os.makedirs(dst_dir)
            shutil.copy2(src, dst)
            print(f"  Restored: {filename}")
        else:
            print(f"  Warning: File missing in backup: {filename}")

    print("Restore operation completed successfully. Refresh the page to reload!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="DoC Portal Backup & Restore Tool")
    parser.add_argument('--restore', type=str, help="Version name to restore (e.g. v1_2026-06-28_07-30-00)")
    args = parser.parse_args()

    if args.restore:
        restore(args.restore)
    else:
        backup()
