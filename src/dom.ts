// Small DOM helpers. Text always goes in through textContent, never innerHTML.

export function button(className: string, text: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

/** A text field that is not a web form: no WebView2 "Saved info" popup with earlier entries, and no
 *  macOS autocorrection, capitals or spell check while a name or search term is typed. */
export function plainField(input: HTMLInputElement): void {
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
}
