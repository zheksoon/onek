import { Subscription } from "../types";

export const stateActualizationQueue: Set<Subscription> = new Set();

export function scheduleStateActualization(computed: Subscription) {
    stateActualizationQueue.add(computed);
}

export function runStateActualization() {
    stateActualizationQueue.forEach((computed) => {
        computed._actualizeAndRecompute();
    });
    stateActualizationQueue.clear();
}
