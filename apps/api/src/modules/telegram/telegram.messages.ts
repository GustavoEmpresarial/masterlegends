import { config } from '../../config/env.js';

export function escapeTelegramHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const TOP = '╔════════════════════╗';
const MID = '╠════════════════════╣';
const BOT = '╚════════════════════╝';
const RULE = '────────────────────';

function siteUrl(path = '/'): string {
  const base = (config.WEB_URL || 'https://masterlegends.online').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
};

export type TelegramPayload = { text: string; replyMarkup?: InlineKeyboard };

function brandHeader(title: string, emoji: string): string[] {
  return [
    TOP,
    `║  ⚡️ <b>MLL · GENESIS DAO</b>`,
    MID,
    `║  ${emoji} <b>${escapeTelegramHtml(title)}</b>`,
    BOT,
    '',
  ];
}

function footer(): string[] {
  return ['', RULE, `<i>Master Legends League · Genesis DAO</i>`];
}

function field(label: string, value: string): string {
  return `▸ <b>${escapeTelegramHtml(label)}</b>\n   ${value}`;
}

function navKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🏟️ Abrir MLL', url: siteUrl('/') },
        { text: '⚙️ Configurações', url: siteUrl('/settings') },
      ],
    ],
  };
}

function officeKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🏢 Escritório', url: siteUrl('/club/escritorio') },
        { text: '🏋️ Centro de treino', url: siteUrl('/club/ct') },
      ],
      [{ text: '🏟️ Abrir clube', url: siteUrl('/club') }],
    ],
  };
}

/** Generic rich notification card. */
export function formatTelegramHtml(title: string, body: string): string {
  return [...brandHeader(title, '📣'), escapeTelegramHtml(body), ...footer()].join('\n');
}

export function formatDurationPt(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) {
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h}h` : `${Math.round(h * 10) / 10}h`;
  }
  const d = minutes / (60 * 24);
  return Number.isInteger(d) ? `${d} dia${d > 1 ? 's' : ''}` : `${Math.round(d * 10) / 10} dias`;
}

const AFFLICTION_META: Record<string, { emoji: string; title: string }> = {
  dor_de_barriga: { emoji: '🤢', title: 'Dor de barriga' },
  gripe: { emoji: '🤧', title: 'Gripe forte' },
  indisposicao: { emoji: '😵', title: 'Indisposição' },
  lesao_profissional: { emoji: '🚑', title: 'Lesão profissional' },
  auditoria_externa: { emoji: '📋', title: 'Auditoria externa' },
};

function afflictionMeta(code: string): { emoji: string; title: string } {
  return (
    AFFLICTION_META[code] ?? {
      emoji: '⚠️',
      title: code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }
  );
}

function staffMeta(kind: string): { emoji: string; label: string; effect: string } {
  if (kind === 'treasurer') {
    return {
      emoji: '💼',
      label: 'Tesoureiro',
      effect: 'Funções financeiras passivas ficam suspensas enquanto o evento durar.',
    };
  }
  if (kind === 'coach') {
    return {
      emoji: '👨‍🏫',
      label: 'Treinador',
      effect: 'Sem recuperação passiva de stamina. Use minigames no CT para manter o elenco.',
    };
  }
  return {
    emoji: '👤',
    label: 'Staff',
    effect: 'O membro da equipe está indisposto e não cumpre funções passivas.',
  };
}

/** Intro / “canal ativo” for the public Events topic. */
export function msgGlobalChannelIntro(): TelegramPayload {
  return {
    text: [
      ...brandHeader('TÓPICO DE EVENTOS', '🏟️'),
      `Aqui a liga publica o que importa em tempo real:`,
      '',
      `🎭  Eventos do Escritório`,
      `   Treinador e Tesoureiro fora de ação`,
      '',
      `💸  Provas de saque`,
      `   Valor + hash on-chain na Polygon`,
      '',
      `📢  Comunicados oficiais`,
      `   Avisos da administração`,
      '',
      `Fique de olho — tudo que move o clube passa por aqui.`,
      ...footer(),
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '🏟️ Jogar agora', url: siteUrl('/') },
          { text: '🏢 Escritório', url: siteUrl('/club/escritorio') },
        ],
      ],
    },
  };
}

/** Player DM when an office affliction hits their staff. */
export function msgAfflictionApplied(opts: {
  targetKind: string;
  code: string;
  durationMinutes: number;
  note?: string | null;
}): TelegramPayload {
  const staff = staffMeta(opts.targetKind);
  const event = afflictionMeta(opts.code);
  const duration = formatDurationPt(opts.durationMinutes);
  const note = opts.note?.trim();

  return {
    text: [
      ...brandHeader('EVENTO NO ESCRITÓRIO', '⚠️'),
      field('Alvo', `${staff.emoji} <b>${escapeTelegramHtml(staff.label)}</b> indisposto`),
      '',
      field('Evento', `${event.emoji} <b>${escapeTelegramHtml(event.title)}</b>`),
      '',
      field('Duração', `<b>${escapeTelegramHtml(duration)}</b>`),
      '',
      RULE,
      escapeTelegramHtml(staff.effect),
      note ? `\n💬 <i>${escapeTelegramHtml(note)}</i>` : null,
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: officeKeyboard(),
  };
}

/** Player DM when an affliction is cut early by admin. */
export function msgAfflictionCut(opts: {
  targetKind: string;
  code?: string | null;
}): TelegramPayload {
  const staff = staffMeta(opts.targetKind);
  const event = opts.code ? afflictionMeta(opts.code) : null;

  return {
    text: [
      ...brandHeader('EVENTO ENCERRADO', '✂️'),
      field('Status', `${staff.emoji} <b>${escapeTelegramHtml(staff.label)}</b> liberado`),
      event
        ? `\n${field('Evento', `${event.emoji} <b>${escapeTelegramHtml(event.title)}</b>`)}`
        : null,
      '',
      `As funções passivas voltaram ao normal.`,
      `O clube respira de novo.`,
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: officeKeyboard(),
  };
}

/** Global channel summary when broadcasting an affliction. */
export function msgAfflictionBroadcastGlobal(opts: {
  targetKind: string;
  code: string;
  durationMinutes: number;
  affected: number;
  note?: string | null;
}): TelegramPayload {
  const staff = staffMeta(opts.targetKind);
  const event = afflictionMeta(opts.code);
  const duration = formatDurationPt(opts.durationMinutes);
  const note = opts.note?.trim();

  return {
    text: [
      ...brandHeader('EVENTO EM MASSA', '🎭'),
      field('Alvo', `${staff.emoji} <b>${escapeTelegramHtml(staff.label)}</b>`),
      '',
      field('Evento', `${event.emoji} <b>${escapeTelegramHtml(event.title)}</b>`),
      '',
      field('Alcance', `<b>${opts.affected}</b> clubes atingidos`),
      '',
      field('Duração', `<b>${escapeTelegramHtml(duration)}</b>`),
      note ? `\n💬 <i>${escapeTelegramHtml(note)}</i>` : null,
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: officeKeyboard(),
  };
}

export function msgWithdrawalApproved(opts: {
  amountUsdc: string | number;
  txHash?: string | null;
}): TelegramPayload {
  const amount = String(opts.amountUsdc);
  const tx = opts.txHash?.trim();
  return {
    text: [
      ...brandHeader('SAQUE APROVADO', '✅'),
      field('Valor', `<b>${escapeTelegramHtml(amount)} USDC</b>`),
      tx ? `\n${field('Transação', `<code>${escapeTelegramHtml(tx)}</code>`)}` : null,
      '',
      `O valor segue o fluxo on-chain da carteira do jogo.`,
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: {
      inline_keyboard: [[{ text: '💰 Abrir wallet', url: siteUrl('/wallet') }]],
    },
  };
}

/** Saque liquidado na conta SatsPay. Sem link de explorer. */
export function msgWithdrawalSatspay(opts: {
  amountUsdc: string | number;
  referenceId?: string | null;
  toEmail?: string | null;
}): TelegramPayload {
  const amount = String(opts.amountUsdc);
  const ref = opts.referenceId?.trim();
  const email = opts.toEmail?.trim();
  return {
    text: [
      ...brandHeader('SAQUE SATSPAY', '✅'),
      field('Valor', `<b>${escapeTelegramHtml(amount)} USDT</b>`),
      email ? `\n${field('Conta', `<code>${escapeTelegramHtml(email)}</code>`)}` : null,
      ref ? `\n${field('Referência', `<code>${escapeTelegramHtml(ref)}</code>`)}` : null,
      '',
      'Enviado para a conta SatsPay depois da revisão da equipe.',
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: {
      inline_keyboard: [[{ text: '💰 Abrir wallet', url: siteUrl('/wallet') }]],
    },
  };
}

/** Public group proof of an approved withdrawal (no private user data). */
export function msgWithdrawalProofGlobal(opts: {
  amountUsdc: string | number;
  txHash?: string | null;
}): TelegramPayload {
  const amount = String(opts.amountUsdc);
  const tx = opts.txHash?.trim();
  const scan = tx ? `https://polygonscan.com/tx/${tx}` : null;
  return {
    text: [
      ...brandHeader('PROVA DE SAQUE', '💸'),
      field('Valor', `<b>${escapeTelegramHtml(amount)} USDC</b>`),
      '',
      field('Rede', `<b>Polygon</b>`),
      tx
        ? `\n${field('Tx hash', `<code>${escapeTelegramHtml(tx)}</code>`)}`
        : `\n⏳ Hash ainda não disponível.`,
      '',
      `Transparência on-chain · saque confirmado pela administração.`,
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: scan
      ? {
          inline_keyboard: [
            [{ text: '🔎 Ver no Polygonscan', url: scan }],
            [{ text: '🏟️ Abrir MLL', url: siteUrl('/') }],
          ],
        }
      : { inline_keyboard: [[{ text: '🏟️ Abrir MLL', url: siteUrl('/') }]] },
  };
}

export function msgWithdrawalRejected(reason: string): TelegramPayload {
  return {
    text: [
      ...brandHeader('SAQUE REJEITADO', '❌'),
      `Não foi possível concluir o saque.`,
      '',
      field('Motivo', `<i>${escapeTelegramHtml(reason)}</i>`),
      '',
      `Se precisar, abra um ticket no suporte.`,
      ...footer(),
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '💰 Wallet', url: siteUrl('/wallet') },
          { text: '🎧 Suporte', url: siteUrl('/support') },
        ],
      ],
    },
  };
}

export function msgSupportReplied(opts: { subject: string; preview?: string | null }): TelegramPayload {
  const preview = (opts.preview ?? '').trim().slice(0, 280);
  return {
    text: [
      ...brandHeader('SUPORTE RESPONDEU', '🎧'),
      field('Assunto', `<b>${escapeTelegramHtml(opts.subject)}</b>`),
      preview ? `\n${RULE}\n${escapeTelegramHtml(preview)}` : null,
      '',
      `Abra o ticket no jogo para a resposta completa.`,
      ...footer(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
    replyMarkup: {
      inline_keyboard: [[{ text: '🎧 Abrir suporte', url: siteUrl('/support') }]],
    },
  };
}

export function msgAnnouncement(title: string, body: string): TelegramPayload {
  const clipped = body.trim().slice(0, 900);
  return {
    text: [
      ...brandHeader(title.toUpperCase().slice(0, 64), '📢'),
      escapeTelegramHtml(clipped),
      ...footer(),
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [[{ text: '🏟️ Abrir MLL', url: siteUrl('/') }]],
    },
  };
}

/** Allow only Telegram-safe HTML tags for admin freeform messages. */
export function sanitizeTelegramHtml(input: string): string {
  const withoutDanger = input
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, '');

  // Escape everything, then restore a whitelist of tags (and href on <a>).
  let out = escapeTelegramHtml(withoutDanger);

  for (const tag of ['b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre', 'tg-spoiler']) {
    out = out
      .replace(new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`)
      .replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`);
  }
  out = out.replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // <a href="..."> — only http(s)
  out = out.replace(
    /&lt;a\s+href=&quot;(https?:\/\/[^&]+)&quot;&gt;/gi,
    '<a href="$1">',
  );
  out = out.replace(/&lt;\/a&gt;/gi, '</a>');

  return out;
}

export type AdminBroadcastButton = { text: string; url: string };

export function buildAdminBroadcast(input: {
  format: 'card' | 'html';
  title?: string;
  text: string;
  buttons?: AdminBroadcastButton[];
}): TelegramPayload {
  const title = (input.title ?? 'Comunicado').trim().slice(0, 64) || 'Comunicado';
  let text: string;

  if (input.format === 'html') {
    const body = sanitizeTelegramHtml(input.text.trim()).slice(0, 3500);
    text = body;
  } else {
    const clipped = input.text.trim().slice(0, 900);
    text = [
      ...brandHeader(title.toUpperCase(), '📢'),
      escapeTelegramHtml(clipped),
      ...footer(),
    ].join('\n');
  }

  const custom = (input.buttons ?? [])
    .filter((b) => b.text.trim() && /^https?:\/\//i.test(b.url.trim()))
    .slice(0, 6)
    .map((b) => ({ text: b.text.trim().slice(0, 64), url: b.url.trim() }));

  const rows: Array<Array<{ text: string; url: string }>> = [];
  for (let i = 0; i < custom.length; i += 2) {
    rows.push(custom.slice(i, i + 2));
  }
  if (rows.length === 0) {
    rows.push([{ text: '🏟️ Abrir MLL', url: siteUrl('/') }]);
  }

  return {
    text,
    replyMarkup: { inline_keyboard: rows },
  };
}

export function msgWelcomeUnlinked(): TelegramPayload {
  return {
    text: [
      ...brandHeader('VINCULAR CONTA', '🔗'),
      `Pra receber alertas do clube aqui:`,
      '',
      `1️⃣  Abra o jogo → <b>Configurações</b>`,
      `2️⃣  Toque em <b>Vincular Telegram</b>`,
      `3️⃣  Confirme pelo link gerado`,
      '',
      `<i>O código expira em 10 minutos.</i>`,
      ...footer(),
    ].join('\n'),
    replyMarkup: navKeyboard(),
  };
}

export function msgLinkedSuccess(username?: string): TelegramPayload {
  const greet = username
    ? `Olá, <b>${escapeTelegramHtml(username)}</b>!`
    : `Olá, treinador!`;

  return {
    text: [
      ...brandHeader('CONTA VINCULADA', '✅'),
      greet,
      '',
      `Canal privado ligado. Você recebe:`,
      '',
      `💸  Saques aprovados / rejeitados`,
      `🎧  Respostas do suporte`,
      `⚠️  Eventos de treinador / tesoureiro`,
      `📢  Comunicados oficiais`,
      '',
      RULE,
      `<b>Comandos</b>`,
      `/status · /mute · /unmute · /help`,
      ...footer(),
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '🏟️ Abrir MLL', url: siteUrl('/') },
          { text: '⚙️ Configurações', url: siteUrl('/settings') },
        ],
        [{ text: '🎧 Suporte', url: siteUrl('/support') }],
      ],
    },
  };
}

export function msgAlreadyLinked(username?: string): TelegramPayload {
  const who = username ? `<b>${escapeTelegramHtml(username)}</b>` : 'esta conta';
  return {
    text: [
      ...brandHeader('JÁ VINCULADO', '♻️'),
      `Este Telegram já está ligado a ${who}.`,
      '',
      `Alertas seguem ativos. Use /status ou /mute se precisar.`,
      ...footer(),
    ].join('\n'),
    replyMarkup: navKeyboard(),
  };
}

export function msgInvalidCode(): TelegramPayload {
  return {
    text: [
      ...brandHeader('CÓDIGO INVÁLIDO', '❌'),
      `Gere um novo link em <b>Configurações</b> no jogo.`,
      '',
      `Códigos valem <b>10 minutos</b> e só podem ser usados uma vez.`,
      ...footer(),
    ].join('\n'),
    replyMarkup: navKeyboard(),
  };
}

export function msgHelp(linked: boolean): TelegramPayload {
  return {
    text: [
      ...brandHeader('COMANDOS', '📖'),
      `/start — vincular ou boas-vindas`,
      `/status — vínculo e alertas`,
      `/mute — pausar notificações`,
      `/unmute — reativar notificações`,
      `/help — este menu`,
      '',
      linked
        ? `✅ Conta vinculada · alertas prontos`
        : `⏳ Ainda sem vínculo · use Configurações no jogo`,
      ...footer(),
    ].join('\n'),
    replyMarkup: navKeyboard(),
  };
}

export function msgStatus(opts: {
  linked: boolean;
  username?: string | null;
  notifyEnabled: boolean;
  linkedAt?: Date | null;
}): TelegramPayload {
  const when = opts.linkedAt
    ? opts.linkedAt.toLocaleString('pt-BR', { timeZone: 'UTC' }) + ' UTC'
    : '—';

  return {
    text: [
      ...brandHeader('STATUS DO VÍNCULO', '📡'),
      field('Conta', opts.linked ? '✅ vinculada' : '❌ não vinculada'),
      opts.username
        ? `\n${field('Usuário', `<b>${escapeTelegramHtml(opts.username)}</b>`)}`
        : null,
      `\n${field('Alertas', opts.notifyEnabled ? '🔔 ativos' : '🔕 pausados')}`,
      `\n${field('Desde', `<code>${escapeTelegramHtml(when)}</code>`)}`,
      ...footer(),
    ]
      .filter(Boolean)
      .join('\n'),
    replyMarkup: navKeyboard(),
  };
}

export function msgMuteToggled(enabled: boolean): TelegramPayload {
  return {
    text: [
      ...brandHeader(enabled ? 'ALERTAS REATIVADOS' : 'ALERTAS PAUSADOS', enabled ? '🔔' : '🔕'),
      enabled
        ? `Você volta a receber saques, suporte e eventos aqui.`
        : `Sem alertas até /unmute ou reativar em Configurações.`,
      ...footer(),
    ].join('\n'),
    replyMarkup: navKeyboard(),
  };
}

export function msgNeedLink(): TelegramPayload {
  return {
    text: [
      ...brandHeader('CONTA NÃO VINCULADA', '🔒'),
      `Vincule em Configurações no jogo para usar este comando.`,
      ...footer(),
    ].join('\n'),
    replyMarkup: navKeyboard(),
  };
}
