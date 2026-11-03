#!/bin/bash
# Usage: scan.sh OUTDIR
# Per feature: owned files (path match) and touch points (content match outside the union of owned files).
cd /home/stili/dev/hataskey_lite || exit 1
OUT="$1"; mkdir -p "$OUT"
ROOTS="packages locales scripts .github cypress"
EXCL="--exclude-dir=node_modules --exclude-dir=built --exclude-dir=.git --exclude-dir=fluent-emojis --exclude-dir=hanaawase"

declare -A PATHRE CONTRE
PATHRE[uis]='hataskey3|/Hk3|hk3-|ui-s[-.]|ui-s/|uiS[A-Z]|ui-s-announcement|\.ui-s\.'
CONTRE[uis]='hataskey3|\bHk3[A-Z]|\bhk3[-A-Z]|ui-s-|uiS[A-Z]|UI ?S\b|ui_s\b'
PATHRE[hatagoes]='(?i)hata-?goes'
CONTRE[hatagoes]='(?i)hata-?goes'
PATHRE[hatafeed]='(?i)hata-?feed|/Feedback[A-Z]|/feedback/|HfStatus|hata/feedback'
CONTRE[hatafeed]='(?i)hata-?feed|\bFeedback(Issue|Project|Agree|Comment|Emoji|Notification|Service)|hata/feedback|HfStatus'
PATHRE[hatady]='(?i)hatady|hatadint|/Hy[A-Z]|hy-tutorial'
CONTRE[hatady]='(?i)hatady|hatadint|\bHy[A-Z][a-z]+[A-Z]?|hy-tutorial'
PATHRE[hatask]='(?i)hatask(?!ey)'
CONTRE[hatask]='(?i)hatask(?!ey)'
PATHRE[hataigo]='(?i)hata-?igo'
CONTRE[hataigo]='(?i)hata-?igo'
PATHRE[earthquake]='(?i)earthquake|tsunami'
CONTRE[earthquake]='(?i)earthquake|tsunami|地震|津波'
PATHRE[notecharm]='(?i)note-?charm'
CONTRE[notecharm]='(?i)note-?charm'
PATHRE[privch]='(?i)private-?channel|/ChannelMember|/ChannelInvitation|channels/invitations|channels/(add-member|remove-member|show-password|members|join)\.ts'
CONTRE[privch]='(?i)private-?channel|isPrivate|ChannelMember|ChannelInvitation|channel_member|channel_invitation|channels/(add-member|remove-member|show-password|members|join|invitations)'
PATHRE[external]='(?i)external-?(account|note|timeline|reaction|user|notification|api|server-info)|concrnt'
CONTRE[external]='(?i)external-?(account|note|timeline|reaction|userpopup|notification|api|server-info)|externalAccount|ExternalNote|ExternalTimeline|concrnt|\bctl\b'

FEATURES="uis hatagoes hatafeed hatady hatask hataigo earthquake notecharm privch external"

# all candidate files
find $ROOTS \( -name node_modules -o -name built -o -name .git -o -name fluent-emojis -o -name hanaawase \) -prune -o -type f -print > "$OUT/_allfiles.txt"
: > "$OUT/_owned_union.txt"
for f in $FEATURES; do
  grep -P "${PATHRE[$f]}" "$OUT/_allfiles.txt" | sort > "$OUT/$f.owned.txt"
  cat "$OUT/$f.owned.txt" >> "$OUT/_owned_union.txt"
done
sort -u "$OUT/_owned_union.txt" -o "$OUT/_owned_union.txt"

for f in $FEATURES; do
  grep -rIPc $EXCL "${CONTRE[$f]}" $ROOTS 2>/dev/null | grep -v ':0$' | sort -t: -k2 -nr > "$OUT/$f.refs_all.txt"
  # touch points = refs not in owned union
  awk -F: 'NR==FNR{o[$0]=1; next} !($1 in o)' "$OUT/_owned_union.txt" "$OUT/$f.refs_all.txt" > "$OUT/$f.touch.txt"
  owned_n=$(wc -l < "$OUT/$f.owned.txt")
  owned_lines=$(cat $(cat "$OUT/$f.owned.txt") 2>/dev/null | wc -l)
  touch_n=$(wc -l < "$OUT/$f.touch.txt")
  echo "$f owned_files=$owned_n owned_lines=$owned_lines touch_files=$touch_n"
done
