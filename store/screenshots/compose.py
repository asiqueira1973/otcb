#!/usr/bin/env python3
# Monta os prints de marketing da App Store (épico 8.11): chamada no topo com uma palavra em destaque,
# linha de apoio e a captura real do app embaixo, sem a barra de status. Saída 1320×2868 (iPhone 6,9").
# Recebe: as capturas em raw/ e a lista SLIDES abaixo. Devolve: PNGs em appstore/.
# Uso: python3 store/screenshots/compose.py
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(__file__).parent / "raw"
OUT = Path(__file__).parent / "appstore"
FONTS = ROOT / "node_modules/@expo-google-fonts"
TITLE = FONTS / "nunito/800ExtraBold/Nunito_800ExtraBold.ttf"
BODY = FONTS / "nunito/600SemiBold/Nunito_600SemiBold.ttf"

W, H = 1320, 2868
BG = (16, 33, 74)          # azul-noite (derivado do primário #1F4AA8)
WHITE = (255, 255, 255)
ACCENT = (245, 166, 35)    # laranja da bolacha
MUTED = (184, 197, 228)
STATUS_BAR = 186           # px da barra de status na captura do 17 Pro Max

# (arquivo, chamada com a palavra em destaque entre colchetes, linha de apoio)
SLIDES = [
    ("04-jogo.png", "Pergunta. O OTCB [responde.]", "Um assistente com IA que acha o bar certo: perto de você, com balcão ou passando o jogo."),
    ("02-ficha.png", "Tudo do bar em [um toque.]", "Nota do colarinho, opiniões da galera, rota e Uber no mesmo lugar."),
    ("03-passaporte.png", "Seu passaporte de [bares.]", "Carimbos por bar, coleções por bairro e selos por descoberta."),
    ("05-perfil.png", "Sem cadastro. [Sem senha.]", "Só um apelido. E seus dados saem do app com um toque, quando você quiser."),
]

# Desenha a chamada quebrando linhas; a parte entre [ ] sai na cor de destaque.
def draw_headline(d: ImageDraw.ImageDraw, text: str, y: int) -> int:
    font = ImageFont.truetype(str(TITLE), 104)
    words = [(w.strip("[]"), "[" in text and (w.startswith("[") or inside)) for inside, w in _tokens(text)]
    lines: list[list[tuple[str, bool]]] = [[]]
    for word, hl in words:
        trial = " ".join(w for w, _ in lines[-1] + [(word, hl)])
        if d.textlength(trial, font=font) > W - 160 and lines[-1]:
            lines.append([])
        lines[-1].append((word, hl))
    for line in lines:
        x = 80
        for word, hl in line:
            d.text((x, y), word, font=font, fill=ACCENT if hl else WHITE)
            x += d.textlength(word + " ", font=font)
        y += 124
    return y


# Separa as palavras marcando as que estão dentro de [ ].
def _tokens(text: str):
    inside = False
    for w in text.split():
        start = w.startswith("[")
        yield (inside or start), w
        if start:
            inside = True
        if w.endswith("]") or w.endswith("].") or "]" in w:
            inside = False


def draw_body(d: ImageDraw.ImageDraw, text: str, y: int) -> int:
    font = ImageFont.truetype(str(BODY), 50)
    line = ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if d.textlength(trial, font=font) > W - 160:
            d.text((80, y), line, font=font, fill=MUTED)
            y += 68
            line = word
        else:
            line = trial
    d.text((80, y), line, font=font, fill=MUTED)
    return y + 68


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def compose(raw: str, headline: str, body: str) -> Image.Image:
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    y = draw_headline(d, headline, 170)
    y = draw_body(d, body, y + 20)
    shot = Image.open(RAW / raw).convert("RGB")
    shot = shot.crop((0, STATUS_BAR, shot.width, shot.height))
    width = 1110
    shot = shot.resize((width, int(shot.height * width / shot.width)), Image.LANCZOS)
    top = y + 70
    # Moldura: borda fina clara em volta da tela, cantos arredondados; a tela continua além do rodapé.
    frame = Image.new("RGBA", (width + 24, shot.height + 24), (255, 255, 255, 40))
    canvas.paste(rounded(frame, 78), ((W - frame.width) // 2, top - 12), rounded(frame, 78))
    canvas.paste(rounded(shot, 66), ((W - width) // 2, top), rounded(shot, 66))
    return canvas


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for i, (raw, headline, body) in enumerate(SLIDES, start=1):
        img = compose(raw, headline, body)
        img.save(OUT / f"{i:02d}.png")
        # Slot "iPhone com Dynamic Island (tela média)", 6,3": 1206×2622 (mesma proporção).
        (OUT.parent / "appstore-6.3").mkdir(exist_ok=True)
        img.resize((1206, 2622), Image.LANCZOS).save(OUT.parent / "appstore-6.3" / f"{i:02d}.png")
        print(f"{i:02d}.png")
