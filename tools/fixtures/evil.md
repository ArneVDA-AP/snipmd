# Evil note (SnipMD security test)

<img src=x onerror=alert(1)>

<script>alert(1)</script>

<iframe src="https://example.com"></iframe>

[click me](javascript:alert(1))

<svg onload=alert(1)></svg>

![x](data:image/png;base64,AAAA)

<img src="file:///C:/Windows/win.ini">

![relative](../../secret.png)

![win](C:\\Windows\\win.ini)

<a href="https://example.com" style="position:fixed">styled link</a>

![asset url](http://asset.localhost/C%3A%5CWindows%5Cwin.ini)

<img src="http://asset.localhost/C%3A%5CWindows%5CWeb%5CWallpaper%5CWindows%5Cimg0.jpg">

![trailing space escape](.. /.. /Windows/Web/Wallpaper/Windows/img0.jpg)

[remote page](https://example.com) (clicking must not replace the app)
