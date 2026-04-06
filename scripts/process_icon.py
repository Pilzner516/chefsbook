from PIL import Image
import os

src = 'docs/Gemini_Generated_Image_jufj1vjufj1vjufj.png'
img = Image.open(src).convert('RGBA')

# Square crop — center crop removing cream sides
w, h = img.size
size = min(w, h)
left = (w - size) // 2
top = (h - size) // 2
img_square = img.crop((left, top, left + size, top + size))

assets = 'apps/mobile/assets'
os.makedirs(assets, exist_ok=True)

# icon.png — 1024x1024
img_square.resize((1024, 1024), Image.LANCZOS).save(f'{assets}/icon.png')

# adaptive-icon.png — 1024x1024
img_square.resize((1024, 1024), Image.LANCZOS).save(f'{assets}/adaptive-icon.png')

# favicon.png — 32x32
img_square.resize((32, 32), Image.LANCZOS).save(f'{assets}/favicon.png')

print('Icon assets generated successfully')

# Splash — 1284x2778 portrait, cream background
splash_w, splash_h = 1284, 2778
splash = Image.new('RGBA', (splash_w, splash_h), '#faf7f0')

# Place icon centered, 360px wide, slightly above center
icon = Image.open(f'{assets}/icon.png').convert('RGBA')
icon_size = 360
icon_resized = icon.resize((icon_size, icon_size), Image.LANCZOS)
icon_x = (splash_w - icon_size) // 2
icon_y = (splash_h // 2) - icon_size
splash.paste(icon_resized, (icon_x, icon_y), icon_resized)

splash.save(f'{assets}/splash.png')
print('Splash screen generated')
