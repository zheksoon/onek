import { Computed } from "../classes";

export const subscribersCheckQueue: Set<Computed> = new Set();

export function scheduleSubscribersCheck(computed: Computed) {
    subscribersCheckQueue.add(computed);
}

export function runSubscribersCheck() {
    subscribersCheckQueue.forEach((computed) => {
        computed._checkAndPassivate();
    });
    subscribersCheckQueue.clear();
}
