# Code signing policy

**Status:** the Windows files are not signed yet. SnipMD has applied for a free certificate from SignPath Foundation; this policy applies from the first signed release.

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## What is signed
Only the Windows files that the *Release Windows* workflow builds on GitHub Actions from a version tag in this repository: the installer, the MSI and the portable exe. Nothing built on a personal computer is signed. Every signing request is approved by hand.

## Team
- Committers and reviewers: the [members of this repository](https://github.com/ArneVDA-AP/snipmd/graphs/contributors). Code is written with Claude (Anthropic) as the main author; every change goes through a pull request with CI before it reaches `main`.
- Approvers: [ArneVDA-AP](https://github.com/ArneVDA-AP) (owner).

## Privacy
This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. The installer downloads WebView2 from Microsoft only when Windows lacks it. SnipMD itself makes no network connections; links in a note open in your browser when you click them.
