import { exportProgress, importProgress, type Progress } from '../drill/progress';
import { statsSummary, type StatsRow } from '../drill/stats';

export interface StatsDialogOptions {
  dialog: HTMLDialogElement;
  openButton: HTMLButtonElement;
  /** The rows to show, worked out afresh each time the dialog opens or the progress changes. */
  rows(): StatsRow[];
  progress(): Progress;
  /** Replace the stored progress (import or reset). Returns false if it could not be stored. */
  onReplace(progress: Progress): boolean;
}

export interface StatsDialog {
  isOpen(): boolean;
  /** Redraw if open (after the progress changed). */
  refresh(): void;
}

function need<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Statistics markup is missing ${selector}`);
  return element;
}

/** Per-line statistics, and backup / restore / reset of the progress. */
export function createStatsDialog(options: StatsDialogOptions): StatsDialog {
  const { dialog, openButton } = options;
  const summary = need<HTMLElement>(dialog, '#stats-summary');
  const body = need<HTMLElement>(dialog, '#stats-table tbody');
  const message = need<HTMLElement>(dialog, '#stats-message');
  const exportButton = need<HTMLButtonElement>(dialog, '#stats-export');
  const importButton = need<HTMLButtonElement>(dialog, '#stats-import');
  const importFile = need<HTMLInputElement>(dialog, '#stats-import-file');
  const resetButton = need<HTMLButtonElement>(dialog, '#stats-reset');
  const closeButton = need<HTMLButtonElement>(dialog, '#stats-close');

  function say(text: string, ok: boolean): void {
    message.hidden = false;
    message.dataset.status = ok ? 'ok' : 'error';
    message.textContent = text;
  }

  function draw(): void {
    const rows = options.rows();
    const totals = statsSummary(rows);
    summary.textContent =
      totals.attempts === 0
        ? `${totals.cards} positions to learn. Nothing tried yet — start a drill.`
        : `${totals.seen} of ${totals.cards} positions tried · ${totals.attempts - totals.errors} of ${totals.attempts} answers right · ${totals.due} due now. Weakest first.`;

    body.replaceChildren(
      ...rows.map((row) => {
        const tr = document.createElement('tr');
        tr.dataset.key = row.key;
        tr.dataset.due = String(row.due);
        const cells = [
          row.line,
          row.move,
          row.attempts === 0 ? '–' : String(row.attempts),
          row.attempts === 0 ? '–' : String(row.errors),
          row.rightPercent === null ? '–' : `${row.rightPercent}%`,
          row.next,
        ];
        cells.forEach((text, index) => {
          const td = document.createElement('td');
          td.textContent = text;
          if (index === 0) td.className = 'stats-line';
          if (index === 1) td.className = 'stats-move';
          tr.append(td);
        });
        return tr;
      }),
    );
  }

  exportButton.addEventListener('click', () => {
    const text = exportProgress(options.progress());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `chauss-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    say('Backup file saved to your downloads.', true);
  });

  importButton.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files?.[0];
    importFile.value = ''; // so the same file can be chosen again
    if (!file) return;
    void file.text().then((text) => {
      const result = importProgress(text);
      if (!result.ok) {
        say(result.error, false);
        return;
      }
      const stored = options.onReplace(result.progress);
      draw();
      const count = Object.keys(result.progress.cards).length;
      say(
        stored
          ? `Backup loaded: progress for ${count} position${count === 1 ? '' : 's'}.`
          : 'Backup loaded, but your browser would not store it: it will be lost when you close the page.',
        stored,
      );
    });
  });

  resetButton.addEventListener('click', () => {
    if (!window.confirm('Delete all drill progress in this browser? This cannot be undone (unless you saved a backup file).')) return;
    options.onReplace({ version: 1, cards: {} });
    draw();
    say('Progress reset.', true);
  });

  openButton.addEventListener('click', () => {
    message.hidden = true;
    draw();
    if (!dialog.open) dialog.showModal();
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    isOpen: () => dialog.open,
    refresh: () => {
      if (dialog.open) draw();
    },
  };
}
