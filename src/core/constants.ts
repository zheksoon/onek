export const enum State {
    NOT_INITIALIZED,
    COMPUTING,
    CLEAN,
    MAYBE_DIRTY,
    DIRTY,
    PASSIVE,
    DESTROYED,
}

export const MAX_REACTION_ITERATIONS = 100;
