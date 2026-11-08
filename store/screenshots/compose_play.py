#!/usr/bin/env python3
# Imagens da ficha do Google Play (épico 8.11; roteiro da Play do skill android-port-publish): ícone 512×512
# sem transparência, imagem de destaque 1024×500 (obrigatória) e prints 9:16 (1080×1920). Os prints reusam os
# slides da App Store (appstore/*.png) encaixados sobre o mesmo azul-noite do fundo, sem emenda visível.
# Recebe: assets/icon.png, a bolacha e appstore/*.png. Devolve: PNGs em play/.
# Uso: python3 store/screenshots/compose_play.py (depois de compose.py)
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
OUT = HERE / "play"
FONTS = ROOT / "node_modules/@expo-google-fonts"
BG = (16, 33, 74)
ACCENT = (245, 166, 35)
MUTED = (184, 197, 228)


def icon() -> None:
    Image.open(ROOT / "assets/icon.png").convert("RGB").resize((512, 512), Image.LANCZOS).save(OUT / "icone-512.png")


# Destaque 1024×500: nome e subtítulo da loja (15.10, sem a marca) à esquerda, bolacha à direita.
def feature_graphic() -> None:
    img = Image.new("RGB", (1024, 500), BG)
    d = ImageDraw.Draw(img)
    title = ImageFont.truetype(str(FONTS / "bebas-neue/400Regular/BebasNeue_400Regular.ttf"), 190)
    sub = ImageFont.truetype(str(FONTS / "nunito/800ExtraBold/Nunito_800ExtraBold.ttf"), 46)
    d.text((70, 95), "OTCB", font=title, fill=(255, 255, 255))
    d.text((74, 300), "Chopp bem tirado", font=sub, fill=ACCENT)
    d.text((74, 356), "em São Paulo", font=sub, fill=MUTED)
    m = Image.open(ROOT / "assets/images/bolacha-feliz.png").convert("RGBA")
    m = m.crop(m.getbbox())
    m.thumbnail((420, 420), Image.LANCZOS)
    img.paste(m, (1024 - m.width - 70, (500 - m.height) // 2), m)
    img.save(OUT / "destaque-1024x500.png")


# Prints 9:16: o slide da App Store (mais alto) é reduzido até caber em 1080×1920 e centralizado no fundo.
def screenshots() -> None:
    for src in sorted((HERE / "appstore").glob("*.png")):
        slide = Image.open(src).convert("RGB")
        scale = 1920 / slide.height
        slide = slide.resize((round(slide.width * scale), 1920), Image.LANCZOS)
        canvas = Image.new("RGB", (1080, 1920), BG)
        canvas.paste(slide, ((1080 - slide.width) // 2, 0))
        canvas.save(OUT / f"print-{src.stem}.png")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    icon()
    feature_graphic()
    screenshots()
    print("\n".join(sorted(p.name for p in OUT.glob("*.png"))))
