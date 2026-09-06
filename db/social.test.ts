import { describe, expect, it } from 'vitest';
import { buildCommentTree, type CommentRow } from './social';

function row(overrides: Partial<CommentRow> & { id: string }): CommentRow {
  return {
    parentId: null,
    authorName: 'Anonym',
    body: 'Hallo',
    createdAt: 0,
    ...overrides,
  };
}

describe('buildCommentTree', () => {
  it('returns top-level comments newest-first', () => {
    const rows = [
      row({ id: 'a', createdAt: 1 }),
      row({ id: 'b', createdAt: 2 }),
      row({ id: 'c', createdAt: 3 }),
    ];
    const tree = buildCommentTree(rows, new Map());
    expect(tree.map((comment) => comment.id)).toEqual(['c', 'b', 'a']);
  });

  it('nests a reply under its parent, keeping replies oldest-first', () => {
    const rows = [
      row({ id: 'parent', createdAt: 1 }),
      row({ id: 'reply-1', parentId: 'parent', createdAt: 2 }),
      row({ id: 'reply-2', parentId: 'parent', createdAt: 3 }),
    ];
    const tree = buildCommentTree(rows, new Map());
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('parent');
    expect(tree[0].replies.map((reply) => reply.id)).toEqual([
      'reply-1',
      'reply-2',
    ]);
  });

  it('keeps replies out of the top-level list', () => {
    const rows = [
      row({ id: 'parent', createdAt: 1 }),
      row({ id: 'reply', parentId: 'parent', createdAt: 2 }),
    ];
    const tree = buildCommentTree(rows, new Map());
    expect(tree.map((comment) => comment.id)).toEqual(['parent']);
  });

  it('falls back to top-level when the parent is missing (deleted or out of window)', () => {
    const rows = [row({ id: 'orphan', parentId: 'ghost', createdAt: 1 })];
    const tree = buildCommentTree(rows, new Map());
    expect(tree.map((comment) => comment.id)).toEqual(['orphan']);
  });

  it('attaches reactions by "comment:<id>" key', () => {
    const rows = [row({ id: 'a' })];
    const reactions = new Map([
      ['comment:a', [{ emoji: '👍' as const, count: 2, reacted: true }]],
    ]);
    const tree = buildCommentTree(rows, reactions);
    expect(tree[0].reactions).toEqual([
      { emoji: '👍', count: 2, reacted: true },
    ]);
  });

  it('does not nest a reply-to-a-reply under the wrong node (flattening happens on write, not read)', () => {
    // buildCommentTree just mirrors parentId - addRankingComment is
    // responsible for resolving reply-to-a-reply onto the top-level parent
    // before the row is ever written, so this only documents that contract.
    const rows = [
      row({ id: 'parent', createdAt: 1 }),
      row({ id: 'reply', parentId: 'parent', createdAt: 2 }),
    ];
    const tree = buildCommentTree(rows, new Map());
    expect(tree[0].replies[0].replies).toEqual([]);
  });
});
