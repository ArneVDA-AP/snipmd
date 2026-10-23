import { describe, it, expect } from 'vitest';
import { createEditorState } from '../editor/setup';
import { taskChange } from './tasks';

const change = (doc: string, index: number, rendered: number, checked: boolean) => taskChange(createEditorState('t', doc), index, rendered, checked);

describe('taskChange', () => {
  it('checks an open task in a plain list', () => {
    expect(change('- [ ] a\n- [ ] b', 1, 2, true)).toEqual({ from: 11, to: 12, insert: 'x' });
  });

  it('unchecks a done task, lower or upper case', () => {
    expect(change('- [x] a', 0, 1, false)).toEqual({ from: 3, to: 4, insert: ' ' });
    expect(change('- [X] a', 0, 1, false)).toEqual({ from: 3, to: 4, insert: ' ' });
  });

  it('finds tasks in a nested list in document order', () => {
    const doc = '- [ ] a\n  - [ ] b\n    - [x] c\n- [ ] d';
    expect(change(doc, 1, 4, true)).toEqual({ from: 13, to: 14, insert: 'x' });
    expect(change(doc, 2, 4, false)).toEqual({ from: 25, to: 26, insert: ' ' });
    expect(change(doc, 3, 4, true)).toEqual({ from: 33, to: 34, insert: 'x' });
  });

  it('finds a task inside a quote', () => {
    const doc = '> - [ ] q\n\n- [ ] z';
    expect(change(doc, 0, 2, true)).toEqual({ from: 5, to: 6, insert: 'x' });
    expect(change(doc, 1, 2, true)).toEqual({ from: 14, to: 15, insert: 'x' });
  });

  it('does not count a task marker inside a fenced block', () => {
    const doc = '```\n- [ ] not\n```\n\n- [ ] real';
    expect(change(doc, 0, 1, true)).toEqual({ from: 22, to: 23, insert: 'x' });
    expect(change(doc, 0, 2, true)).toBeNull();
  });

  it('handles numbered tasks', () => {
    expect(change('1. [ ] a\n2. [ ] b', 1, 2, true)).toEqual({ from: 13, to: 14, insert: 'x' });
  });

  it('returns null when the task count differs from what was rendered', () => {
    expect(change('- [ ] a\n- [ ] b', 0, 3, true)).toBeNull();
    expect(change('- [ ] a', 0, 0, true)).toBeNull();
  });

  it('returns null when the marker is not in the state the box had', () => {
    expect(change('- [x] a', 0, 1, true)).toBeNull();
    expect(change('- [ ] a', 0, 1, false)).toBeNull();
  });

  it('returns null for an index outside the tasks', () => {
    expect(change('- [ ] a', 1, 1, true)).toBeNull();
  });
});
