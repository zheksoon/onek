import { Computed } from "../classes";

export const stateActualizationQueue: Set<Computed> = new Set();

export function scheduleStateActualization(computed: Computed) {
    stateActualizationQueue.add(computed);
}

export function runStateActualization() {
    stateActualizationQueue.forEach((computed) => {
        computed._actualizeAndRecompute();
    });
    stateActualizationQueue.clear();
}
