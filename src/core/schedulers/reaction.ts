import { MAX_REACTION_ITERATIONS } from "../constants";
import { runSubscribersCheck } from "./subscribersCheck";
import { actualizationQueue, runActualizations } from "./stateActualization";

export let reactionQueue = [];
let isReactionRunScheduled = false;

let reactionScheduler = (runner: () => void) => {
    Promise.resolve().then(runner).catch(reactionExceptionHandler);
};
let reactionExceptionHandler = (exception: any) => {
    console.error('reaction exception', exception);
};

export function setReactionScheduler(scheduler: typeof reactionScheduler) {
    reactionScheduler = scheduler;
}

export function setReactionExceptionHandler(handler: typeof reactionExceptionHandler) {
    reactionExceptionHandler = handler;
}

export function scheduleReaction(reaction) {
    reactionQueue.push(reaction);
}

function runReactions(): void {
    try {
        let i = MAX_REACTION_ITERATIONS;
        while ((reactionQueue.length || actualizationQueue.size) && --i) {
            runActualizations();

            const reactions = reactionQueue;
            reactionQueue = [];
            reactions.forEach((reaction) => {
                try {
                    reaction();
                } catch (exception: any) {
                    reactionExceptionHandler(exception);
                }
            });
        }
        if (!i) {
            throw new Error("Infinite reactions loop");
        }
    } finally {
        isReactionRunScheduled = false;
        reactionQueue = [];

        runSubscribersCheck();
    }
}

export function scheduleReactionRunner(): void {
    const shouldRunReactions = reactionQueue.length || actualizationQueue.size;

    if (!isReactionRunScheduled && shouldRunReactions) {
        isReactionRunScheduled = true;
        reactionScheduler(runReactions);
    }
}
