import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0a0a0a',
    color: '#e5e5e5',
    fontSize: '12px',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: '#0a0a0a',
    color: '#525252',
    border: 'none',
    borderRight: '1px solid #262626',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#171717',
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
  },
}, { dark: true });
