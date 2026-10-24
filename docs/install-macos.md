# Installing SnipMD on macOS

SnipMD for macOS runs on macOS 13 Ventura or later, on Apple Silicon and Intel. It is a preview: it works, but it is not signed by Apple yet, so macOS refuses the first start until you allow it once.

1. Download `SnipMD_<version>_universal.preview.dmg` from [Releases](https://github.com/ArneVDA-AP/snipmd/releases).
2. Open it and drag SnipMD to Applications.
3. The first start is refused ("cannot be opened" or "Apple could not verify"). Either:
   - System Settings → Privacy & Security → *Open Anyway* next to SnipMD, then confirm; or
   - in Terminal: `xattr -dr com.apple.quarantine /Applications/SnipMD.app`.

   After that SnipMD starts normally.
