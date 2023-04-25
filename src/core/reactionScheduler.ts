import { ComputedImpl, Options, ReactionImpl } from "./types";

const MAX_REACTION_ITERATIONS = 100;

const subscribersCheckQueue: Set<ComputedImpl> = new Set();
const stateActualizationQueue: Set<ComputedImpl> = new Set();
let reactionsQueue: Array<ReactionImpl> = [];
let reactionsScheduled = false;

let reactionScheduler = (runner: () => void) => {
    Promise.resolve().then(runner);
};
let reactionExceptionHandler = (exception: Error) => {
    console.error("Reaction exception:", exception);
};

export function configure(options: Options) {
    if (options.reactionScheduler !== undefined) {
        reactionScheduler = options.reactionScheduler;
    }
    if (options.reactionExceptionHandler !== undefined) {
        reactionExceptionHandler = options.reactionExceptionHandler;
    }
}

export function scheduleReaction(reaction: ReactionImpl) {
    reactionsQueue.push(reaction);
}

export function scheduleSubscribersCheck(computed: ComputedImpl) {
    subscribersCheckQueue.add(computed);
}

export function scheduleStateActualization(computed: ComputedImpl) {
    stateActualizationQueue.add(computed);
}

function runReactions(): void {
    try {
        let i = MAX_REACTION_ITERATIONS;
        while (reactionsQueue.length || stateActualizationQueue.size) {
            stateActualizationQueue.forEach((computed) => {
                computed._actualizeAndRecompute();
            });
            stateActualizationQueue.clear();

            while (reactionsQueue.length && --i) {
                const reactions = reactionsQueue;
                reactionsQueue = [];
                reactions.forEach((r) => {
                    try {
                        r._runManager();
                    } catch (exception) {
                        reactionExceptionHandler(exception);
                    }
                });
            }
            if (!i) {
                throw new Error("Infinite reactions loop");
            }
        }
    } finally {
        subscribersCheckQueue.forEach((computed) => {
            computed._checkSubscribers();
        });
        subscribersCheckQueue.clear();

        reactionsScheduled = false;
        reactionsQueue = [];
    }
}

export function endTx(): void {
    const shouldRunReactions =
        reactionsQueue.length ||
        stateActualizationQueue.size ||
        subscribersCheckQueue.size;

    if (!reactionsScheduled && shouldRunReactions) {
        reactionsScheduled = true;
        reactionScheduler(runReactions);
    }
}
