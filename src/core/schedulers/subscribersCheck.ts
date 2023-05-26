export const subscribersCheckQueue: any = new Set();

export function runSubscribersCheck() {
    subscribersCheckQueue.forEach((computed) => {
        // the computed might be re-introduced later to the queue
        // when other checks will be done, so we need to delete it
        subscribersCheckQueue.delete(computed);
        computed._checkAndPassivate();
    });
    subscribersCheckQueue.clear();
}
