import { Computed, Reaction } from "../classes";
import { Options } from "../types";
import { MAX_REACTION_ITERATIONS } from "../constants";

const subscribersCheckQueue: Set<Computed> = new Set();
const stateActualizationQueue: Set<Computed> = new Set();
let reactionsQueue: Array<Reaction> = [];
let isRunnerScheduled = false;

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

export function scheduleReaction(reaction: Reaction) {
    reactionsQueue.push(reaction);
}

export function scheduleStateActualization(computed: Computed) {
    stateActualizationQueue.add(computed);
}

export function scheduleSubscribersCheck(computed: Computed) {
    subscribersCheckQueue.add(computed);
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

        isRunnerScheduled = false;
        reactionsQueue = [];
    }
}

export function scheduleReactionRunner(): void {
    const shouldRunReactions =
        reactionsQueue.length ||
        stateActualizationQueue.size ||
        subscribersCheckQueue.size;

    if (!isRunnerScheduled && shouldRunReactions) {
        isRunnerScheduled = true;
        reactionScheduler(runReactions);
    }
}
