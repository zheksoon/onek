import { ISubscription } from "../types";

export const actualizationQueue: Set<ISubscription> = new Set();

export function scheduleActualization(computed: ISubscription) {
    actualizationQueue.add(computed);
}

export function runActualizations() {
    actualizationQueue.forEach((computed) => {
        computed._actualize(false);
    });
    actualizationQueue.clear();
}
