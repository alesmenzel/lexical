// @flow strict-local

import type {OutlineEditor, View, NodeKey, EditorThemeClasses} from 'outline';

import {isTextNode, isBlockNode, TextNode} from 'outline';
import {useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {updateWithoutHistory} from 'outline-react/OutlineHistory';

export default function useTypeahead(editor: OutlineEditor): void {
  const typeaheadNodeKey = useRef<NodeKey | null>(null);
  const [text, setText] = useState<string>('');
  const [selectionCollapsed, setSelectionCollapsed] = useState<boolean>(false);
  const server = useMemo(() => new TypeaheadServer(), []);
  const suggestion = useTypeaheadSuggestion(text, server.query);

  const getTypeaheadTextNode: (view: View) => TextNode | null = useCallback(
    (view: View) => {
      if (typeaheadNodeKey.current === null) {
        return null;
      }
      const node = view.getNodeByKey(typeaheadNodeKey.current);
      if (!isTextNode(node)) {
        return null;
      }
      return node;
    },
    [],
  );

  // Monitor entered text
  useEffect(() => {
    return editor.addUpdateListener((viewModel) => {
      const text = editor.getTextContent();
      setText(text);
    });
  }, [editor]);

  const renderTypeahead = useCallback(() => {
    updateWithoutHistory(editor, (view: View) => {
      const currentTypeaheadNode = getTypeaheadTextNode(view);

      function maybeRemoveTypeahead() {
        if (currentTypeaheadNode !== null) {
          currentTypeaheadNode.remove();
          view.getRoot().normalizeTextNodes(true);
        }
        typeaheadNodeKey.current = null;
      }

      function maybeAddTypeahead() {
        if (currentTypeaheadNode?.getTextContent(true) === suggestion) {
          return;
        }
        const lastParagraph = view.getRoot().getLastChild();
        if (isBlockNode(lastParagraph)) {
          const lastTextNode = lastParagraph.getLastChild();
          if (isTextNode(lastTextNode)) {
            const newTypeaheadNode = createTypeaheadNode(suggestion ?? '');
            lastTextNode.insertAfter(newTypeaheadNode);
            typeaheadNodeKey.current = newTypeaheadNode.getKey();
          }
        }
        view.getRoot().normalizeTextNodes(true);
      }

      const selection = view.getSelection();
      const anchorNode = selection?.getAnchorNode();
      const anchorOffset = selection?.anchorOffset;
      const anchorLength = anchorNode?.getTextContentSize();
      const isCaretPositionAtEnd =
        anchorLength != null && anchorOffset === anchorLength;
      if (suggestion === null || !selectionCollapsed || !isCaretPositionAtEnd) {
        maybeRemoveTypeahead();
      } else {
        maybeAddTypeahead();
      }
    });
  }, [editor, getTypeaheadTextNode, selectionCollapsed, suggestion]);

  // Rerender on suggestion change
  useEffect(() => {
    renderTypeahead();
  }, [renderTypeahead, suggestion]);

  // Rerender on editor updates
  useEffect(() => {
    return editor.addUpdateListener((viewModel) => {
      if (viewModel.isDirty()) {
        // We are loading a dirty view model, so we need
        // to check it for typeahead nodes
        viewModel.read((view) => {
          const typeaheadNode = view
            .getRoot()
            .getAllTextNodes(true)
            .find((textNode) => textNode instanceof TypeaheadNode);
          if (typeaheadNode instanceof TypeaheadNode) {
            typeaheadNodeKey.current = typeaheadNode.getKey();
          }
        });
      }
      renderTypeahead();
    });
  }, [editor, renderTypeahead]);

  // Handle Keyboard TAB or RIGHT ARROW to complete suggestion
  useEffect(() => {
    const element = editor.getEditorElement();
    if (element != null) {
      const handleEvent = (event: KeyboardEvent) => {
        if (event.key === 'Tab' || event.key === 'ArrowRight') {
          editor.update((view: View) => {
            const typeaheadTextNode = getTypeaheadTextNode(view);
            const prevTextNode = typeaheadTextNode?.getPreviousSibling();
            // Make sure that the Typeahead is visible and previous child writable
            // before calling it a successfully handled event.
            if (typeaheadTextNode !== null && isTextNode(prevTextNode)) {
              event.preventDefault();
              prevTextNode.setTextContent(
                prevTextNode.getTextContent() +
                  typeaheadTextNode.getTextContent(true),
              );
              prevTextNode.select();
            }
            typeaheadTextNode?.remove();
            typeaheadNodeKey.current = null;
          });
        }
      };

      element.addEventListener('keydown', handleEvent);
      return () => {
        element.removeEventListener('keydown', handleEvent);
      };
    }
  }, [editor, getTypeaheadTextNode]);

  useEffect(() => {
    const handleEvent = () => {
      const selection = window.getSelection();

      setSelectionCollapsed(selection.isCollapsed);
    };
    document.addEventListener('selectionchange', handleEvent);
    return () => {
      document.removeEventListener('selectionchange', handleEvent);
    };
  }, []);
}

class TypeaheadNode extends TextNode {
  constructor(text: string, key?: NodeKey) {
    super(text, key);
    this.__type = 'typeahead';
  }

  clone() {
    const clone = new TypeaheadNode(this.__text, this.__key);
    clone.__parent = this.__parent;
    clone.__flags = this.__flags;
    return clone;
  }

  createDOM(editorThemeClasses: EditorThemeClasses) {
    const dom = super.createDOM(editorThemeClasses);
    dom.style.cssText = 'color: #ccc;';
    return dom;
  }
}

function createTypeaheadNode(text: string): TextNode {
  return new TypeaheadNode(text).makeInert();
}

function useTypeaheadSuggestion(
  text: string,
  query: (text: string) => {
    promise: () => Promise<string | null>,
    cancel: () => void,
  },
) {
  const cancelRequest = useRef<() => void>(() => {});
  const requestTime = useRef<number>(0);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  useEffect(() => {
    setSuggestion(null);
    cancelRequest.current();
    (async () => {
      let time = Date.now();
      requestTime.current = time;
      try {
        const request = await query(text);
        cancelRequest.current = request.cancel;
        setSuggestion(await request.promise());
      } catch (e) {
        // Ignore for this example
      }
    })();
  }, [query, text]);

  return suggestion;
}

class TypeaheadServer {
  DATABASE = {
    he: 'llo',
    hel: 'lo',
    hell: 'o',
    He: 'llo',
    Hel: 'lo',
    Hell: 'o',
    'happy ': 'birthday',
    'happy b': 'irthday',
    'happy bi': 'rthday',
    'Happy ': 'birthday',
    'Happy b': 'irthday',
    'Happy bi': 'rthday',
    'hello ': 'world',
    'hello w': 'orld',
    'hello wo': 'rld',
    'hello wor': 'ld',
    'Hello ': 'world',
    'Hello w': 'orld',
    'Hello wo': 'rld',
    'Hello wor': 'ld',
  };
  LATENCY = 200;

  query = (
    text: string,
  ): ({promise: () => Promise<string | null>, cancel: () => void}) => {
    let isCancelled = false;

    const promise = () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          const response = this.DATABASE[text] ?? null;
          if (!isCancelled) {
            resolve(response);
          } else {
            reject('Cancelled network request');
          }
        }, this.LATENCY);
      });

    const cancel = () => {
      isCancelled = true;
    };

    return {
      promise,
      cancel,
    };
  };
}