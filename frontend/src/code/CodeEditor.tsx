import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorView, Decoration, keymap, placeholder as cmPlaceholder, type DecorationSet } from '@codemirror/view';
import { Prec, RangeSetBuilder, StateField, StateEffect, EditorState } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { cx } from '../design/ui';

/* CodeMirror 6 styled like the GNOSIA code cards — deliberately not an IDE: no minimap, no tabs, no gutter icons. */
const gnosiaHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.definitionKeyword, t.modifier, t.controlKeyword, t.operatorKeyword, t.bool, t.null], class: 'k' },
  { tag: [t.string, t.special(t.string), t.regexp], class: 's' },
  { tag: [t.number], class: 'n' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'f' },
  { tag: [t.standard(t.variableName), t.propertyName], class: 'p' },
  { tag: [t.comment, t.lineComment, t.blockComment], class: 'c' },
  { tag: [t.punctuation, t.operator, t.bracket, t.separator], class: 'pn' },
]);

const theme = EditorView.theme({ '&': { backgroundColor: 'transparent' } });

// error line (L1): tinted until the code changes
const setBad = StateEffect.define<number | null>();
const badField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setBad)) {
        if (!e.value || e.value > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        const b = new RangeSetBuilder<Decoration>();
        b.add(line.from, line.from, Decoration.line({ class: 'is-bad' }));
        return b.finish();
      }
    }
    return tr.docChanged ? Decoration.none : deco.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

export function CodeEditor({ value, onChange, onRun, badLine, small, minHeight, readOnly, placeholder, label, runKey = 'Mod-Enter' }: {
  value: string; onChange?: (v: string) => void; onRun?: () => void; badLine?: number | null; small?: boolean; minHeight?: number;
  readOnly?: boolean; placeholder?: string; label: string; runKey?: 'Mod-Enter' | 'Shift-Enter';
}) {
  const runRef = useRef(onRun);
  runRef.current = onRun;
  const view = useRef<EditorView | null>(null);
  const extensions = useMemo(() => [
    javascript(),
    syntaxHighlighting(gnosiaHighlight),
    theme,
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    badField,
    EditorView.contentAttributes.of({ 'aria-label': label }),
    // above basicSetup's own keymap (which binds Mod-Enter to "insert blank line")
    Prec.highest(keymap.of([
      { key: runKey, run: () => { runRef.current?.(); return true; } },
      { key: 'Tab', run: v => { v.dispatch(v.state.replaceSelection('  ')); return true; } },
    ])),
    ...(placeholder ? [cmPlaceholder(placeholder)] : []),
  ], [label, runKey, placeholder]);
  useEffect(() => { view.current?.dispatch({ effects: setBad.of(badLine ?? null) }); }, [badLine]);
  return (
    <div className={cx('cm-host', small && 'is-sm')}>
      <CodeMirror
        value={value}
        onChange={v => onChange?.(v)}
        extensions={extensions}
        readOnly={readOnly}
        editable={!readOnly}
        theme="none"
        onCreateEditor={v => { view.current = v; if (badLine) v.dispatch({ effects: setBad.of(badLine) }); }}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, highlightActiveLineGutter: true, autocompletion: false,
          bracketMatching: true, closeBrackets: true, indentOnInput: true, searchKeymap: false, lintKeymap: false, highlightSelectionMatches: false, dropCursor: false }}
        minHeight={minHeight ? `${minHeight}px` : undefined}
      />
    </div>
  );
}
