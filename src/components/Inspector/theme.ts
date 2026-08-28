import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0a0a0a',
    color: '#d4d4d4',
    fontSize: '13px',
    lineHeight: '1.6',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
    padding: '8px 0',
    caretColor: '#525252',
  },
  '.cm-gutters': {
    backgroundColor: '#0a0a0a',
    color: '#525252',
    border: 'none',
    borderRight: '1px solid #262626',
    fontSize: '12px',
    minWidth: '40px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#171717',
    color: '#a3a3a3',
  },
  '.cm-activeLine': {
    backgroundColor: '#171717',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#262626 !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#737373',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: '#262626 !important',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#262626',
    color: '#a3a3a3',
    border: 'none',
    padding: '0 4px',
  },
  '.cm-line': {
    padding: '0 8px',
  },
}, { dark: true });
