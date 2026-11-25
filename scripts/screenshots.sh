#!/usr/bin/env bash
# Runs the simulator build with a demo journal and captures the main screens (Codemagic, macOS).
#   scripts/screenshots.sh <Release-iphonesimulator products dir> <out dir>
set -euo pipefail
PRODUCTS=$1
OUT=$2
mkdir -p "$OUT"
APP=$(ls -d "$PRODUCTS"/*.app | head -1)
BUNDLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")

# A current, mid-size iPhone.
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devs = [d for rt, ds in json.load(sys.stdin)["devices"].items() if "iOS" in rt for d in ds]
pick = [d for d in devs if d["name"].startswith("iPhone") and "Pro" in d["name"] and "Max" not in d["name"]] or [d for d in devs if d["name"].startswith("iPhone")]
print(pick[-1]["udid"])')
echo "Simulator $UDID"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 || true
xcrun simctl install "$UDID" "$APP"

DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data)
node scripts/demo-journal.mjs "$DATA/Documents/Journal" "$(date +%F)"

shot() { sleep "${2:-3}"; xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null; echo "  $1"; }
# Launch fresh, optionally straight into a route (read by the app from the -LTRoute launch argument).
fresh() {
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  if [ -n "${1:-}" ]; then xcrun simctl launch "$UDID" "$BUNDLE" -LTRoute "/$1" >/dev/null
  else xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null; fi
  sleep 6
}

WEEK=$(python3 -c 'import datetime; y, w, _ = datetime.date.today().isocalendar(); print(f"{y}-W{w:02d}")')
LASTWEEK=$(python3 -c 'import datetime; y, w, _ = (datetime.date.today() - datetime.timedelta(days=7)).isocalendar(); print(f"{y}-W{w:02d}")')
TODAY=$(date +%F)
MONTH=$(date +%Y-%m)
NEXT=$(python3 -c 'import datetime; d = datetime.date.today().replace(day=28) + datetime.timedelta(days=4); print(d.strftime("%Y-%m"))')
PREV=$(python3 -c 'import datetime; d = datetime.date.today().replace(day=1) - datetime.timedelta(days=1); print(d.strftime("%Y-%m"))')

fresh; shot 01-today
for r in "(tabs)/(month)/month:02-month" "(tabs)/(lookback)/lookback:03-lookback" "(tabs)/(plan)/plan:04-plan" "past/feelings:05-feelings" "past/titles:06-titles" "past/archive:07-archive" "past/rejections:08-rejections" "past/bucket:09-bucket"; do
  fresh "${r%%:*}"; shot "${r#*:}"
done
for r in "close-day/$TODAY:10-close-day" "setup/$NEXT:11-setup" "week-start/$WEEK:12-week-start" "week-close/$LASTWEEK:13-week-close" "month-close/$PREV:14-month-close" "drive:15-drive" "challenge/bucket/b1:20-challenge" "backup:16-backup" "bank/goals:17-bank" "record/$TODAY:18-record" "day/$(python3 -c 'import datetime; print((datetime.date.today() - datetime.timedelta(days=1)).isoformat())'):19-day"; do
  fresh "${r%%:*}"; shot "${r#*:}" 4
done
# The year method: the review sitting, the year pages, the timeline, month highlights, setting a misogi.
YEAR=$(date +%Y)
LAST=$((YEAR - 1))
for r in "year-review/$YEAR:31-year-review" "past/year/$LAST:32-year-last" "past/year/$YEAR:33-year-this" "past/defining:34-defining" "past/month-highlights:35-month-highlights" "misogi/$YEAR:36-set-misogi" "year-close/$YEAR?mode=edit:37-defining-edit" "record/sealed-$YEAR:38-record-sealed"; do
  fresh "${r%%:*}"; shot "${r#*:}" 4
done
if xcrun simctl spawn "$UDID" launchctl list | grep -q "UIKitApplication:$BUNDLE"; then echo "  year screens: app still running"; else echo "  year screens: APP NOT RUNNING"; fi
# 1.18: reminders, the backup screen, and search across every kind of entry.
for r in "reminders:39-reminders" "backup?due=full:40-backup" "past/writing:42-writing" "crash-check:43-crash"; do
  fresh "${r%%:*}"; shot "${r#*:}" 4
done
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE" -LTRoute "/(tabs)/(lookback)/lookback" -LTSearch "marathon" >/dev/null
sleep 7; xcrun simctl io "$UDID" screenshot "$OUT/41-search.png" >/dev/null; echo "  41-search"
# 1.19: the feeling dial with a feeling set, and a recap card part way through Close month.
fresh "close-day/$(python3 -c 'import datetime; print((datetime.date.today() - datetime.timedelta(days=2)).isoformat())')"; shot 44-dial 1
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE" -LTRoute "/month-close/$PREV" -LTSlide 3 >/dev/null
sleep 7; xcrun simctl io "$UDID" screenshot "$OUT/45-recap.png" >/dev/null; echo "  45-recap"
# 1.20: the streak moment, after the number has rolled and today's circle has filled.
fresh "streak?n=86"; shot 46-streak 2
if xcrun simctl spawn "$UDID" launchctl list | grep -q "UIKitApplication:$BUNDLE"; then echo "  1.18 screens: app still running"; else echo "  1.18 screens: APP NOT RUNNING"; fi
# The rings with a hobby's time open, and a challenge card lifted out of the stack.
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE" -LTScroll 520 >/dev/null
sleep 6; xcrun simctl io "$UDID" screenshot "$OUT/29-today-lists.png" >/dev/null; echo "  29-today-lists"
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE" -LTOpen hours,challenge -LTScroll 400 >/dev/null
sleep 7; xcrun simctl io "$UDID" screenshot "$OUT/30-today-lists-end.png" >/dev/null; echo "  30-today-lists-end"
if xcrun simctl spawn "$UDID" launchctl list | grep -q "UIKitApplication:$BUNDLE"; then echo "  lists: app still running"; else echo "  lists: APP NOT RUNNING"; fi

# The same main screens at night.
xcrun simctl ui "$UDID" appearance dark || true
fresh; shot 21-today-dark
for r in "(tabs)/(month)/month:22-month-dark" "(tabs)/(lookback)/lookback:23-lookback-dark" "(tabs)/(plan)/plan:24-plan-dark" "close-day/$TODAY:25-close-day-dark" "past/titles:26-titles-dark" "past/rejections:27-rejections-dark" "past/bucket:28-bucket-dark"; do
  fresh "${r%%:*}"; shot "${r#*:}"
done
xcrun simctl ui "$UDID" appearance light || true

# The yearly book, made on the simulator and kept as a file to read.
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE" -LTBook "$(date +%Y)" >/dev/null
for i in $(seq 1 60); do [ -s "$DATA/Documents/book-check.pdf" ] && break; sleep 2; done
cp "$DATA/Documents/book-check.pdf" "$OUT/book.pdf" 2>/dev/null && echo "  book.pdf" || echo "  (no book.pdf)"
cat "$DATA/Documents/book-check.txt" 2>/dev/null | sed 's/^/  book: /' || echo "  book: no steps written"

xcrun simctl spawn "$UDID" log show --last 5m --predicate "process == \"$(basename "$APP" .app)\"" --style compact > "$OUT/app.log" 2>/dev/null || true
ls -la "$OUT"
