/****************************************************************************
 * Copyright 2021 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ***************************************************************************/

import { Command } from 'domain/entities/Command';
import { CoreEditor } from './Editor';
import assert from 'assert';
import { ketcherProvider } from 'application/utils';

const HISTORY_SIZE = 32; // put me to options

export type HistoryOperationType = 'undo' | 'redo';

export class EditorHistory {
  private logger: Console | undefined = console;
  historyStack: Command[] | [] = [];
  historyPointer = 0;
  editor: CoreEditor | undefined;

  // eslint-disable-next-line no-use-before-define
  private static _instance: EditorHistory | null;

  constructor(editor: CoreEditor) {
    if (EditorHistory._instance) {
      return EditorHistory._instance;
    }
    this.editor = editor;
    this.historyPointer = 0;

    EditorHistory._instance = this;
    return this;
  }

  update(command: Command, mergeWithLatestHistoryCommand = false) {
    this.logger?.debug(
      `> EditorHistory.update(), start, ` +
        `command.operations: ${command.operations
          .map((o) => o.constructor.name)
          .join(', ')}, ` +
        `merge: ${mergeWithLatestHistoryCommand}`,
    );

    const latestCommand = this.historyStack[this.historyStack.length - 1];
    if (mergeWithLatestHistoryCommand && latestCommand) {
      latestCommand.merge(command);
    } else {
      this.historyStack.splice(this.historyPointer, HISTORY_SIZE + 1, command);
      if (this.historyStack.length > HISTORY_SIZE) {
        this.historyStack.shift();
      }
      this.historyPointer = this.historyStack.length;
    }
    ketcherProvider.getKetcher()?.changeEvent.dispatch();

    this.logger?.debug(`< EditorHistory.update(), end`);
  }

  undo() {
    this.logger?.debug(`> EditorHistory.undo(), start`);

    if (this.historyPointer === 0) {
      return;
    }
    ketcherProvider.getKetcher()?.changeEvent.dispatch();
    assert(this.editor);

    this.historyPointer--;
    const lastCommand = this.historyStack[this.historyPointer];
    this.logger?.debug(
      `  EditorHistory.undo(), ` +
        `lastCommand.operations: ${lastCommand.operations
          .map((o) => o.constructor.name)
          .join(', ')}, `,
    );
    lastCommand.invert(this.editor.renderersContainer);
    const turnOffSelectionCommand =
      this.editor?.drawingEntitiesManager.unselectAllDrawingEntities();
    this.editor?.renderersContainer.update(turnOffSelectionCommand);

    this.logger?.debug(`< EditorHistory.undo(), end`);
  }

  redo() {
    if (this.historyPointer === this.historyStack.length) {
      return;
    }
    ketcherProvider.getKetcher()?.changeEvent.dispatch();
    assert(this.editor);

    const lastCommand = this.historyStack[this.historyPointer];
    lastCommand.execute(this.editor.renderersContainer);
    this.historyPointer++;
  }

  destroy() {
    EditorHistory._instance = null;
  }
}
