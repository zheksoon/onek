import { Reaction } from "../classes";
import { MAX_REACTION_ITERATIONS } from "../constants";
import { runSubscribersCheck } from "./subscribersCheck";

let reactionQueue = new Set<Reaction>();
let swapQueue = new Set<Reaction>();
let isReactionRunScheduled = false;

let reactionScheduler = (runner: () => void) => {
    Promise.resolve().then(runner).catch(reactionExceptionHandler);
};
let reactionExceptionHandler = (exception: any) => {
    console.error("Reaction exception:", exception);
};

export function setReactionScheduler(scheduler: typeof reactionScheduler) {
    reactionScheduler = scheduler;
}

export function setReactionExceptionHandler(handler: typeof reactionExceptionHandler) {
    reactionExceptionHandler = handler;
}

export function scheduleReaction(reaction: Reaction) {
    reactionQueue.add(reaction);
}

function runReactions(): void {
    try {
        let i = MAX_REACTION_ITERATIONS;

        // trying not to allocate JS objects here
        while ((reactionQueue.size || swapQueue.size) && --i) {
            const reactions = reactionQueue;

            reactionQueue = swapQueue;

            reactions.forEach((reaction) => {
                try {
                    reaction.runManager();
                } catch (exception: any) {
                    reactionExceptionHandler(exception);
                }
            });

            reactions.clear();

            swapQueue = reactions;
        }

        if (!i) {
            throw new Error("Infinite reactions loop");
        }
    } finally {
        isReactionRunScheduled = false;
        reactionQueue.clear();
        swapQueue.clear();

        runSubscribersCheck();
    }
}

export function scheduleReactionRunner(): void {
    if (!isReactionRunScheduled && reactionQueue.size) {
        isReactionRunScheduled = true;
        reactionScheduler(runReactions);
    }
}
