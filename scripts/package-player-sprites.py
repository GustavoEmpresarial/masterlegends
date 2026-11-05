#!/usr/bin/env python3
"""Package generated 8x4 atlases; source card images are never segmented.

Run after copying image_gen results to output/sprites/atlases/atlas-NN.png.
Requires Pillow and NumPy.
The groups.json inventory maps each atlas row back to its original card URL.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'output/sprites'
DEST = ROOT / 'apps/web/public/ui/player-sprites'
MANIFEST = ROOT / 'apps/web/src/components/stadium/playerSpriteManifest.json'


def body_root(frame, box):
    x0, y0, x1, y1 = box
    alpha = frame.getchannel('A')
    # Torso, excluding the reaching leg, anchors each pose consistently.
    upper = alpha.crop((0, y0 + int((y1-y0)*.38), frame.width, y0 + int((y1-y0)*.60)))
    counts = (np.asarray(upper) > 160).sum(axis=0).tolist()
    total = sum(counts)
    acc = 0
    for x, count in enumerate(counts):
        acc += count
        if acc >= total / 2:
            return x
    return (x0+x1) / 2


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    groups = json.loads((WORK / 'groups.json').read_text())
    manifest = {}
    report = []
    for n, group in enumerate(groups):
        path = WORK / 'atlases' / f'atlas-{n:02}.png'
        if not path.exists():
            continue
        atlas = Image.open(path).convert('RGBA')
        for row, url in enumerate(group):
            frames = [atlas.crop((round(col*atlas.width/8), round(row*atlas.height/4), round((col+1)*atlas.width/8), round((row+1)*atlas.height/4))) for col in range(8)]
            # QA replacements are generated poses of the same identity.
            if url.endswith('/card-common-02-v2.jpg') or url.endswith('/card-common-03-v2.jpg'):
                single = Image.open(WORK / 'atlases' / ('nuno-4x4.png' if '02-v2' in url else 'caio-4x4.png')).convert('RGBA')
                frames = [single.crop((round((i%4)*single.width/4), round((i//4)*single.height/4), round((i%4+1)*single.width/4), round((i//4+1)*single.height/4))) for i in [0,4,5,6,8,9,10,14]]
            if url.endswith('/catalog/incomum-04.png'):
                replacement = Image.open(WORK / 'atlases/atlas-21.png').convert('RGBA')
                frames = [replacement.crop((round(col*replacement.width/8), 0, round((col+1)*replacement.width/8), round(replacement.height/4))) for col in range(8)]
            boxes = [f.getchannel('A').point(lambda a: 255 if a > 160 else 0).getbbox() for f in frames]
            if not all(boxes):
                raise ValueError(f'Empty animation cell: {n}/{row}')
            roots = [body_root(f, b) for f, b in zip(frames, boxes)]
            reach = max(max(root-b[0], b[2]-root) for root, b in zip(roots, boxes))
            idle_height = boxes[0][3]-boxes[0][1]
            scale = min(108/idle_height, 58/max(1, reach))
            sheet = Image.new('RGBA', (1024, 128))
            for col, (frame, box, root) in enumerate(zip(frames, boxes, roots)):
                body = frame.crop(box)
                body = body.resize((max(1, round(body.width*scale)), max(1, round(body.height*scale))), Image.Resampling.LANCZOS)
                x = col*128 + round(64 - (root-box[0])*scale)
                y = 120-body.height
                if x < col*128 or x+body.width > (col+1)*128 or y < 0:
                    raise ValueError(f'Frame outside cell: {n}/{row}/{col}')
                sheet.alpha_composite(body, (x, y))
            digest = hashlib.sha256(sheet.tobytes()).hexdigest()[:10]
            stem = url.removeprefix('/uploads/items/').replace('/', '-').rsplit('.', 1)[0]
            name = f'{stem}-{digest}.webp'
            if not (DEST / name).exists():
                sheet.save(DEST / name, 'WEBP', quality=92, method=2)
            manifest[url] = f'/ui/player-sprites/{name}'
            report.append({'card': url, 'sprite': name, 'atlas': n, 'row': row, 'frames': 8})
    live = set(manifest.values())
    for asset in DEST.glob('*.webp'):
        if f'/ui/player-sprites/{asset.name}' not in live:
            asset.unlink()
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (WORK / 'packaging-report.json').write_text(json.dumps(report, indent=2))
    print(f'Packaged {len(report)} characters, {len(report)*8} frames.')


if __name__ == '__main__':
    main()
