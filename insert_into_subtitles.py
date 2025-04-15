import sys
import json
from datetime import datetime, timedelta

### Parameter #1 - Index to insert as
### Parameter #2 - Speaker
### Parameter #3 - Time offset

file_to_edit = "/Users/willjasen/Application Data/GitHub/wallace-thrasher/jekyll/assets/json/alive-in-25/drug-dumpling.json"

# Replace hard-coded parameters with command-line arguments if provided
if len(sys.argv) > 1:
    index_to_insert_as = int(sys.argv[1])
else:
    index_to_insert_as = 0

if len(sys.argv) > 2:
    speaker = sys.argv[2]
else:
    speaker = "LPC"

if len(sys.argv) > 3:
    time_offset = int(sys.argv[3])
else:
    time_offset = 0

# Helper functions to parse and format time strings
def parse_time(tstr):
    return datetime.strptime(tstr, "%H:%M:%S,%f")

def format_time(dt):
    return dt.strftime("%H:%M:%S,%f")[:-3]

# Load the JSON file
with open(file_to_edit, "r") as f:
    data = json.load(f)

# Create your new object (adjust values as needed)
new_object = {
    "Index": index_to_insert_as,
    "Start Time": "00:00:xx,xxx",  # adjust accordingly
    "End Time": "00:00:xx,xxx",    # adjust accordingly
    "Speaker": speaker,
    "Text": ""
}

# Find the position of the object with Index (index_to_insert_as - 1)
insert_at = next((i for i, obj in enumerate(data) if obj["Index"] == index_to_insert_as - 1), None)
if insert_at is None:
    print("Could not find an object with Index " + str(index_to_insert_as - 1))
    exit(1)

# Compute new time based on previous object's Start Time and the time_offset
prev_obj = data[insert_at]
computed_dt = parse_time(prev_obj["Start Time"]) + timedelta(seconds=time_offset)
new_time_str = format_time(computed_dt)

# Update previous object's End Time and new object's Start Time with the computed time
old_end_time = prev_obj["End Time"]
prev_obj["End Time"] = new_time_str
new_object["Start Time"] = new_time_str
new_object["End Time"] = old_end_time

# Display the found object for the previous index
print("Found object:", prev_obj)

# Insert the new object immediately after the previous object
data.insert(insert_at + 1, new_object)

# Update the indexes for objects after the new object (starting at insert_at+2)
for i in range(insert_at + 2, len(data)):
    old_index = data[i]["Index"]
    data[i]["Index"] += 1

# Save the updated JSON back to the file (or a new file)
with open(file_to_edit, "w") as f:
    json.dump(data, f, indent=2)

print("Indexes updated successfully!")