# N4 findings: verdict N4 OK

Source: origin/test/windows-run-18, ui/*.png. Runner shots are 1024x720.

## Hashes (SHA256) and sizes
- snip-sleep-light.png 89456 B aea40c5e88f1f0866b929fe9b02394ef6d2c0979cd25b7bd34c7b21893378364
- snip-sleep-dark.png 87681 B e68fa3df6123a7c25ef71e5a185f5ce65ca9e00787e5591dc104ca7d4c9ecc42
- empty-light.png 44434 B 1c02a63ea2dc4010083c8ccab844dcd228d3c18632f0c54d4b983918e34e5f94
- empty-dark.png 43384 B ef3feacacea572fa46459f42b38029123368dcf3e91c7428422bb9ff8d4ce64f
Sleep light and dark differ (observed).

## Observed
- snip-sleep-light: light bar and light note (labo-04.md). Snip right of the + button at about x 258-282, y 8-28. Asleep: a Z above the crab, eyes are flat closed slits, body low, no raised legs/antennae pose of the idle crab. Body purple, claws olive green.
- snip-sleep-dark: dark bar and dark note. Same place, same sleeping pose, Z present. Body lighter lavender, claws lime. Differs from light in theme and colour as expected.
- x8 crops (250,4)-(290,34): snip-sleep-light-x8.png, snip-sleep-dark-x8.png confirm the above; identical pixel shape, only palette differs.
- empty-light / empty-dark (Untitled-1): light and dark theme; Snip is awake (open eyes, claws up, no Z), right of +. Contrast with the sleep shots.
- N1-sleep.png (headless, 1280 wide): same sleeping crab with Z, purple body, right of + button. Pose matches the runner shots. Note the headless shot has four tabs, so Snip sits further right (x about 865); the runner has one tab.

## Not done
- No pixel-diff against N1-sleep crop and no comparison to the CT1 x8 idle crops (looked only at N1 full bar). Colour values judged by eye.
