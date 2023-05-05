import type { IOptions } from "../types";
import { Reaction } from "../classes";
import { MAX_REACTION_ITERATIONS } from "../constants";
import { runSubscribersCheck, subscribersCheckQueue } from "./subscribersCheck";
import { runStateActualization, stateActualizationQueue } from "./stateActualization";

let reactionQueue: Array<Reaction> = [];
let isReactionRunScheduled = false;

let reactionScheduler = (runner: () => void) => {
    Promise.resolve().then(runner);
};
let reactionExceptionHandler = (exception: any) => {
    console.error("Reaction exception:", exception);
};

export function configure(options: IOptions) {
    if (options.reactionScheduler !== undefined) {
        reactionScheduler = options.reactionScheduler;
    }
    if (options.reactionExceptionHandler !== undefined) {
        reactionExceptionHandler = options.reactionExceptionHandler;
    }
}

export function scheduleReaction(reaction: Reaction) {
    reactionQueue.push(reaction);
}

function runReactions(): void {
    try {
        let i = MAX_REACTION_ITERATIONS;
        while (reactionQueue.length || stateActualizationQueue.size) {
            runStateActualization();

            while (reactionQueue.length && --i) {
                const reactions = reactionQueue;
                reactionQueue = [];
                reactions.forEach((reaction) => {
                    try {
                        reaction._runManager();
                    } catch (exception: any) {
                        reactionExceptionHandler(exception);
                    }
                });
            }
            if (!i) {
                throw new Error("Infinite reactions loop");
            }
        }
    } finally {
        isReactionRunScheduled = false;
        reactionQueue = [];

        runSubscribersCheck();
    }
}

export function scheduleReactionRunner(): void {
    const shouldRunReactions =
        reactionQueue.length || stateActualizationQueue.size || subscribersCheckQueue.size;

    if (!isReactionRunScheduled && shouldRunReactions) {
        isReactionRunScheduled = true;
        reactionScheduler(runReactions);
    }
}
