export const enum State {
    NOT_INITIALIZED = 0,
    CLEAN = 1,
    MAYBE_DIRTY = 2,
    DIRTY = 3,
    COMPUTING = 4,
    PASSIVE = 5,
    DESTROYED = 6,
}

export const MAX_REACTION_ITERATIONS = 100;
