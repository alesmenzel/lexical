/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {EntityMatch} from '@lexical/text';
import type {TextNode} from 'lexical';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {registerLexicalTextEntity} from '@lexical/text';
import {mergeRegister} from '@lexical/utils';
import {useEffect} from 'react';

export function useLexicalTextEntity<T extends typeof TextNode>(
  getMatch: (text: string) => null | EntityMatch,
  targetNode: T,
  createNode: (textNode: TextNode) => InstanceType<T>,
): void {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      ...registerLexicalTextEntity(editor, getMatch, targetNode, createNode),
    );
  }, [createNode, editor, getMatch, targetNode]);
}
