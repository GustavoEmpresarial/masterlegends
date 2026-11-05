import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

interface PixelBoxProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variant?: 'default' | 'light' | 'dark';
  glowColor?: string;
}

export function PixelBox({ children, variant = 'default', glowColor, className = '', ...props }: PixelBoxProps) {
  const variants = {
    default: 'pixel-box',
    light: 'pixel-box-light',
    dark: 'pixel-box',
  };

  return (
    <motion.div
      className={`${variants[variant]} ${className}`}
      style={glowColor ? { borderColor: glowColor } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface PixelButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  variant?: 'green' | 'gold' | 'red' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

export function PixelButton({ children, variant = 'green', size = 'md', className = '', ...props }: PixelButtonProps) {
  const variants = {
    green: 'pixel-btn pixel-btn-green',
    gold: 'pixel-btn pixel-btn-gold',
    red: 'pixel-btn pixel-btn-red',
    blue: 'pixel-btn pixel-btn-blue',
    purple: 'pixel-btn',
  };

  const sizes = {
    sm: 'pixel-btn-sm',
    md: 'pixel-btn-md',
    lg: 'pixel-btn-lg',
  };

  const colorStyles: Record<string, React.CSSProperties> = {
    purple: { background: 'var(--purple-dark)', borderColor: 'var(--purple)' },
  };

  return (
    <motion.button
      className={`${variants[variant]} ${sizes[size]} ${className}`}
      style={colorStyles[variant]}
      {...props}
    >
      {children}
    </motion.button>
  );
}

interface PixelCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  rarity?: 'common' | 'rare' | 'super-rare' | 'epic' | 'legendary';
}

export function PixelCard({ children, rarity, className = '', ...props }: PixelCardProps) {
  return (
    <motion.div
      className={`pixel-card ${rarity ? `rarity-${rarity}` : ''} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface PixelProgressProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  label?: string;
}

export function PixelProgress({ value, max = 100, color = 'var(--green)', showLabel = true, label }: PixelProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-caption">
            {label || 'PROGRESS'}
          </span>
          <span className="text-label" style={{ color }}>
            {value}/{max}
          </span>
        </div>
      )}
      <div className="pixel-progress">
        <motion.div
          className="pixel-progress-bar"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1 }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

interface PixelBadgeProps {
  children: ReactNode;
  color?: string;
}

export function PixelBadge({ children, color = 'var(--green)' }: PixelBadgeProps) {
  return (
    <span
      className="pixel-badge"
      style={{ color, borderColor: color }}
    >
      {children}
    </span>
  );
}

interface PlayerCardProps {
  name?: string;
  overwall: number;
  position: string;
  rarity: 'common' | 'rare' | 'super-rare' | 'epic' | 'legendary';
  stamina?: number;
  sprite?: string;
  onClick?: () => void;
}

const rarityColors: Record<string, string> = {
  common: 'var(--rarity-common)',
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  'super-rare': 'var(--rarity-super-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
  mythic: 'var(--rarity-mythic)',
};

const rarityLabels: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  'super-rare': 'SUPER RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

export function PlayerCard({ overwall, position, rarity, stamina = 100, sprite = 'bi-shield-fill', onClick }: PlayerCardProps) {
  const color = rarityColors[rarity];

  return (
    <motion.div
      className="player-card cursor-pointer"
      style={{ borderColor: color }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <PixelBadge color={color}>
        {rarityLabels[rarity]}
      </PixelBadge>

      <div
        className="player-sprite flex items-center justify-center"
        style={{ borderColor: color }}
      >
        <motion.span
          className="text-4xl"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {sprite}
        </motion.span>
      </div>

      <div className="player-overwall" style={{ color }}>
        {overwall.toLocaleString()}
      </div>

      <div className="player-position">{position}</div>

      <div className="mt-3">
        <PixelProgress
          value={stamina}
          max={100}
          color="var(--green)"
          label="STAMINA"
        />
      </div>
    </motion.div>
  );
}

interface StatDisplayProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
}

export function StatDisplay({ icon, value, label, color = 'var(--green)' }: StatDisplayProps) {
  return (
    <motion.div
      className="pixel-box p-4 text-center"
      style={{ borderColor: color }}
      whileHover={{ y: -4 }}
    >
      <div className="text-3xl mb-2"><i className={`bi ${icon}`} aria-hidden /></div>
      <div className="pixel-text text-2xl" style={{ color }}>
        {value}
      </div>
      <div className="text-caption">
        {label}
      </div>
    </motion.div>
  );
}
