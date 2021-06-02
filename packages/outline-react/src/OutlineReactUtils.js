/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

// invariant(condition, message) will refine types based on "condition", and
// if "condition" is false will throw an error. This function is special-cased
// in flow itself, so we can't name it anything else.
export function invariant(cond?: boolean, message?: string) {
  throw new Error(
    'Internal Outline error: invariant() is meant to be replaced at compile ' +
      'time. There is no runtime version.',
  );
}

export function getDOMTextNodeFromElement(element: Node): Text {
  let node = element;
  while (node != null) {
    if (node.nodeType === 3) {
      // $FlowFixMe: nodeType === text node
      return node;
    }
    node = node.firstChild;
  }
  invariant(false, 'getDOMTextNodeFromElement: text node not found');
}