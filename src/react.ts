import { useLayoutEffect, useState } from "react";
import { reaction, setSubscriber } from "./core";

export const useObserver = () => {
    const [, triggerUpdate] = useState({});

    const [store] = useState(() => {
        const _reaction = reaction(
            () => {},
            () => {
                triggerUpdate({});
            }
        );

        const observer = (callback) => {
            const oldSubscriber = setSubscriber(_reaction._self);

            try {
                return callback();
            } finally {
                setSubscriber(oldSubscriber);
            }
        };

        return {
            _subscriptionEffect() {
                _reaction._shouldSubscribe = true;
                _reaction._subscribe();

                if (!_reaction._missedRun()) {
                    triggerUpdate({});
                }

                return () => {
                    _reaction._cleanup();
                    _reaction._shouldSubscribe = false;
                };
            },
            _onBeforeRender() {
                _reaction._cleanup();
            },
            _observer: observer,
        };
    });

    useLayoutEffect(store._subscriptionEffect, []);

    store._onBeforeRender();

    return store._observer;
};
