import { describe, expect, it } from 'vitest';
import {
  buildBonecoPrompt,
  extractBonecoImageBase64,
  extractBonecoImageDataUrl,
} from '../../../src/modules/boneco/boneco.prompt.js';

describe('boneco prompt', () => {
  it('describes the full trading card plus kit, trim and pose', () => {
    const prompt = buildBonecoPrompt({
      position: 'FW',
      rarity: 'epic',
      kit: 'verde',
      trim: 'branco',
      pose: 'correndo',
    });
    expect(prompt).toContain('green');
    expect(prompt).toContain('white');
    expect(prompt).toContain('running');
    expect(prompt).toContain('MASTER LEGEND LEAGUE');
    expect(prompt).toContain('exactly EPIC');
    expect(prompt).toContain('#e0b028');
    const rare = buildBonecoPrompt({ position: 'FW', rarity: 'rare' });
    expect(rare).toContain('exactly RARE');
    expect(rare).toContain('#5888d8');
    expect(rare).not.toContain('exactly EPIC');
    const noted = buildBonecoPrompt({
      position: 'FW',
      kit: 'verde',
      trim: 'branco',
      pose: 'correndo',
      note: 'cabelo azul e chuteira dourada',
      playerName: 'Teste',
    });
    expect(noted).toContain('cabelo azul e chuteira dourada');
    expect(noted).toContain('Teste');
    expect(noted).toContain('Personalizing the player never changes the rarity color');
    const printed = buildBonecoPrompt({
      position: 'FW',
      rarity: 'common',
      stats: { strength: 8, speed: 1, stamina: 1, performance: 8 },
    });
    expect(printed).toContain('original card design');
    expect(printed).toContain('STRENGTH 8');
    expect(printed).toContain('SPEED 1');
    expect(printed).toContain('Do not redraw that panel');
  });

  it('reads the OpenRouter image data url', () => {
    const url = extractBonecoImageDataUrl({
      choices: [
        {
          message: {
            images: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,aaaa' } }],
          },
        },
      ],
    });
    expect(url).toBe('data:image/png;base64,aaaa');
  });

  it('reads the Image API base64 payload', () => {
    expect(extractBonecoImageBase64({ data: [{ b64_json: 'aaaa' }] })).toBe('aaaa');
    expect(extractBonecoImageBase64({ data: [] })).toBeNull();
  });

  it('returns null when the model sent no image', () => {
    expect(extractBonecoImageDataUrl({ choices: [{ message: { content: 'nope' } }] })).toBeNull();
  });
});
