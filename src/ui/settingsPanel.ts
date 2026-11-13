import type { ResultDescription } from '../explorer/describe';
import { describeRatings, type ExplorerSettings } from '../explorer/settings';
import { RATING_BANDS, SPEEDS, type RatingBand, type Speed } from '../explorer/types';

export interface SettingsPanelOptions {
  dialog: HTMLDialogElement;
  openButton: HTMLButtonElement;
  initial: ExplorerSettings;
  /** Called with the new settings after every change. Returns false if they could not be stored. */
  onChange(settings: ExplorerSettings): boolean;
  /** Ask Lichess about the position on the board, using the settings as they are now. */
  onTest(): Promise<ResultDescription>;
}

export interface SettingsPanel {
  isOpen(): boolean;
  settings(): ExplorerSettings;
}

const SPEED_NAMES: Record<Speed, string> = {
  ultraBullet: 'UltraBullet',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical',
  correspondence: 'Correspondence',
};

function bandLabel(band: RatingBand): string {
  const next = RATING_BANDS[RATING_BANDS.indexOf(band) + 1];
  return next === undefined ? `${band}+` : `${band}–${next - 1}`;
}

function need<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Settings markup is missing ${selector}`);
  return element;
}

function checkbox(name: string, value: string, label: string, checked: boolean): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = name;
  input.value = value;
  input.checked = checked;
  wrapper.append(input, document.createTextNode(` ${label}`));
  return wrapper;
}

/**
 * The Settings dialog: Lichess token, rating bands, speeds, and a connection test.
 * Everything is saved as soon as it changes.
 */
export function createSettingsPanel(options: SettingsPanelOptions): SettingsPanel {
  const { dialog, openButton } = options;
  let settings: ExplorerSettings = { ...options.initial };

  const tokenInput = need<HTMLInputElement>(dialog, '#token');
  const tokenShow = need<HTMLButtonElement>(dialog, '#token-show');
  const tokenClear = need<HTMLButtonElement>(dialog, '#token-clear');
  const tokenState = need<HTMLElement>(dialog, '#token-state');
  const ratingsBox = need<HTMLElement>(dialog, '#rating-bands');
  const ratingsSummary = need<HTMLElement>(dialog, '#rating-summary');
  const speedsBox = need<HTMLElement>(dialog, '#speeds');
  const testButton = need<HTMLButtonElement>(dialog, '#explorer-test');
  const testResult = need<HTMLElement>(dialog, '#explorer-test-result');
  const saveWarning = need<HTMLElement>(dialog, '#settings-save-warning');
  const closeButton = need<HTMLButtonElement>(dialog, '#settings-close');

  tokenInput.value = settings.token;
  ratingsBox.replaceChildren(
    ...RATING_BANDS.map((band) => checkbox('rating', String(band), bandLabel(band), settings.ratings.includes(band))),
  );
  speedsBox.replaceChildren(
    ...SPEEDS.map((speed) => checkbox('speed', speed, SPEED_NAMES[speed], settings.speeds.includes(speed))),
  );

  function refresh(): void {
    tokenState.textContent = settings.token
      ? 'A token is saved in this browser.'
      : 'No token saved. Live data from Lichess is switched off.';
    tokenState.dataset.hasToken = String(settings.token !== '');
    tokenClear.disabled = settings.token === '';
    ratingsSummary.textContent = `Counting games rated ${describeRatings(settings.ratings)}.`;
  }

  function commit(): void {
    const stored = options.onChange(settings);
    saveWarning.hidden = stored;
    // A previous test result may no longer be true for the new settings.
    testResult.hidden = true;
    refresh();
  }

  function checkedValues(box: HTMLElement): string[] {
    return [...box.querySelectorAll<HTMLInputElement>('input:checked')].map((input) => input.value);
  }

  tokenInput.addEventListener('input', () => {
    settings = { ...settings, token: tokenInput.value.trim() };
    commit();
  });

  tokenShow.addEventListener('click', () => {
    const reveal = tokenInput.type === 'password';
    tokenInput.type = reveal ? 'text' : 'password';
    tokenShow.textContent = reveal ? 'Hide' : 'Show';
    tokenShow.setAttribute('aria-pressed', String(reveal));
  });

  tokenClear.addEventListener('click', () => {
    tokenInput.value = '';
    settings = { ...settings, token: '' };
    commit();
  });

  ratingsBox.addEventListener('change', (event) => {
    const chosen = checkedValues(ratingsBox).map(Number);
    const ratings = RATING_BANDS.filter((band) => chosen.includes(band));
    if (ratings.length === 0) {
      // At least one group must stay ticked: undo the click.
      if (event.target instanceof HTMLInputElement) event.target.checked = true;
      return;
    }
    settings = { ...settings, ratings };
    commit();
  });

  speedsBox.addEventListener('change', (event) => {
    const chosen = checkedValues(speedsBox);
    const speeds = SPEEDS.filter((speed) => chosen.includes(speed));
    if (speeds.length === 0) {
      if (event.target instanceof HTMLInputElement) event.target.checked = true;
      return;
    }
    settings = { ...settings, speeds };
    commit();
  });

  testButton.addEventListener('click', () => {
    testButton.disabled = true;
    testResult.hidden = false;
    testResult.dataset.status = 'pending';
    testResult.textContent = 'Asking Lichess…';
    void options
      .onTest()
      .then((result) => {
        testResult.dataset.status = result.ok ? 'ok' : 'error';
        testResult.textContent = result.text;
      })
      .finally(() => {
        testButton.disabled = false;
      });
  });

  openButton.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  closeButton.addEventListener('click', () => dialog.close());
  // Clicking the dimmed area around the dialog closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  refresh();

  return {
    isOpen: () => dialog.open,
    settings: () => settings,
  };
}
