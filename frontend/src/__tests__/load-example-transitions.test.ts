// @vitest-environment jsdom
/**
 * Regression test for the bug where switching between a board-less example
 * (analog / digital SPICE-only) and a board-based example (Arduino Uno) left
 * the editor showing the OLD file's content (or nothing at all).
 *
 * Root cause: `loadExample.ts` single-board path called
 * `useEditorStore.setCode()`, which writes to whatever file `activeFileId`
 * happens to point at. But after a board-less example removed every board,
 * its file group was deleted — and `activeFileId` still pointed at the now-
 * orphan ID, so `setCode` was a silent no-op against the freshly-recreated
 * Arduino file group.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { loadExample } from '../utils/loadExample';
import { exampleProjects } from '../data/examples';

function resetStores() {
  // Clear all boards completely (also clears the file groups they own).
  const sim = useSimulatorStore.getState();
  const ids = sim.boards.map((b) => b.id);
  for (const id of ids) sim.removeBoard(id);
  useElectricalStore.getState().setPaused(false);
}

function findExample(id: string) {
  const e = exampleProjects.find((x) => x.id === id);
  if (!e) throw new Error(`Example not found: ${id}`);
  return e;
}

function activeSketchContent(): string | undefined {
  const { files, activeFileId } = useEditorStore.getState();
  return files.find((f) => f.id === activeFileId)?.content;
}

describe('loadExample — board-less → board-based transition', () => {
  beforeEach(() => {
    resetStores();
  });

  it('loads Arduino Uno code into the editor after a board-less ANALOG example', async () => {
    // 1. Board-less analog circuit
    await loadExample(findExample('an-voltage-divider'));
    expect(useSimulatorStore.getState().boards.length).toBe(0);

    // 2. Now load an Arduino Uno example
    const uno = findExample('blink-led');
    await loadExample(uno);

    expect(useSimulatorStore.getState().boards.length).toBeGreaterThanOrEqual(1);

    const code = activeSketchContent();
    expect(code, 'editor content after Uno load').toBeDefined();
    expect(code, 'editor must contain the Uno example body').toContain(uno.code.slice(0, 40));
  });

  it('loads Arduino Uno code into the editor after a board-less DIGITAL example', async () => {
    await loadExample(findExample('digital-and-two-switches'));
    expect(useSimulatorStore.getState().boards.length).toBe(0);

    const uno = findExample('blink-led');
    await loadExample(uno);

    const code = activeSketchContent();
    expect(code, 'editor content after Uno load').toBeDefined();
    expect(code, 'editor must contain the Uno example body').toContain(uno.code.slice(0, 40));
  });

  it('switching between two board-less examples does not break a later board load', async () => {
    await loadExample(findExample('an-voltage-divider'));
    await loadExample(findExample('digital-xor-difference'));
    await loadExample(findExample('an-rc-low-pass'));

    const uno = findExample('blink-led');
    await loadExample(uno);

    const code = activeSketchContent();
    expect(code, 'editor content after 3 board-less → Uno load').toBeDefined();
    expect(code, 'editor must contain the Uno example body').toContain(uno.code.slice(0, 40));
  });
});
