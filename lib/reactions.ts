export const reactionEmojis = ['👍', '❤️', '😂', '🔥', '🎉'] as const;

export type ReactionEmoji = (typeof reactionEmojis)[number];
export type ReactionTargetType = 'item' | 'comment';

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && reactionEmojis.includes(value as ReactionEmoji);
}

export function isReactionTargetType(value: unknown): value is ReactionTargetType {
  return value === 'item' || value === 'comment';
}
