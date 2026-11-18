import { GraphNodeData, GraphEdgeData } from '../../localization/types/GraphTypes';

export interface Command {
    execute(): void;
    undo(): void;
}

export class CommandManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];
    private maxHistory: number = 50;
    private onStateChange?: () => void;

    constructor(onStateChange?: () => void) {
        this.onStateChange = onStateChange;
    }

    execute(command: Command) {
        command.execute();
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = []; // clear redo stack on new action
        if (this.onStateChange) this.onStateChange();
    }

    undo() {
        if (this.undoStack.length > 0) {
            const command = this.undoStack.pop()!;
            command.undo();
            this.redoStack.push(command);
            if (this.onStateChange) this.onStateChange();
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const command = this.redoStack.pop()!;
            command.execute();
            this.undoStack.push(command);
            if (this.onStateChange) this.onStateChange();
        }
    }
    
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }
    
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
