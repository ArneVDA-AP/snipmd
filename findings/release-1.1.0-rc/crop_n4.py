import sys
from PIL import Image
for n in ["snip-sleep-light","snip-sleep-dark"]:
    im=Image.open(n+".png").convert("RGB"); print(n,im.size)
    c=im.crop((250,4,290,34)); c.resize((320,240),Image.NEAREST).save(n+"-x8.png")
